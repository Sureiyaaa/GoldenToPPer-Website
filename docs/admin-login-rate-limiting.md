# Admin login rate limiting

The login server action enforces two shared database limits in addition to
Cloudflare Turnstile:

| Scope | Budget | When consumed |
| --- | --- | --- |
| IP address (IPv6 /64) | 30 requests per 15 minutes | Before input and CAPTCHA validation |
| Normalized username | 5 failed logins within 15 minutes trigger a 5-minute lock | Credential failures after valid CAPTCHA |

The fifth failed login immediately starts a full five-minute account lockout.
Successful logins reset account failures and do not count toward the threshold.
The failure counter also resets when its 15-minute window expires, or when the
five-minute lock expires. Requests during a lock do not extend it. Username
limits apply across IPs and include nonexistent and inactive accounts. CAPTCHA
and infrastructure failures do not count as credential failures. The separate
IP budget continues counting every request in a 15-minute window, including
successful requests, and is not reset by successful logins.

The sign-in button displays a live `05:00` countdown on the fifth failure and disables
the username/password fields, password visibility toggle, and submission until
it expires. An absolute deadline in tab-scoped session storage
preserves the timer on refresh; background tabs catch up using wall-clock time.
An IP limit response also uses the countdown with its actual remaining duration.
Browser storage contains only the retry timestamp, not credentials or usernames.
The server enforces the limit even when requests bypass the login UI.
Missing storage, RPC errors, and invalid trusted IP headers block login with a
generic temporary-unavailability message. Existing sessions are unaffected.

## Deployment

1. Apply both migrations in order to the intended Supabase database **before
   deploying the application change**:
   `supabase/migrations/20261104060532_add_admin_login_rate_limits.sql`, then
   `supabase/migrations/20261104061451_add_admin_login_failed_attempt_lockout.sql`.
   If the first is already applied, apply only the second. They add limiter
   tables, indexes, and RPCs without modifying admin accounts.
2. On Vercel, `VERCEL=1` automatically selects `x-vercel-forwarded-for`.
   No additional environment variable is needed there.
3. On another production host, set `ADMIN_LOGIN_IP_HEADER` to the header your
   trusted reverse proxy overwrites with a single client IP. Prevent clients
   from reaching the app without that proxy. Forwarded client-supplied headers
   are unsafe. Without this configuration, production login fails closed.
4. Check a normal login, then use an isolated test account to verify that the
   fifth CAPTCHA-verified wrong password starts `05:00`. Refresh and check that
   the timer continues. The server rejects even correct credentials during the
   lock, and permits login once it expires. Do not test against an active admin
   unless a temporary lockout is acceptable.

Local development uses a shared `local-development` IP bucket when no trusted
header is configured. The database migration is still required locally.

## Database deployment record: November 4, 2026

Both migrations were applied to the existing **Goldentopper** Supabase project
(`bozkbnqydmpadcbbwpnb`). Their original versions, `20261104060532` and
`20261104061451`, are recorded in its migration history. Deployment used an
isolated migration directory containing only these two files; older repository
migrations were not applied.

Verification against the deployed database confirmed the fifth-failure
five-minute lock, successful-login reset, rejection during the lock, admission
after expiry, and the 30-request IP limit. Synthetic verification writes were
rolled back. RLS and service-role-only table/function permissions were checked.
All three RPCs were also reached using the application's configured service
credentials, with deliberately invalid arguments that changed no counters.
No actual admin account or password was used in these checks.

The security advisor still reports preexisting public access to legacy admin
functions, including `create_admin_user`, `update_admin_user`, and
`verify_admin_login`. Those functions need an access review; deploying the new
server-action limiter does not restrict these other entry points. See the
[Supabase advisory and remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

This record covers the database deployment. Website publishing is a separate
step; the application changes are still in the local working tree.

## Storage and operational behavior

The IP counter uses an atomic Postgres upsert. Account checks use a row lock and
a 30-second, single-use, server-only attempt lease to serialize password checks
per username. This prevents concurrent requests from racing past five failures
without counting pending or successful checks as failed credentials. Crashed
checks expire after 30 seconds; stale or replayed completions cannot issue a
session or change the failure count. Concurrent checks receive a short retry
message. Counters and locks are shared across app instances and restarts.

Both tables have RLS enabled, no browser policies, and privileges restricted to
`service_role`. The RPCs use invoker permissions and are executable only by
`service_role`. Keys contain HMAC-SHA256 digests, not raw usernames or addresses;
the existing server-only service-role key supplies the HMAC secret. Rotating it
also changes bucket identities. No new external service is required.

An indexed cleanup removes up to 100 rows that expired more than one day ago
on each IP limiter call or admitted account check. Without login traffic,
expired rows remain until a later call. Attempts are capped to avoid overflow.

Run `npm run test:auth` for SQL and server-action tests, and `npm run test:auth-ui`
for the real page/countdown test in an isolated Chrome/Chromium browser. Set
`CHROME_PATH` when the browser is not installed at a standard location. Tests
use fixtures and an isolated local Postgres engine, never live credentials.

An attacker who can repeatedly pass CAPTCHA can temporarily exhaust a known
username's budget; legitimate users then wait for its window to expire. Shared
office IPs share the IP budget. Edge firewall limits can additionally protect
the application and database from high-volume traffic.

References: [Vercel request headers](https://vercel.com/docs/headers/request-headers),
[Supabase function security](https://supabase.com/docs/guides/database/functions#secure-a-database-function).
