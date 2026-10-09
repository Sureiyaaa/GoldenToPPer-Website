// app/actions/auth.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'crypto';

// Dummy hash used for timing-safe password checking with non-existent users
// Ensures login attempts take similar time regardless of user existence
const DUMMY_HASH_FOR_TIMING_SAFETY = bcrypt.hashSync('timing-safe-dummy', 10);

// Cloudflare Turnstile verification response type
interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cData?: string;
}

// Verify CAPTCHA token with Cloudflare Siteverify API
async function verifyCaptchaToken(token: string): Promise<{ valid: boolean; error?: string }> {
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
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('[AUTH] CAPTCHA_SECRET_KEY not configured');
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
      console.error('[AUTH] Cloudflare test credentials detected in production environment');
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
      console.error(`[AUTH] Siteverify API returned status ${response.status}`);
      return { valid: false, error: 'Security verification service is unavailable. Please try again.' };
    }

    const data: TurnstileVerifyResponse = await response.json();

    // Check for error codes from Cloudflare
    if (data['error-codes'] && data['error-codes'].length > 0) {
      const errorCode = data['error-codes'][0];
      console.warn(`[AUTH] CAPTCHA verification failed with error: ${errorCode}`);

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
      console.warn('[AUTH] CAPTCHA verification returned success: false');
      return { valid: false, error: 'Security verification failed. Please try again.' };
    }

    // Validate hostname based on deployment environment
    // Production: Validate against explicit allowlist (required)
    // Preview/Staging: Only validate if explicitly enabled via environment config
    // Local dev: Skip validation (NODE_ENV check)
    const isProductionDeployment = process.env.VERCEL_ENV === 'production';
    const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';
    const allowPreviewHostnames = process.env.ALLOW_PREVIEW_CAPTCHA_HOSTS === 'true';

    if (data.hostname) {
      // Production deployments: mandatory hostname validation
      if (isProductionDeployment) {
        const productionHosts = ['goldentopper.vercel.app', 'www.goldentopper.vercel.app'];
        if (!productionHosts.includes(data.hostname)) {
          console.warn(`[AUTH] CAPTCHA hostname mismatch in production: ${data.hostname}`);
          return { valid: false, error: 'Security verification failed due to hostname mismatch.' };
        }
      }
      // Preview deployments: optional validation (defaults to reject if not explicitly enabled)
      else if (isPreviewDeployment && allowPreviewHostnames) {
        // Preview URLs typically match pattern: *-git-*.vercel.app
        // Must end with vercel.app to prevent spoofing
        if (!data.hostname.endsWith('.vercel.app')) {
          console.warn(`[AUTH] CAPTCHA hostname mismatch in preview: ${data.hostname}`);
          return { valid: false, error: 'Security verification failed due to hostname mismatch.' };
        }
      } else if (isPreviewDeployment && !allowPreviewHostnames) {
        // Preview authentication disabled by default (most secure)
        console.warn(`[AUTH] CAPTCHA hostname validation failed: preview authentication not enabled`);
        return { valid: false, error: 'Security verification is not configured for this deployment.' };
      }
      // Local dev (NODE_ENV !== production): validation skipped
    }

    // Token is valid
    return { valid: true };
  } catch (err: any) {
    // Network errors, timeouts, JSON parse errors, etc.
    if (err.name === 'AbortError') {
      console.error('[AUTH] CAPTCHA verification timed out');
      return { valid: false, error: 'Security verification timed out. Please try again.' };
    }

    console.error('[AUTH] CAPTCHA verification error:', err.message);
    return { valid: false, error: 'Unable to verify security challenge. Please try again.' };
  }
}

