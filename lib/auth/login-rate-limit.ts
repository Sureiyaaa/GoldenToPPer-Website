import type { SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

type RequestHeaders = Pick<Headers, 'get'>;
type DeniedResult = { allowed: false; error: string; retryAfterSeconds?: number };
type LimitResult = { allowed: true } | DeniedResult;

const UNAVAILABLE = 'Sign-in is temporarily unavailable. Please try again later.';

function bucketKey(scope: 'ip' | 'username', identifier: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Rate-limit hashing key is missing.');
  const digest = createHmac('sha256', secret)
    .update(`admin-login:${scope}:${identifier}`).digest('hex');
  return `${scope}:${digest}`;
}

function unavailable(): DeniedResult {
  console.error('[AUTH] Login rate-limit storage is unavailable.');
  return { allowed: false, error: UNAVAILABLE };
}

function denied(retryAfterSeconds: number): DeniedResult {
  return {
    allowed: false,
    error: 'Too many failed sign-in attempts. Please wait before trying again.',
    retryAfterSeconds,
  };
}

// Trust only a header overwritten by the deployment's ingress, never a form field
// or an arbitrary X-Forwarded-For header supplied by the browser.
export function getLoginClientAddress(headers: RequestHeaders): string {
  const headerName = process.env.VERCEL === '1'
    ? 'x-vercel-forwarded-for'
    : process.env.ADMIN_LOGIN_IP_HEADER;

  if (!headerName) {
    if (process.env.NODE_ENV !== 'production') return 'local-development';
    throw new Error('Admin login requires a trusted client IP header.');
  }

  const address = headers.get(headerName)?.trim();
  if (!address || !isIP(address)) {
    throw new Error('Trusted client IP header is missing or invalid.');
  }
  if (isIP(address) === 4) return address;

  // URL canonicalizes equivalent IPv6 spellings, including IPv4-mapped IPv6.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }

  // Group IPv6 clients by /64 so rotating the interface identifier cannot reset
  // the IP budget. Expand :: before taking the first four hextets.
  const [left, right] = canonical.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const expanded = canonical.includes('::')
    ? [...start, ...Array(8 - start.length - end.length).fill('0'), ...end]
    : start;
  return `${expanded.slice(0, 4).map(part => part.padStart(4, '0')).join(':')}::/64`;
}

export async function consumeLoginRateLimit(
  client: SupabaseClient,
  scope: 'ip',
  identifier: string,
): Promise<LimitResult> {
  try {
    // Keyed hashes keep raw IP addresses and usernames out of the limiter table.
    const { data, error } = await client.rpc('consume_admin_login_rate_limit', {
      p_bucket_key: bucketKey(scope, identifier),
    });
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || !result || typeof result.allowed !== 'boolean' ||
        !Number.isInteger(result.retry_after_seconds) || result.retry_after_seconds < 0 ||
        result.retry_after_seconds > 900 || (!result.allowed && result.retry_after_seconds === 0)) {
      throw new Error('Rate-limit storage returned an invalid response.');
    }
    if (result.allowed) return { allowed: true };

    const minutes = Math.ceil(result.retry_after_seconds / 60);
    return {
      allowed: false,
      error: `Too many sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      retryAfterSeconds: result.retry_after_seconds,
    };
  } catch {
    // Missing migrations, database failures and malformed responses must never
    // silently disable brute-force protection or expose infrastructure details.
    return unavailable();
  }
}

export async function beginLoginAttempt(client: SupabaseClient, username: string): Promise<
  { allowed: true; attemptToken: string } | DeniedResult
> {
  try {
    const { data, error } = await client.rpc('begin_admin_login_attempt', {
      p_bucket_key: bucketKey('username', username),
    });
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || !result || !Number.isInteger(result.retry_after_seconds)) return unavailable();
    if (result.status === 'allowed' && result.retry_after_seconds === 0 &&
        typeof result.attempt_token === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.attempt_token)) {
      return { allowed: true, attemptToken: result.attempt_token };
    }
    if (result.status === 'locked' && result.retry_after_seconds > 0 && result.retry_after_seconds <= 300) {
      return denied(result.retry_after_seconds);
    }
    if (result.status === 'busy' && result.retry_after_seconds > 0 && result.retry_after_seconds <= 30) {
      return {
        allowed: false, error: 'Another sign-in is being processed. Please try again shortly.',
        retryAfterSeconds: result.retry_after_seconds,
      };
    }
    return unavailable();
  } catch {
    return unavailable();
  }
}

export async function completeLoginAttempt(
  client: SupabaseClient, username: string, attemptToken: string, succeeded: boolean,
): Promise<LimitResult> {
  try {
    const { data, error } = await client.rpc('complete_admin_login_attempt', {
      p_bucket_key: bucketKey('username', username),
      p_attempt_token: attemptToken,
      p_succeeded: succeeded,
    });
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || !result || !Number.isInteger(result.retry_after_seconds)) return unavailable();
    if (result.allowed === true && result.retry_after_seconds === 0) return { allowed: true };
    if (result.allowed === false && result.retry_after_seconds > 0 && result.retry_after_seconds <= 300) {
      return denied(result.retry_after_seconds);
    }
    return unavailable();
  } catch {
    return unavailable();
  }
}
