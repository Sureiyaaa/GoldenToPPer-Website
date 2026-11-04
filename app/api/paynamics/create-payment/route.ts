import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { createPaynamicsTransaction } from '@/lib/paynamics/client';

const orderItemSchema = z.object({
  itemname: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  unitprice: z.union([z.string(), z.number()]),
  totalprice: z.union([z.string(), z.number()]),
});

const requestSchema = z.object({
  merchant_id: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().default('PHP'),
  payment_action: z.enum(['url_link', 'direct_otc']).default('url_link'),
  customer: z.object({
    fname: z.string().min(1),
    lname: z.string().min(1),
    mname: z.string().optional(),
    email: z.string().email(),
    phone: z.string().min(1),
    mobile: z.string().min(1),
    dob: z.string().optional(),
  }),
  billing: z.object({
    billing_address1: z.string().optional(),
    billing_address2: z.string().optional(),
    billing_city: z.string().optional(),
    billing_state: z.string().optional(),
    billing_country: z.string().optional(),
    billing_zip: z.string().optional(),
  }).optional(),
  order: z.object({
    orders: z.array(orderItemSchema).min(1),
    subtotalprice: z.union([z.string(), z.number()]),
    shippingprice: z.union([z.string(), z.number()]).default('0.00'),
    discountamount: z.union([z.string(), z.number()]).default('0.00'),
    totalorderamount: z.union([z.string(), z.number()]),
  }),
});

// Env-driven endpoint: builds a signed Paynamics transaction request from sandbox/
// production credentials in process.env and forwards it to Paynamics.
//
// Note: merchant_id here is caller-supplied (useful for direct/manual API calls).
// The payment form flow instead goes through app/actions/payment.ts, which looks up
// the authoritative merchant_id for the selected project server-side and never
// trusts a client-submitted value.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createPaynamicsTransaction({
      merchantId: parsed.data.merchant_id,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      paymentAction: parsed.data.payment_action,
      customer: parsed.data.customer,
      billing: parsed.data.billing,
      order: parsed.data.order,
    });

    return NextResponse.json({
      request_id: result.requestId,
      redirect_url: result.redirectUrl,
      gateway_response: result.gatewayResponse,
    });
  } catch (err) {
    console.error('[PAYNAMICS] create-payment error:', err);
    const message = err instanceof Error ? err.message : 'Unable to reach payment gateway.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
