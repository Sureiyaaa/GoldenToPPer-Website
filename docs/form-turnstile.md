# Cloudflare Turnstile for public forms

The loan pre-application (`/partnerbanks`), project inquiry (`/inquire`), and
contact (`/contact`) forms use a shared widget and server-side verifier.

| Form | Turnstile action | Submission action |
| --- | --- | --- |
| Loan pre-application | `loan_application` | `submitLoanPreApplicationAction` |
| Project inquiry | `inquiry` | `submitInquiryAction` |
| Contact request | `contact` | `submitContactAction` |

All three reuse `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, as
the existing payment and admin login do. This change requires no database
migration or new Cloudflare widget. Deploy the application changes together so
the forms send the new required token argument to their server actions.

The Cloudflare widget must allow the website's hostnames. Production verification
also checks the exact hostname against `TURNSTILE_ALLOWED_HOSTNAMES`, defaulting
to `goldentopper.vercel.app,www.goldentopper.vercel.app`. For a custom domain,
set this comma-separated hostname list and allow the domain in Cloudflare.
Vercel previews require `ALLOW_PREVIEW_CAPTCHA_HOSTS=true` and accept the exact
`VERCEL_URL`/`VERCEL_BRANCH_URL`, plus the configured allowed hosts.

Local development can use Cloudflare's documented test site/secret keys. Test
secrets are rejected in production and Vercel deployments. Only local dummy-key
verification accepts Cloudflare's fixed `test` action; real tokens must match
the form's action in every environment.

The browser disables submission until verified, checks the current token before
opening the existing privacy notice, and reads it again after acceptance. A
token that expires while reading the notice prevents submission. Cancelling the
notice sends nothing and preserves the form and token. Every submitted attempt
resets verification, including server rejections and network failures. Form
data remains available after a failure. Loan bank authorization is unchanged.

Each mounted form owns its widget. Closing/reopening the loan modal and
returning to the contact form after success create fresh widgets. The SDK script
is shared, and narrow containers use the compact widget. Expired, errored, or
unavailable widgets leave submission disabled and show a verification message.

Server actions validate through Cloudflare Siteverify before querying or
changing customer data. Missing/malformed tokens, verification failure,
action/hostname mismatch, expired/reused tokens, provider errors, and missing
configuration are rejected. Tokens are passed separately from form fields and
are never stored in the customer records. The secret stays on the server.
Cloudflare receives the verification token and widget context; this integration
does not include customer form fields in Siteverify requests.

Run `npm run test:forms` for server and submission-flow regressions, and
`npm run test:forms-ui` for widget isolation, expiry, retry, script failure and
modal lifecycle checks in an isolated Chrome/Chromium browser. Set `CHROME_PATH`
if needed. Tests use local fixtures and never submit real customer records.

References: [embedding widgets](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/),
[server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
