# Deployed cookie audit — October 30, 2026

## Target and scope

- Confirmed by the project owner: <https://goldentopper.vercel.app>.
- Browser run started at 10:16 Asia/Shanghai (02:16 UTC), October 30, 2026.
- Fresh isolated Chrome 156 profile, without existing cookies or accounts.
- Visited `/`, `/projects`, `/payment`, `/partnerbanks`, `/contact`, `/inquire`,
  `/admin`, and `/cookie-notice`, and attempted to find cookie settings.
- All non-GET/HEAD/OPTIONS requests to the deployment were blocked. This also
  blocked payment read-only server actions, so the payment review step and its
  CAPTCHA could not be fully exercised. No form submission, login, payment,
  manual CAPTCHA completion, or live database mutation was performed.
- Cookie **values**, credentials, tokens, and form data were not saved.

## Observations

| Item | Observed result | What this establishes |
| --- | --- | --- |
| Main-page HTTP responses | No `Set-Cookie` header on the inspected page responses | Does not cover cookies from later scripts, API responses, login, or third-party frames |
| Supabase service responses | `Set-Cookie: __cf_bm` from the project's `*.supabase.co` service; requested domain `supabase.co`, path `/`, `Secure`, `HttpOnly`, `SameSite=None`, expiry about 30 minutes after response | A provider attempted to set a security cookie; this is not a Turnstile token |
| Browser cookie jar | Empty at each inspected checkpoint | No cookies were retained in this browser run; this does not prove that other browsers will retain none |
| Rejected provider cookie | One `__cf_bm` response explicitly reported `InvalidDomain` | At least one provider cookie was rejected; absence of a blocked reason on other events is not proof of acceptance |
| Turnstile | Script and requests to `challenges.cloudflare.com` on `/payment` and `/admin` | Turnstile is present on the live deployment, not just the local checkout |
| `cf_clearance` | Not observed in response names or stored cookies | Pre-clearance is not verified; do not claim the cookie is always issued or assign a fixed expiry |
| Admin authentication cookie | Not observed because the audit did not log in | Name, flags, and seven-day duration are source-confirmed only |
| Preference cookie | Not observed; no cookie settings buttons found | The local preference controls cannot yet be verified on the deployment |
| Cookie Notice | `/cookie-notice` returned HTTP 404 in the separate HTTP check | The notice in this checkout is not yet available at that deployment |
| Google map tiles | Requests to `mt0.google.com` through `mt3.google.com` on `/projects`, without a cookie choice | The live build does not yet apply this checkout's optional-media gate |
| YouTube cookies | Not observed; the video was not played | Video playback cookies remain unverified |
| Browser storage | No local/session storage keys at the anonymous checkpoints | Authenticated admin storage remains unverified |

The non-`www` URL works. The `www.goldentopper.vercel.app` hostname referenced
in some project metadata failed TLS hostname validation. The audit did not
bypass the certificate check or use that hostname as the deployment target.

## Source-confirmed inventory for the updated checkout

| Technology | Purpose | Lifetime / evidence |
| --- | --- | --- |
| `gt_cookie_preferences` | Remembers optional-media choice, without personal/form data | Browser-session cookie, `Path=/`, `SameSite=Lax`, `Secure` on HTTPS; `lib/cookie-preferences.ts` |
| `custom_admin_session` | Admin authentication | Up to seven days, HttpOnly, `SameSite=Lax`, Secure in production; `app/actions/auth.ts` |
| `last_admin_activity` local storage | Admin inactivity timer | No browser-managed expiry; the UI uses a one-hour inactivity limit and removes the key on timeout/logout |
| `admin-news-search` session storage | Admin news-search state | Tab session; `app/admin/dashboard/page.tsx` |
| Turnstile token | Bot verification on payment and admin login | Single-use, five-minute validity; token expiry is not provider data-retention duration |

Cloudflare documents the token in [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
conditional clearance cookies in [clearance documentation](https://developers.cloudflare.com/cloudflare-challenges/concepts/clearance/),
the security cookie's purpose and inactivity period in [Cloudflare Cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/),
and technical signals in the [Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/).

## Repeatable audit

Run from the repository with Chrome or Edge installed:

```powershell
node scripts/audit-deployed-cookies.cjs https://goldentopper.vercel.app .next/deployed-cookie-audit.json
```

`COOKIE_AUDIT_BROWSER` can select an installed Chrome/Edge executable. The script
uses a fresh profile under ignored `.next/` and saves cookie metadata only.
The raw metadata report for this run is `.next/deployed-cookie-audit.json`;
ignored files are not part of the turnover package.

## Remaining verification

1. Deploy the updated checkout, then repeat necessary-only, optional-media, and
   withdrawal tests on the live domain. Confirm `/cookie-notice` returns 200.
2. In an authorized interactive session, inspect cookies after admin login and
   after completing payment verification without making a real payment. Confirm
   logout and expiration. No credentials are required in the audit report.
3. Inspect video playback with optional media enabled, including accepted and
   rejected third-party cookies and their actual attributes.
4. Confirm the Cloudflare dashboard pre-clearance configuration before calling
   `cf_clearance` an active cookie or documenting its configured duration.
5. After turnover, repeat on the new domain. Confirm new cookie scopes, HTTPS,
   Turnstile hostname configuration, provider changes, and third-party behavior.

This is an anonymous read-only snapshot of the currently deployed build, not an
exhaustive audit of all authenticated, provider, browser, or future domain states.
