'use server';

import * as z from 'zod';

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
  paymentMethod: z.string().min(1, 'Payment method is required'),
  firstName: z.string().min(1, 'First name is required').regex(/^[a-zA-Z\s\-']+$/, 'Invalid characters in first name'),
  lastName: z.string().min(1, 'Last name is required').regex(/^[a-zA-Z\s\-']+$/, 'Invalid characters in last name'),
  email: z.string().email('Invalid email address'),
  contactNumber: z.string()
    .min(10, 'Contact number must be at least 10 digits')
    .regex(/^\d+$/, 'Contact number must contain only digits'),
  project: z.string().min(1, 'Project is required'),
  tower: z.string().min(1, 'Tower is required'),
  unit: z.string().min(1, 'Unit is required').regex(/^[a-zA-Z0-9\-]+$/, 'Invalid unit format'),
  paymentPurpose: z.string().min(1, 'Payment purpose is required'),
  amount: z.string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than zero'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

// Allowed payment methods
const ALLOWED_PAYMENT_METHODS = ['BDO Pay', 'GCash', 'GrabPay', 'Alipay', 'WeChat Pay', 'Maya', 'Visa', 'Mastercard'];

// Allowed payment purposes
const ALLOWED_PAYMENT_PURPOSES = ['Downpayment', 'Monthly Due', 'Reservation Fee', 'CTS Reprinting Fee'];

// Allowed projects (from the UI form)
const ALLOWED_PROJECTS = ['City Clou', 'Park One', 'El Sol', 'La Vida'];

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

  // Get secret key from environment - PAYMENT-SPECIFIC
  const secretKey = process.env.PAYMENT_TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('[PAYMENT] PAYMENT_TURNSTILE_SECRET_KEY not configured');
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
function validatePaymentData(data: PaymentFormData): { valid: boolean; error?: string } {
  // Validate payment method is in allowed list
  if (!ALLOWED_PAYMENT_METHODS.includes(data.paymentMethod)) {
    return { valid: false, error: 'Invalid payment method.' };
  }

  // Validate payment purpose is in allowed list
  if (!ALLOWED_PAYMENT_PURPOSES.includes(data.paymentPurpose)) {
    return { valid: false, error: 'Invalid payment purpose.' };
  }

  // Validate project is in allowed list
  if (!ALLOWED_PROJECTS.includes(data.project)) {
    return { valid: false, error: 'Invalid project selection.' };
  }

  // Validate amount is positive and finite
  const amount = parseFloat(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: 'Amount must be a valid positive number.' };
  }

  // TODO: Amount validation against actual project/unit pricing
  // This requires pricing data from the database that is not yet implemented.
  // When the payment gateway integration is completed, authoritative amount validation
  // should be performed against the actual pricing model.
  // For now, we accept any positive amount as the pricing model does not yet exist.

  return { valid: true };
}

// Main payment submission action
export async function submitPaymentAction(
  paymentData: PaymentFormData,
  captchaToken: string
): Promise<{ success?: boolean; error?: string }> {
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
      console.log('[PAYMENT] Schema validation failed:', schemaValidation.error);
      return { error: 'Invalid payment data. Please check your form.' };
    }

    console.log('[PAYMENT] 5. Schema validation successful');

    // Step 3: Validate payment data business rules
    console.log('[PAYMENT] 6. Validating payment business rules...');
    const businessValidation = validatePaymentData(schemaValidation.data);

    if (!businessValidation.valid) {
      console.log(`[PAYMENT] Business validation failed: ${businessValidation.error}`);
      return { error: businessValidation.error || 'Invalid payment request.' };
    }

    console.log('[PAYMENT] 7. Business validation successful');

    // Step 4: Payment gateway boundary
    // TODO: Payment Gateway Integration
    // The following is the integration boundary where a real payment gateway would be called.
    // Currently, no payment gateway is configured.
    // Future implementation should:
    // 1. Call the appropriate payment provider API (Stripe, Xendit, PayMongo, etc.)
    // 2. Create a transaction record in the database
    // 3. Handle payment provider responses and error codes
    // 4. Update project/unit/customer records as needed
    // 5. Send confirmation emails
    //
    // For now, return a clear message that payment processing is not configured.

    console.log('[PAYMENT] 8. Reached payment gateway boundary - gateway not yet configured');

    return {
      error: 'Payment processing is not yet configured. Please contact support.',
    };
  } catch (err: any) {
    console.error('[PAYMENT] FATAL SERVER ERROR:', err);
    return { error: err.message || 'An unexpected error occurred. Please try again.' };
  }
}