export async function loginAction(formData: FormData) {
  console.log("[AUTH] 1. Login Action Triggered!");

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log("[AUTH] ERROR: Missing Environment Variables");
      return { error: "CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY in .env.local file." };
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log("[AUTH] 2. Supabase Admin Client Initialized");

    // CAPTCHA verification happens FIRST, before any credential checks
    console.log("[AUTH] 3. Verifying CAPTCHA token...");
    const captchaToken = formData.get('captchaToken') as string;
    const captchaVerification = await verifyCaptchaToken(captchaToken);

    if (!captchaVerification.valid) {
      console.log(`[AUTH] CAPTCHA verification failed: ${captchaVerification.error}`);
      return { error: captchaVerification.error || "Security verification failed. Please try again." };
    }

    console.log("[AUTH] 4. CAPTCHA verification successful. Proceeding with credential validation...");

    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
      return { error: "Username and password are required." };
    }

    const cleanUsername = username.trim().toLowerCase();
    console.log(`[AUTH] 5. Searching DB for username: ${cleanUsername}`);

    // 1. DATABASE CHECK
    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', cleanUsername)
      .single();

    if (error) {
      console.log("[AUTH] ERROR: DB Search Failed:", error.message);
    }

    // 2. TIMING-SAFE PASSWORD MATCH
    // Use dummy hash for non-existent users to prevent timing attacks
    // that could reveal whether a username exists
    const hashToCheck = user?.password_hash || DUMMY_HASH_FOR_TIMING_SAFETY;
    const isMatch = await bcrypt.compare(password, hashToCheck);

    // 3. UNIFIED AUTHENTICATION ERROR
    // Return same generic message for all credential failures:
    // - User doesn't exist
    // - User exists but password wrong
    // - User exists but account disabled
    // This prevents username enumeration and account-status disclosure
    if (!user || user.is_active === false || !isMatch) {
      console.log("[AUTH] ERROR: Authentication failed (credential mismatch or inactive account)");
      return { error: "Unable to sign in. Check your username and password, then try again." };
    }

    console.log("[AUTH] 6. Credentials verified! Setting cookie...");

    // 3. Set the session cookie
    const cookieStore = await cookies();
    const expiresAt = Date.now() + 60 * 60 * 24 * 7 * 1000;
    const adminId = String(user.id);
    // Admin IDs can be bigint values or UUIDs, depending on the database schema.
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(adminId)) {
      return { error: 'Account ID has an unsupported format. Contact an admin.' };
    }
    const sessionPayload = `v1.${adminId}.${expiresAt}`;
    const signature = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
      .update(sessionPayload).digest('hex');
    cookieStore.set('custom_admin_session', `${sessionPayload}.${signature}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    console.log("[AUTH] 9. Cookie set successfully. Login complete!");
    return { success: true };

  } catch (err: any) {
    console.error("[AUTH] FATAL SERVER CRASH:", err);
    return { error: err.message || "An unexpected error occurred on the server." };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('custom_admin_session');
}

export async function getCustomSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('custom_admin_session')?.value;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !key) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [version, id, expiry, signature] = parts;
  const expiration = Number(expiry);
  if (version !== 'v1' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) ||
      !Number.isSafeInteger(expiration) || expiration <= Date.now() ||
      !/^[0-9a-f]{64}$/.test(signature)) return null;
  const expected = createHmac('sha256', key).update(`${version}.${id}.${expiry}`).digest();
  const actual = Buffer.from(signature, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  // Verify account still exists and is active (revocation check)
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, is_active')
      .eq('id', id)
      .single();

    // Account must exist and be explicitly active
    // Reject if: query error, user not found, or is_active !== true
    if (error || !user || user.is_active !== true) {
      return null;
    }
  } catch (err: any) {
    // Database errors → reject session (fail-closed)
    console.error('[AUTH] Account status verification failed:', err.message);
    return null;
  }

  return id;
}

export async function getCurrentUser() {
  const userId = await getCustomSession();
  if (!userId) return null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, is_super_admin, is_active')
    .eq('id', userId)
    .single();

  return user?.is_active === false ? null : user;
}

export async function getRBACProfile() {
  const userId = await getCustomSession();
  if (!userId) return null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, is_super_admin, group_id, is_active')
    .eq('id', userId)
    .single();

  if (!user || user.is_active === false) return null;

  if (user.is_super_admin) {
    return { role: 'admin', permissions: 'SUPER_ADMIN' };
  }

  if (!user.group_id) return null;

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('is_active')
    .eq('id', user.group_id)
    .single();

  if (!group || group.is_active === false) return null;

  const { data: accessData } = await supabaseAdmin
    .from('module_access')
    .select(`can_view, can_create, can_edit, can_delete, modules ( module_code )`)
    .eq('group_id', user.group_id);

  const permsMap: Record<string, any> = {};
  if (accessData) {
    accessData.forEach((row: any) => {
      const mCode = Array.isArray(row.modules) ? row.modules[0]?.module_code : row.modules?.module_code;
      if (mCode) {
        permsMap[mCode] = {
          can_view: row.can_view,
          can_create: row.can_create,
          can_edit: row.can_edit,
          can_delete: row.can_delete
        };
      }
    });
  }

  return { role: 'editor', permissions: permsMap };
}
