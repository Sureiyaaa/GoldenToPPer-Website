'use server';

import * as z from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { PaymentProject } from '@/lib/payment-form';
import { normalizeServerContactNumber } from '@/lib/payment-form';
import { createPaynamicsTransaction } from '@/lib/paynamics/client';

// Cloudflare Turnstile verification response type
interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cData?: string;
}

// Payment form schema - reusing the same validation as client
const paymentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').regex(/^[a-zA-Z\s\-']+$/, 'Invalid characters in first name'),
  lastName: z.string().min(1, 'Last name is required').regex(/^[a-zA-Z\s\-']+$/, 'Invalid characters in last name'),
  email: z.string().email('Invalid email address'),
  contactNumber: z.string()
    .refine((value) => normalizeServerContactNumber(value) !== null, 'Contact number must be a valid international phone number')
    .transform((value) => normalizeServerContactNumber(value)!),
  projectId: z.string().min(1, 'Project is required').regex(/^\d+$/, 'Invalid project ID'),
  merchantId: z.string().trim().min(1, 'Invalid merchant ID').nullable().optional(),
  tower: z.string().trim().min(1, 'Tower is required').max(100, 'Tower is too long'),
  unitNumber: z.string().min(1, 'Unit number is required').regex(/^\d+$/, 'Unit number must be digits only').refine((val) => parseInt(val) > 0, 'Unit number must be positive'),
  paymentPurpose: z.string().min(1, 'Payment purpose is required'),
  amount: z.string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than zero'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

// Allowed payment purposes
const ALLOWED_PAYMENT_PURPOSES = ['Downpayment', 'Monthly Due', 'Reservation Fee', 'CTS Reprinting Fee'];

// Create admin Supabase client for server-side queries
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fetch active projects for payment form. Projects without a merchant_id can't
// be paid for yet, so they're excluded rather than shown and failing at submit.
export async function fetchProjectsForPayment(): Promise<PaymentProject[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('project_table')
      .select('id, title, merchant_id')
      .eq('is_active', true)
      .is('deleted_at', null)
      .not('merchant_id', 'is', null)
      .order('title', { ascending: true });

    if (error) {
      console.error('[PAYMENT] Error fetching projects:', error.message);
      return [];
    }

    return (data || []).map((project) => ({
      project_name: project.title,
      project_id: project.id,
      merchant_id: project.merchant_id ?? null,
    }));
  } catch (err) {
    console.error('[PAYMENT] Unexpected error fetching projects:', err);
    return [];
  }
}

// Verify CAPTCHA token with Cloudflare Siteverify API - Payment version
async function verifyPaymentCaptchaToken(token: string): Promise<{ valid: boolean; error?: string }> {
  // Validate token format before making API call
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'CAPTCHA token is required.' };
  }

  if (token.trim().length === 0) {
    return { valid: false, error: 'CAPTCHA token is required.' };
  }

  // Cloudflare API has a maximum token length of 2048 characters
  if (token.length > 2048) {
    return { valid: false, error: 'CAPTCHA token is invalid.' };
  }

  // Get secret key from environment
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('[PAYMENT] TURNSTILE_SECRET_KEY not configured');
    return { valid: false, error: 'Security verification is not configured. Please contact support.' };
  }

  // Reject known Cloudflare test/dummy keys in production
  if (process.env.NODE_ENV === 'production') {
    const knownTestSecrets = [
      '1x0000000000000000000000000000000AA',  // Always-pass
      '2x0000000000000000000000000000000BB',  // Always-fail
      '2x4d61696c626f7800000000',             // Always-challenge
    ];
    if (knownTestSecrets.includes(secretKey)) {
      console.error('[PAYMENT] Cloudflare test credentials detected in production environment');
      return { valid: false, error: 'Security verification is not configured. Please contact support.' };
    }
  }

  try {
    // Call Cloudflare Siteverify API
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`[PAYMENT] Siteverify API returned status ${response.status}`);
      return { valid: false, error: 'Security verification service is unavailable. Please try again.' };
    }

    const data: TurnstileVerifyResponse = await response.json();

    // Check for error codes from Cloudflare
    if (data['error-codes'] && data['error-codes'].length > 0) {
      const errorCode = data['error-codes'][0];
      console.warn(`[PAYMENT] CAPTCHA verification failed with error: ${errorCode}`);

      // Map specific error codes to user-friendly messages
      if (errorCode === 'timeout-or-duplicate') {
        return { valid: false, error: 'Security verification expired or was already used. Please try again.' };
      }
      if (errorCode === 'invalid-input-response') {
        return { valid: false, error: 'Security verification failed. Please try again.' };
      }
      if (errorCode === 'invalid-input-secret') {
        return { valid: false, error: 'Security verification is misconfigured. Please contact support.' };
      }

      return { valid: false, error: 'Security verification failed. Please try again.' };
    }

    // Verify success flag
    if (!data.success) {
      console.warn('[PAYMENT] CAPTCHA verification returned success: false');
      return { valid: false, error: 'Security verification failed. Please try again.' };
    }

    // Verify action matches expected "payment" action
    if (data.action !== 'payment') {
      console.warn(`[PAYMENT] CAPTCHA action mismatch: expected 'payment', got '${data.action}'`);
      return { valid: false, error: 'Security verification failed due to action mismatch.' };
    }

    // Validate hostname based on deployment environment
    const isProductionDeployment = process.env.VERCEL_ENV === 'production';
    const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';
    const allowPreviewHostnames = process.env.ALLOW_PREVIEW_CAPTCHA_HOSTS === 'true';

    if (data.hostname) {
      // Production deployments: mandatory hostname validation
      if (isProductionDeployment) {
        const productionHosts = ['goldentopper.vercel.app', 'www.goldentopper.vercel.app'];
        if (!productionHosts.includes(data.hostname)) {
          console.warn(`[PAYMENT] CAPTCHA hostname mismatch in production: ${data.hostname}`);
          return { valid: false, error: 'Security verification failed due to hostname mismatch.' };
        }
      }
      // Preview deployments: optional validation (defaults to reject if not explicitly enabled)
      else if (isPreviewDeployment && allowPreviewHostnames) {
        if (!data.hostname.endsWith('.vercel.app')) {
          console.warn(`[PAYMENT] CAPTCHA hostname mismatch in preview: ${data.hostname}`);
          return { valid: false, error: 'Security verification failed due to hostname mismatch.' };
        }
      } else if (isPreviewDeployment && !allowPreviewHostnames) {
        console.warn(`[PAYMENT] CAPTCHA hostname validation failed: preview authentication not enabled`);
        return { valid: false, error: 'Security verification is not configured for this deployment.' };
      }
      // Local dev (NODE_ENV !== production): validation skipped
    }

    // Token is valid
    return { valid: true };
  } catch (err: any) {
    // Network errors, timeouts, JSON parse errors, etc.
    if (err.name === 'AbortError') {
      console.error('[PAYMENT] CAPTCHA verification timed out');
      return { valid: false, error: 'Security verification timed out. Please try again.' };
    }

    console.error('[PAYMENT] CAPTCHA verification error:', err.message);
    return { valid: false, error: 'Unable to verify security challenge. Please try again.' };
  }
}

