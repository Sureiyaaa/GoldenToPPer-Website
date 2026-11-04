import { getPaynamicsConfig } from './config';
import { generatePaynamicsRequestId } from './request-id';
import { formatPaynamicsAmount, signCustomerInfo, signTransaction } from './signature';

// The payment form collects no billing address — Paynamics still requires the
// billing_info object, so unset fields fall back to these generic placeholders.
const DEFAULT_BILLING_INFO = {
  billing_address1: 'N/A',
  billing_address2: '',
  billing_city: 'N/A',
  billing_state: 'N/A',
  billing_country: 'PH',
  billing_zip: '0000',
};

export interface PaynamicsOrderItem {
  itemname: string;
  quantity: number | string;
  unitprice: number | string;
  totalprice: number | string;
}

export interface CreatePaynamicsTransactionParams {
  /** Authoritative merchant_id for the selected project — never trust a client-supplied value. */
  merchantId: string;
  amount: number | string;
  currency?: string;
  paymentAction?: 'url_link' | 'direct_otc';
  customer: {
    fname: string;
    lname: string;
    mname?: string;
    email: string;
    phone: string;
    mobile: string;
    dob?: string;
  };
  billing?: {
    billing_address1?: string;
    billing_address2?: string;
    billing_city?: string;
    billing_state?: string;
    billing_country?: string;
    billing_zip?: string;
  };
  order: {
    orders: PaynamicsOrderItem[];
    subtotalprice: number | string;
    shippingprice?: number | string;
    discountamount?: number | string;
    totalorderamount: number | string;
  };
}

export interface CreatePaynamicsTransactionResult {
  requestId: string;
  redirectUrl: string | null;
  gatewayResponse: unknown;
}

/** Builds a signed Paynamics transaction request for merchantId's project and submits it. */
export async function createPaynamicsTransaction(
  params: CreatePaynamicsTransactionParams
): Promise<CreatePaynamicsTransactionResult> {
  const config = getPaynamicsConfig();
  const {
    merchantId,
    currency = 'PHP',
    paymentAction = 'url_link',
    customer,
    billing,
    order,
  } = params;

  const amount = formatPaynamicsAmount(params.amount);
  const requestId = generatePaynamicsRequestId();

  const transactionSignature = signTransaction(
    {
      merchant_id: merchantId,
      request_id: requestId,
      notification_url: config.notificationUrl,
      response_url: config.responseUrl,
      cancel_url: config.cancelUrl,
      collection_method: 'single_pay',
      amount,
      currency,
      payment_notification_status: '1',
      payment_notification_channel: '3',
    },
    config.mkey
  );

  const customerSignature = signCustomerInfo(
    {
      fname: customer.fname,
      lname: customer.lname,
      mname: customer.mname ?? '',
      email: customer.email,
      phone: customer.phone,
      mobile: customer.mobile,
      dob: customer.dob ?? '',
    },
    config.mkey
  );

  const paynamicsRequestBody = {
    transaction: {
      merchant_id: merchantId,
      request_id: requestId,
      notification_url: config.notificationUrl,
      response_url: config.responseUrl,
      cancel_url: config.cancelUrl,
      amount,
      currency,
      payment_action: paymentAction,
      payment_notification_status: '1',
      payment_notification_channel: '3',
      trx_type: 'sale',
      collection_method: 'single_pay',
      signature: transactionSignature,
    },
    customer_info: {
      fname: customer.fname,
      lname: customer.lname,
      mname: customer.mname ?? '',
      email: customer.email,
      phone: customer.phone,
      mobile: customer.mobile,
      dob: customer.dob ?? '',
      signature: customerSignature,
    },
    billing_info: { ...DEFAULT_BILLING_INFO, ...billing },
    order_details: {
      ...order,
      shippingprice: order.shippingprice ?? '0.00',
      discountamount: order.discountamount ?? '0.00',
    },
    merchant_id: merchantId,
    mkey: config.mkey,
  };

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': requestId,
      Authorization: `Basic ${config.authKey}`,
    },
    body: JSON.stringify(paynamicsRequestBody),
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('[PAYNAMICS] Gateway rejected request:', response.status, result);
    throw new Error('Payment gateway rejected the request.');
  }

  return {
    requestId,
    redirectUrl: result?.redirect_url ?? result?.url_link ?? null,
    gatewayResponse: result,
  };
}
