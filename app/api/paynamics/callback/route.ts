import { NextRequest, NextResponse } from 'next/server';
import { getPaynamicsConfig } from '@/lib/paynamics/config';
import { verifyResponseSignature, type ResponseSignatureFields } from '@/lib/paynamics/signature';
import {
  getPaynamicsResponseCodeInfo,
  isPaynamicsSuccessCode,
  isPaynamicsValidationError,
} from '@/lib/paynamics/response-codes';

type ResponsePayload = ResponseSignatureFields & { signature?: string | null };

function readPayload(params: URLSearchParams | Record<string, unknown>): ResponsePayload {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const value = (params as Record<string, unknown>)[key];
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

/** Only allow redirecting to absolute http(s) URLs; refuses to forward anything else. */
function resolveSafeRedirect(candidate: string | null | undefined): URL | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

async function handleCallback(req: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = getPaynamicsConfig();
  } catch (err) {
    console.error('[PAYNAMICS] Configuration error:', err);
    return NextResponse.json({ error: 'Payment gateway is not configured.' }, { status: 500 });
  }

  let payload: ResponsePayload;
  if (req.method === 'GET') {
    payload = readPayload(req.nextUrl.searchParams);
  } else {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      payload = readPayload(body as Record<string, unknown>);
    } else {
      const form = await req.formData().catch(() => null);
      payload = form
        ? readPayload(Object.fromEntries(form.entries()) as Record<string, unknown>)
        : readPayload(req.nextUrl.searchParams);
    }
  }

  if (!payload.request_id || !payload.merchant_id) {
    return NextResponse.json({ error: 'Missing request_id or merchant_id in callback payload.' }, { status: 400 });
  }

  const signatureValid = verifyResponseSignature(payload, config.mkey, payload.signature ?? '');
  if (!signatureValid) {
    console.error('[PAYNAMICS] Callback signature mismatch for request_id:', payload.request_id);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const responseCode = payload.response_code ?? null;
  const codeInfo = getPaynamicsResponseCodeInfo(responseCode);
  const success = isPaynamicsSuccessCode(responseCode);
  const validationError = isPaynamicsValidationError(responseCode);

  if (validationError) {
    console.error(`[PAYNAMICS] ${responseCode} - ${codeInfo?.title}: ${codeInfo?.message}`, {
      request_id: payload.request_id,
    });
  } else {
    console.log(`[PAYNAMICS] Callback for request_id ${payload.request_id}: code=${responseCode} success=${success}`);
  }

  // TODO: persist response_code / pay_reference against the originating transaction
  // once a transactions table exists; currently there is no DB record to update.

  const gatewayRedirect = resolveSafeRedirect(payload.redirect_url);
  const fallbackUrl = success ? config.successRedirectUrl : config.failureRedirectUrl;
  const target = gatewayRedirect ?? resolveSafeRedirect(fallbackUrl);

  if (!target) {
    console.error('[PAYNAMICS] No valid redirect target for request_id:', payload.request_id);
    return NextResponse.json({
      error: 'No valid redirect_url provided and no fallback configured.',
      response_code: responseCode,
      response_code_info: codeInfo,
    }, { status: 502 });
  }

  return NextResponse.redirect(target, { status: 302 });
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