// Validate payment data server-side
async function validatePaymentData(
  data: PaymentFormData
): Promise<{ valid: boolean; error?: string; merchantId?: string | null; projectName?: string }> {
  // Validate payment purpose is in allowed list
  if (!ALLOWED_PAYMENT_PURPOSES.includes(data.paymentPurpose)) {
    return { valid: false, error: 'Invalid payment purpose.' };
  }

  // Validate amount is positive and finite
  const amount = parseFloat(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: 'Amount must be a valid positive number.' };
  }

  // Validate project exists and is active; the returned merchant_id is the
  // authoritative value used for the Paynamics request, not the client-submitted one.
  let authoritativeMerchantId: string | null;
  let projectName: string;
  try {
    const { data: projectData, error: projError } = await supabaseAdmin
      .from('project_table')
      .select('id, title, merchant_id')
      .eq('id', parseInt(data.projectId))
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (projError || !projectData) {
      return { valid: false, error: 'Invalid project selection.' };
    }

    authoritativeMerchantId = projectData.merchant_id ?? null;
    projectName = projectData.title;
    const submittedMerchantId = data.merchantId ?? null;
    if (authoritativeMerchantId !== submittedMerchantId) {
      return { valid: false, error: 'The project merchant association has changed. Please reselect the project.' };
    }
  } catch (err) {
    console.error('[PAYMENT] Error validating project:', err);
    return { valid: false, error: 'Unable to validate project. Please try again.' };
  }

  // Note: unitNumber is user-entered and not validated against inventory
  // since the project does not have an authoritative unit inventory source yet

  // TODO: Amount validation against actual project/unit pricing
  // This requires pricing data from the database that is not yet implemented.
  // When the payment gateway integration is completed, authoritative amount validation
  // should be performed against the actual pricing model.
  // For now, we accept any positive amount as the pricing model does not yet exist.

  return { valid: true, merchantId: authoritativeMerchantId, projectName };
}

