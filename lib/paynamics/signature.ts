import { createHash } from 'crypto';

// Paynamics signatures are SHA-512 hex digests of a concatenated "forSign" string,
// per Paynamics API spec section 5.3 (Signature Concatenation). Field order is fixed
// per payload type and verified against Paynamics-provided sample request/response
// signatures. Missing/null mandatory or optional-but-present fields are sent as ''.

function sha512Hex(value: string): string {
  return createHash('sha512').update(value, 'utf8').digest('hex');
}

function field(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Formats an amount to exactly two decimal places, as required before signing. */
export function formatPaynamicsAmount(amount: number | string): string {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(numeric)) {
    throw new Error('[PAYNAMICS] Invalid amount value for signing');
  }
  return numeric.toFixed(2);
}

export interface TransactionSignatureFields {
  merchant_id: string;
  request_id: string;
  notification_url?: string | null;
  response_url?: string | null;
  cancel_url?: string | null;
  collection_method?: string | null;
  amount: number | string;
  currency: string;
  payment_notification_status?: string | null;
  payment_notification_channel?: string | null;
}

export function buildTransactionForSign(fields: TransactionSignatureFields, mkey: string): string {
  return [
    field(fields.merchant_id),
    field(fields.request_id),
    field(fields.notification_url),
    field(fields.response_url),
    field(fields.cancel_url),
    field(fields.collection_method),
    formatPaynamicsAmount(fields.amount),
    field(fields.currency),
    field(fields.payment_notification_status),
    field(fields.payment_notification_channel),
    field(mkey),
  ].join('');
}

export function signTransaction(fields: TransactionSignatureFields, mkey: string): string {
  return sha512Hex(buildTransactionForSign(fields, mkey));
}

export interface CustomerSignatureFields {
  fname: string;
  lname: string;
  mname?: string | null;
  email: string;
  phone: string;
  mobile: string;
  dob?: string | null;
}

export function buildCustomerForSign(fields: CustomerSignatureFields, mkey: string): string {
  return [
    field(fields.fname),
    field(fields.lname),
    field(fields.mname),
    field(fields.email),
    field(fields.phone),
    field(fields.mobile),
    field(fields.dob),
    field(mkey),
  ].join('');
}

export function signCustomerInfo(fields: CustomerSignatureFields, mkey: string): string {
  return sha512Hex(buildCustomerForSign(fields, mkey));
}

export interface ResponseSignatureFields {
  merchant_id: string;
  request_id: string;
  response_id?: string | null;
  gateway_id?: string | null;
  response_code?: string | null;
  response_message?: string | null;
  response_advise?: string | null;
  timestamp?: string | null;
  processor_response_id?: string | null;
  processor_response_authcode?: string | null;
  pay_reference?: string | null;
  redirect_url?: string | null;
}

export function buildResponseForSign(fields: ResponseSignatureFields, mkey: string): string {
  return [
    field(fields.merchant_id),
    field(fields.request_id),
    field(fields.response_id),
    field(fields.gateway_id),
    field(fields.response_code),
    field(fields.response_message),
    field(fields.response_advise),
    field(fields.timestamp),
    field(fields.processor_response_id),
    field(fields.processor_response_authcode),
    field(fields.pay_reference),
    field(fields.redirect_url),
    field(mkey),
  ].join('');
}

export function signResponse(fields: ResponseSignatureFields, mkey: string): string {
  return sha512Hex(buildResponseForSign(fields, mkey));
}

/** Verifies a Paynamics response/notification signature using a timing-safe compare. */
export function verifyResponseSignature(
  fields: ResponseSignatureFields,
  mkey: string,
  signature: string
): boolean {
  if (!signature || typeof signature !== 'string') return false;
  const expected = signResponse(fields, mkey);
  if (expected.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
