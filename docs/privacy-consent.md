# Form notices and cookie preferences

The payment, loan pre-application, inquiry, and contact forms validate their fields
before opening the shared cookies/privacy dialog. No submission takes place until
the visitor acknowledges the form notice and continues. Cancel, Escape, closing
the dialog, or navigating away cancels that attempt and preserves the entered
values. Each subsequent submission gets its own notice.

Cookie choices and form acknowledgement are separate. Both cookie buttons permit
submission; optional media is never required. No marketing opt-in is collected.
The loan form additionally requires authorization to disclose the specified
information to the named bank. Changing banks clears that authorization. Its
existing `loan_preapp.is_agreed` field continues to store the authorization flag.

## Storage and controls

- `gt_cookie_preferences` stores only `{version: 1, optionalMedia: boolean}`.
  It is a browser-session cookie, uses `SameSite=Lax` and `Path=/`, and has
  `Secure` on HTTPS. It is readable by the client because it controls UI loading;
  it must never authorize a user or contain personal information.
- `custom_admin_session` remains the separate HttpOnly admin login cookie.
  Submitting a public form does not create an account or authentication session.
- YouTube iframe/thumbnail and Google map components are not mounted until
  optional media is enabled. Changing Cookie settings to necessary-only removes
  them. Previously set provider cookies must be cleared through browser controls.
- Cookie settings are available in the footer, on all four forms, and at
  `/cookie-notice`. If browser cookies are blocked, choices last only in the
  provider's memory until a reload.

## Policy and verification boundaries

The supplied October 30, 2026 policy is a draft with unresolved controller names,
DPO contacts, retention periods, providers, and cookie placeholders. It has not
been published over the existing Privacy Policy. Legal needs to supply those
facts before that separate policy update. The Cookie Notice documents the
implemented local behavior; actual third-party cookies, hosting cookies, and
retention require a check of the deployed site.

This UI is not a server-side consent ledger or a replacement for authorization,
CSRF protection, or submission validation. Cookie preferences are not proof of
an individual's consent. No new database columns or migrations were introduced.
If consent evidence is required per referral, add server-side storage of the
notice version, selected bank, timestamp, and submission reference alongside the
existing authorization flag, using an approved retention policy.

The payment page retains the payment wizard, server action, and Turnstile
verification. Verification is checked again after privacy review in case it
expires while the dialog is open. Loan referrals use their shared validation
schema and server action; this consent UI does not write loan data directly.

## Manual checks

Automated preference parsing/security checks: `node --test tests/cookie-preferences.test.cjs`.

1. Clear the site's cookies. Videos and maps should show a settings placeholder.
2. Try an invalid form: show field errors without opening the consent dialog.
3. Submit a valid form: acknowledgement is initially unchecked and both continue
   buttons are disabled. Cancel or Escape must preserve fields and send nothing.
4. Acknowledge, choose necessary-only, and continue: only the original requested
   submission runs. Cookie values must contain no form information.
5. Enable optional media in Cookie settings: maps and video thumbnails load;
   the video iframe loads when played. Disable it again: media is removed.
6. On the loan form, select a bank and authorize the referral. Changing the bank
   must clear the authorization. The consent notice must name the selected bank.
7. Check keyboard focus remains in the native dialog and returns when closed;
   check a narrow viewport and a second submission after success/cancellation.
