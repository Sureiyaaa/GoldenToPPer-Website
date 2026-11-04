// Paynamics configuration. Reads credentials/URLs from env; sandbox vs production
// is selected by which .env file is loaded (.env.development / .env.production),
// same as the Turnstile keys.
//
// notification_url/response_url/cancel_url must point at THIS site's own API
// routes (not a third-party webhook directly), so the signature is verified
// before anything downstream — n8n included — is trusted. They're derived from
// the site's own base URL rather than hardcoded per-env, same pattern as
// app/projects/[slug]/page.tsx's SITE_URL.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.goldentopper.vercel.app';

export interface PaynamicsConfig {
  baseUrl: string;
  mkey: string;
  authKey: string;
  notificationUrl: string;
  responseUrl: string;
  cancelUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[PAYNAMICS] Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPaynamicsConfig(): PaynamicsConfig {
  return {
    baseUrl: requireEnv('PAYNAMICS_BASE_URL'),
    mkey: requireEnv('PAYNAMICS_MKEY'),
    // Header auth — pre-encoded base64(username:password) account hash, sent
    // as-is in Authorization: Basic <authKey>. Separate from mkey, which only
    // signs the transaction payload.
    authKey: requireEnv('PAYNAMICS_AUTH_KEY'),
    // Server-to-server status push (no browser) — our route verifies the
    // signature, then forwards it to n8n/wherever internally.
    notificationUrl: `${SITE_URL}/api/paynamics/notification`,
    // Browser redirect after a successful (async) transaction.
    responseUrl: `${SITE_URL}/api/paynamics/callback`,
    // Browser redirect after cancel/expired/rejected/failed — same Response
    // Payload format as response_url, so one route handles both.
    cancelUrl: `${SITE_URL}/api/paynamics/callback`,
    successRedirectUrl: `${SITE_URL}/payment/success`,
    failureRedirectUrl: `${SITE_URL}/payment/failed`,
  };
}
