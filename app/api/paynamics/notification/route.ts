import { NextRequest, NextResponse } from 'next/server';
import { getPaynamicsConfig } from '@/lib/paynamics/config';
import { verifyResponseSignature, type ResponseSignatureFields } from '@/lib/paynamics/signature';
import { getPaynamicsResponseCodeInfo, isPaynamicsValidationError } from '@/lib/paynamics/response-codes';

type NotificationPayload = ResponseSignatureFields & { signature?: string | null };

function readPayload(body: Record<string, unknown>): NotificationPayload {
  const get = (key: string): string | null => {
    const value = body[key];
    return value === undefined || value === null ? null : String(value);
  };

  return {
    merchant_id: get('merchant_id') ?? '',
    request_id: get('request_id') ?? '',
    response_id: get('response_id'),
    gateway_id: get('gateway_id'),
    response_code: get('response_code'),
    response_message: get('response_message'),
    response_advise: get('response_advise'),
    timestamp: get('timestamp'),
    processor_response_id: get('processor_response_id'),
    processor_response_authcode: get('processor_response_authcode'),
    pay_reference: get('pay_reference'),
    redirect_url: get('redirect_url'),
    signature: get('signature'),
  };
}

// notification_url: server-to-server status push from Paynamics, no browser
// involved. Verifies the signature, then forwards the verified payload on to
// PAYNAMICS_NOTIFICATION_FORWARD_URL (e.g. the n8n webhook) if configured.
export async function POST(req: NextRequest) {
  let config;
  try {
    config = getPaynamicsConfig();
  } catch (err) {
    console.error('[PAYNAMICS] Configuration error:', err);
    return NextResponse.json({ error: 'Payment gateway is not configured.' }, { status: 500 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let rawBody: Record<string, unknown>;
  if (contentType.includes('application/json')) {
    rawBody = await req.json().catch(() => ({}));
  } else {
    const form = await req.formData().catch(() => null);
    rawBody = form ? Object.fromEntries(form.entries()) : {};
  }

  const payload = readPayload(rawBody);

  if (!payload.request_id || !payload.merchant_id) {
    return NextResponse.json({ error: 'Missing request_id or merchant_id in notification payload.' }, { status: 400 });
  }

  const signatureValid = verifyResponseSignature(payload, config.mkey, payload.signature ?? '');
  if (!signatureValid) {
    console.error('[PAYNAMICS] Notification signature mismatch for request_id:', payload.request_id);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const codeInfo = getPaynamicsResponseCodeInfo(payload.response_code);
  if (isPaynamicsValidationError(payload.response_code)) {
    console.error(`[PAYNAMICS] ${payload.response_code} - ${codeInfo?.title}: ${codeInfo?.message}`, {
      request_id: payload.request_id,
    });
  } else {
    console.log(`[PAYNAMICS] Notification for request_id ${payload.request_id}: code=${payload.response_code}`);
  }

  // TODO: persist response_code/pay_reference against the originating transaction
  // once a transactions table exists.

  const forwardUrl = process.env.PAYNAMICS_NOTIFICATION_FORWARD_URL;
  if (forwardUrl) {
    try {
      await fetch(forwardUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawBody),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error('[PAYNAMICS] Failed to forward notification:', err);
      // Paynamics only needs our ack; a downstream forwarding failure
      // shouldn't make Paynamics retry a transaction we already verified.
    }
  }

  return NextResponse.json({ received: true });
}
