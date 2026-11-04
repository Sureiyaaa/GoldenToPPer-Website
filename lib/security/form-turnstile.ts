export type PublicFormAction = 'loan_application' | 'inquiry' | 'contact';

type VerificationResult = { valid: true } | { valid: false; error: string };
const UNAVAILABLE = 'Security verification is temporarily unavailable. Please try again later.';

export async function verifyFormTurnstile(token: unknown, action: PublicFormAction): Promise<VerificationResult> {
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return { valid: false, error: 'Please complete the security verification.' };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const deployed = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL_ENV);
  const testSecret = Boolean(secret && [
    '1x0000000000000000000000000000000AA',
    '2x0000000000000000000000000000000AA',
    '3x0000000000000000000000000000000AA',
  ].includes(secret));
  if (!secret || (deployed && testSecret)) {
    return { valid: false, error: UNAVAILABLE };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { valid: false, error: UNAVAILABLE };
    const result = await response.json();
    if (result?.success !== true || (Array.isArray(result['error-codes']) && result['error-codes'].length)) {
      return {
        valid: false,
        error: result?.['error-codes']?.includes('timeout-or-duplicate')
          ? 'Verification expired or was already used. Please verify again.'
          : 'Security verification failed. Please try again.',
      };
    }
    // Cloudflare's local-only dummy response always uses action "test".
    if (result.action !== action && !(testSecret && !deployed && result.action === 'test')) {
      return { valid: false, error: 'Security verification failed. Please try again.' };
    }

    if (deployed) {
      if (process.env.VERCEL_ENV === 'preview' && process.env.ALLOW_PREVIEW_CAPTCHA_HOSTS !== 'true') {
        return { valid: false, error: UNAVAILABLE };
      }
      const allowedHosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || 'goldentopper.vercel.app,www.goldentopper.vercel.app')
        .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
      if (process.env.VERCEL_ENV === 'preview') {
        for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
          if (host) allowedHosts.push(host.toLowerCase());
        }
      }
      if (typeof result.hostname !== 'string' || !allowedHosts.includes(result.hostname.toLowerCase())) {
        return { valid: false, error: 'Security verification failed. Please try again.' };
      }
    }
    return { valid: true };
  } catch {
    // Fail closed on provider outages, timeouts and malformed responses. Do not
    // log credentials, customer details or the single-use verification token.
    return { valid: false, error: UNAVAILABLE };
  }
}