// Main payment submission action
export async function submitPaymentAction(
  paymentData: PaymentFormData,
  captchaToken: string
): Promise<{ success?: boolean; error?: string; redirectUrl?: string }> {
  console.log('[PAYMENT] 1. Payment submission initiated');

  try {
    // Step 1: Verify CAPTCHA token
    console.log('[PAYMENT] 2. Verifying CAPTCHA token...');
    const captchaVerification = await verifyPaymentCaptchaToken(captchaToken);

    if (!captchaVerification.valid) {
      console.log(`[PAYMENT] CAPTCHA verification failed: ${captchaVerification.error}`);
      return { error: captchaVerification.error || 'Security verification failed. Please try again.' };
    }

    console.log('[PAYMENT] 3. CAPTCHA verification successful');

    // Step 2: Validate payment schema
    console.log('[PAYMENT] 4. Validating payment form schema...');
    const schemaValidation = paymentSchema.safeParse(paymentData);

    if (!schemaValidation.success) {
      console.warn('[PAYMENT] Schema validation failed');
      return { error: 'Invalid payment data. Please check your form.' };
    }

    console.log('[PAYMENT] 5. Schema validation successful');

    // Step 3: Validate payment data business rules
    console.log('[PAYMENT] 6. Validating payment business rules...');
    const businessValidation = await validatePaymentData(schemaValidation.data);

    if (!businessValidation.valid) {
      console.log(`[PAYMENT] Business validation failed: ${businessValidation.error}`);
      return { error: businessValidation.error || 'Invalid payment request.' };
    }

    console.log('[PAYMENT] 7. Business validation successful');

    // Step 4: Payment gateway boundary — merchant_id is the authoritative value
    // validatePaymentData resolved from the project, never the client-submitted one.
    const merchantId = businessValidation.merchantId;
    if (!merchantId) {
      console.warn('[PAYMENT] Project has no merchant_id configured for Paynamics');
      return { error: 'This project is not yet set up for online payment. Please contact support.' };
    }

    const { firstName, lastName, email, contactNumber, paymentPurpose, tower, unitNumber, amount } = schemaValidation.data;
    const projectName = businessValidation.projectName;

    console.log('[PAYMENT] 8. Creating Paynamics transaction...');
    try {
      const transaction = await createPaynamicsTransaction({
        merchantId,
        amount,
        customer: {
          fname: firstName,
          lname: lastName,
          email,
          phone: contactNumber,
          mobile: contactNumber,
        },
        order: {
          orders: [{
            itemname: `${projectName} | Tower ${tower} | ${unitNumber} - ${paymentPurpose}`,
            quantity: 1,
            unitprice: amount,
            totalprice: amount,
          }],
          subtotalprice: amount,
          totalorderamount: amount,
        },
      });

      // TODO: persist request_id/merchantId/amount against a transaction record
      // once a transactions table exists, so the callback route can reconcile it.

      if (!transaction.redirectUrl) {
        console.error('[PAYMENT] Paynamics did not return a redirect_url:', transaction.gatewayResponse);
        return { error: 'Payment gateway did not return a payment link. Please try again.' };
      }

      console.log('[PAYMENT] 9. Paynamics transaction created, redirecting to gateway');
      return { success: true, redirectUrl: transaction.redirectUrl };
    } catch (err) {
      console.error('[PAYMENT] Paynamics request failed:', err);
      return { error: 'Unable to reach the payment gateway. Please try again.' };
    }
  } catch {
    console.error('[PAYMENT] Unexpected server error');
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
