# Slice 3: Server-Side CAPTCHA Verification — Testing Guide

## Overview

Slice 3 implements Cloudflare Turnstile verification on the server before credential validation. This document covers testing procedures to verify security, functionality, and backward compatibility.

---

## Test Environment Setup

### Important: Server Action Testing
The authentication is implemented via Next.js Server Action (`loginAction()` in `app/actions/auth.ts`), not a REST API endpoint. Tests must be conducted through:
- Form submission in the UI
- React DevTools or browser console to manipulate form state
- Network tab inspection to observe server responses
- Server logs to verify CAPTCHA verification flow

### Prerequisites
1. Environment variables configured in `.env.local`:
   ```
   NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=<test-key>
   CLOUDFLARE_TURNSTILE_SECRET_KEY=<test-secret>
   ```

2. Use Cloudflare test keys for development:
   - Always-pass: `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`
   - Always-fail: `3x00000000000000000000BB` / `2x0000000000000000000000000000000BB`

3. Development server running: `npm run dev`

---

## Security Test Cases

### Test 1: Missing CAPTCHA Token (Server-Action Level)
**Scenario**: Submit login form without CAPTCHA token (bypass Slice 2 widget)

**Method** (Client-side UI bypass):
1. Open browser DevTools → Console
2. Manually invoke loginAction with FormData missing captchaToken:
```javascript
import { loginAction } from '@/app/actions/auth';
const fd = new FormData();
fd.append('username', 'admin');
fd.append('password', '<test-password>');
// Intentionally omit captchaToken
const result = await loginAction(fd);
console.log(result);
```

**Expected Result**:
- Server logs show: `[AUTH] 3. Verifying CAPTCHA token...`
- Server returns: `{ error: "CAPTCHA token is required." }`
- No username/password lookup executes (no step 5 in logs)
- No database queries sent
- No session created

**Actual Result**: ✅ [To be verified during testing]

---

### Test 2: Empty CAPTCHA Token
**Scenario**: Submit login with empty string CAPTCHA token

**Method**: Use React DevTools or modify form submission:
1. Complete CAPTCHA normally
2. Before form submission, use React DevTools to clear `captchaToken` state to empty string
3. Submit form

Alternatively, modify handleLogin in dev to pass empty token:
```javascript
formDataObj.append('captchaToken', '');  // Override with empty
```

**Expected Result**:
- Server returns: `{ error: "CAPTCHA token is required." }`
- No database queries execute
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 3: Malformed CAPTCHA Token
**Scenario**: Submit login with invalid token format (too short, garbage characters)

**Method**: Browser dev tools to intercept and modify FormData:
```javascript
// Modify token before submission in handleLogin()
const token = "invalid_garbage_token_12345";
// Send with credentials
```

**Expected Result**:
- Cloudflare Siteverify returns error
- Server returns user-friendly message (not technical error)
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 4: Token Exceeding Length Limit
**Scenario**: Submit token longer than 2048 characters

**Method**:
```javascript
const longToken = 'a'.repeat(2049);
// Submit in FormData
```

**Expected Result**:
- Server rejects before API call: `{ error: "CAPTCHA token is invalid." }`
- No Siteverify API call made
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 5: Expired CAPTCHA Token
**Scenario**: Use always-pass token, wait ~5 minutes, then submit

**Method**:
1. Complete CAPTCHA on login page (widget token received)
2. Wait 5+ minutes
3. Attempt to submit form
4. Browser should show widget error (Slice 2)
5. If bypassed and sent to server anyway:

**Expected Result**:
- Cloudflare returns: `error-codes: ["timeout-or-duplicate"]`
- Server returns: `{ error: "Security verification expired or was already used. Please try again." }`
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 6: Previously Used CAPTCHA Token (Replay)
**Scenario**: Use same token twice

**Method**:
1. Capture token from first login attempt (e.g., via network tab)
2. Complete first login (success or failure)
3. Attempt second login with same token

**Expected Result**:
- Cloudflare rejects: `error-codes: ["timeout-or-duplicate"]`
- Server returns: `{ error: "Security verification expired or was already used. Please try again." }`
- Token is single-use

**Actual Result**: ✅ [To be verified]

---

### Test 7: Invalid Hostname (Production Mode)
**Scenario**: Spoof hostname in Siteverify response (simulated)

**Note**: This test requires mocking Cloudflare response, which is complex in local dev. In production, this validates that the login came from goldentopper.vercel.app, not a phishing clone.

**Method**: 
- Skip in local testing; hostname validation skipped when `NODE_ENV !== 'production'`
- Verify in production deployment

**Expected Result** (in production):
- Cloudflare response includes `hostname: "malicious.com"`
- Server rejects: `{ error: "Security verification failed due to hostname mismatch." }`

**Actual Result**: ✅ [Skipped in dev; will verify in prod]

---

### Test 8: CAPTCHA Secret Key Missing
**Scenario**: Secret key not set in `.env.local`

**Method**:
1. Unset or remove `CLOUDFLARE_TURNSTILE_SECRET_KEY` from `.env.local`
2. Restart dev server
3. Attempt login with CAPTCHA

**Expected Result**:
- Server returns: `{ error: "Security verification is not configured. Please contact support." }`
- Error logged: `[AUTH] CAPTCHA_SECRET_KEY not configured`
- No API call to Cloudflare
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 9: Cloudflare API Unreachable (Network Failure)
**Scenario**: Siteverify API is down or network connection fails

**Method**:
1. Set up network failure simulation (e.g., browser dev tools throttling, firewall block)
2. Attempt login with valid CAPTCHA widget token

**Expected Result**:
- Fetch request times out or fails
- Server catches error: `[AUTH] CAPTCHA verification error: <error-message>`
- Returns: `{ error: "Unable to verify security challenge. Please try again." }`
- No session created
- No credentials checked

**Actual Result**: ✅ [To be verified]

---

### Test 10: Cloudflare API Timeout
**Scenario**: Siteverify API takes longer than 10 seconds to respond

**Method**:
- Simulate slow API response (e.g., network throttling)
- Observe 10-second timeout

**Expected Result**:
- AbortError caught
- Server returns: `{ error: "Security verification timed out. Please try again." }`
- Logged: `[AUTH] CAPTCHA verification timed out`
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 11: Malformed Cloudflare API Response
**Scenario**: API returns invalid JSON or unexpected response structure

**Method**:
- Mock Cloudflare endpoint to return malformed JSON
- Or intercept response and corrupt it

**Expected Result**:
- JSON.parse() fails
- Caught as error: `[AUTH] CAPTCHA verification error: <error-message>`
- User sees: `{ error: "Unable to verify security challenge. Please try again." }`
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 12: Always-Fail Test Key
**Scenario**: Use Cloudflare always-fail test credentials

**Method**:
1. Set `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=3x00000000000000000000BB`
2. Set `CLOUDFLARE_TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000BB`
3. Complete CAPTCHA on login page (will show as failed)
4. Attempt login

**Expected Result**:
- Widget shows failure (Slice 2)
- Button remains disabled
- If somehow token sent to server anyway:
  - Cloudflare returns `success: false`
  - Server rejects: `{ error: "Security verification failed. Please try again." }`

**Actual Result**: ✅ [To be verified]

---

## Regression Test Cases

### Test 13: Valid CAPTCHA + Valid Credentials
**Scenario**: Complete normal login flow with correct credentials

**Method**:
1. Set `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (always-pass)
2. Navigate to http://localhost:3000/admin
3. Complete CAPTCHA widget
4. Enter username: `admin`
5. Enter password: `<test-password>`
6. Click Sign In

**Expected Result**:
- CAPTCHA verification succeeds (token accepted)
- Server looks up username in DB
- Password verified with bcrypt
- Session cookie created
- Redirect to `/admin/dashboard`
- Dashboard loads with authenticated state

**Actual Result**: ✅ [To be verified]

---

### Test 14: Valid CAPTCHA + Invalid Username
**Scenario**: CAPTCHA succeeds, but username doesn't exist

**Method**:
1. Complete CAPTCHA (always-pass keys)
2. Enter username: `nonexistent`
3. Enter password: `<test-password>`
4. Click Sign In

**Expected Result**:
- CAPTCHA verification succeeds
- Username lookup: user not found
- Server returns: `{ error: "Invalid username." }`
- No session created
- Login page shows error banner (Slice 2)
- Widget resets for retry

**Actual Result**: ✅ [To be verified]

---

### Test 15: Valid CAPTCHA + Invalid Password
**Scenario**: CAPTCHA succeeds, username found, but password wrong

**Method**:
1. Complete CAPTCHA (always-pass keys)
2. Enter username: `admin`
3. Enter password: `WrongPassword`
4. Click Sign In

**Expected Result**:
- CAPTCHA verification succeeds
- Username lookup: user found
- bcrypt password comparison fails
- Server returns: `{ error: "Invalid password." }`
- No session created
- Login page shows error banner
- Widget resets

**Actual Result**: ✅ [To be verified]

---

### Test 16: Multiple Failed Logins (Retry Flow)
**Scenario**: User fails CAPTCHA or password check multiple times

**Method**:
1. Attempt 1: Complete CAPTCHA, enter wrong password → Fails
2. Widget resets (Slice 2 logic)
3. Attempt 2: Complete CAPTCHA again, enter wrong password → Fails
4. Attempt 3: Complete CAPTCHA again, enter correct password → Succeeds

**Expected Result**:
- Each attempt requires fresh CAPTCHA verification
- Each wrong attempt doesn't bypass on retry
- Eventually succeeds when credentials correct
- Session created on success
- No rate-limiting (yet) but CAPTCHA provides bot protection

**Actual Result**: ✅ [To be verified]

---

### Test 17: Disabled Admin Account
**Scenario**: Account exists and password correct, but is_active = false

**Method**:
1. Using Supabase dashboard, set admin user's `is_active` to `false`
2. Complete CAPTCHA (always-pass)
3. Enter correct username and password
4. Click Sign In

**Expected Result**:
- CAPTCHA verification succeeds
- Username lookup: user found
- Password verification: succeeds
- Active-user check: fails (is_active === false)
- Server returns: `{ error: "Account disabled. Contact an admin." }`
- No session created

**Actual Result**: ✅ [To be verified]

---

### Test 18: Successful Login → Dashboard Access
**Scenario**: After successful login, verify session and dashboard access

**Method**:
1. Complete full login flow (CAPTCHA + valid credentials)
2. Confirm redirect to `/admin/dashboard`
3. Verify dashboard loads
4. Navigate between admin pages (/admin/users, etc.)
5. Verify session persists

**Expected Result**:
- Session cookie set with correct HMAC signature
- Dashboard loads without requiring re-login
- Navigation between admin pages works
- Session validation (getCustomSession) succeeds

**Actual Result**: ✅ [To be verified]

---

### Test 19: Session Timeout Unaffected
**Scenario**: Verify 1-hour inactivity timeout still works

**Method**:
1. Log in successfully
2. Leave browser idle for 1 hour
3. Attempt to access admin page

**Expected Result**:
- SessionTimeout component (Slice 2) logs user out
- Redirect to `/admin?expired=true`
- Requires fresh login (CAPTCHA + credentials)
- Existing session behavior unchanged

**Actual Result**: ✅ [To be verified]

---

### Test 20: Logout Still Works
**Scenario**: Verify logout functionality unchanged

**Method**:
1. Log in successfully
2. Click logout button (if exists in UI)
3. Or manually call `logoutAction()`

**Expected Result**:
- Session cookie deleted
- Redirect to login page
- Attempting to access `/admin/dashboard` redirects to `/admin`
- No session carried over

**Actual Result**: ✅ [To be verified]

---

## Browser & Responsiveness Tests

### Test 21: Login on Desktop (1920x1080)
**Expected**: Widget renders, login form responsive, no layout issues

**Actual Result**: ✅ [To be verified]

---

### Test 22: Login on Mobile (375x667)
**Expected**: Widget resizes, form usable on small screen, no horizontal scroll

**Actual Result**: ✅ [To be verified]

---

### Test 23: Widget Error Display
**Expected**: CAPTCHA errors show clearly below widget without affecting existing auth errors

**Actual Result**: ✅ [To be verified]

---

## Log Inspection Tests

### Test 24: Console Logs for Successful Login
**Method**: Open browser DevTools console and observe server logs

**Expected Log Output**:
```
[AUTH] 1. Login Action Triggered!
[AUTH] 2. Supabase Admin Client Initialized
[AUTH] 3. Verifying CAPTCHA token...
[AUTH] 4. CAPTCHA verification successful. Proceeding with credential validation...
[AUTH] 5. Searching DB for username: admin
[AUTH] 6. User found! Checking status...
[AUTH] 7. Checking password match via Bcrypt...
[AUTH] 8. Password matched! Setting cookie...
[AUTH] 9. Cookie set successfully. Login complete!
```

**Actual Result**: ✅ [To be verified]

---

### Test 25: Console Logs for Failed CAPTCHA
**Expected Log Output**:
```
[AUTH] 1. Login Action Triggered!
[AUTH] 2. Supabase Admin Client Initialized
[AUTH] 3. Verifying CAPTCHA token...
[AUTH] CAPTCHA verification failed: <error-message>
```

**Actual Result**: ✅ [To be verified]

---

### Test 26: No Credential Leakage in Responses, Logs, and URLs
**Scenario**: Verify that submitted credentials are not leaked beyond the browser operator

**Method**: 
1. Open DevTools → Network tab
2. Complete login flow with username, password, CAPTCHA token
3. Inspect all network responses
4. Check server console logs
5. Verify page URL doesn't contain credentials

**Expected (Legitimate Visibility)**:
- Browser FormData shows what the operator submitted (normal, operator-visible)
- Server responds with `{ error: "..." }` or `{ success: true }` only

**Expected (No Leakage)**:
- ✅ Server responses: Do NOT echo credentials, tokens, or passwords
- ✅ Server responses: Do NOT include `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- ✅ Server logs: Do NOT log actual CAPTCHA tokens
- ✅ Server logs: Do NOT log passwords
- ✅ Server logs: Do NOT log secret keys
- ✅ URLs: Do NOT contain credentials, tokens, or passwords (POST data, not query string)
- ✅ Browser console: No sensitive data logged (client-side error messages only)

**Actual Result**: [To be verified]

---

## Verification Checklist

**26 Total Test Cases** (12 security + 8 regression + 3 browser + 3 logs)

After running all tests, verify:

- ✅ All 12 security tests passed (Tests 1–12)
- ✅ All 8 regression tests passed (Tests 13–20)
- ✅ All 3 browser/UI tests passed (Tests 21–23)
- ✅ All 3 log inspection tests passed (Tests 24–26)
- ✅ No secrets exposed
- ✅ No TypeScript errors in build
- ✅ Build succeeds: `npm run build`
- ✅ No unexpected dependencies added
- ✅ Middleware unchanged
- ✅ Database schema unchanged
- ✅ Session behavior unchanged

---

## Test Approach: Real API Calls vs. Mocked Responses

### What These Tests Verify

**Real Siteverify API Calls**:
- Tests S1–S6 use Cloudflare **test credentials** (e.g., `1x00000000000000000000AA`)
- Test credentials call the **real Cloudflare Siteverify API** at `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- Cloudflare's test API returns predictable responses (always-pass, always-fail, always-challenge)
- This proves server-side implementation handles real API responses correctly

**Server-Side Validation**:
- These tests verify that the server correctly extracts, validates, and forwards tokens to Cloudflare
- They prove that error handling maps Cloudflare responses to user-friendly messages
- They confirm fail-closed behavior: all errors block credential validation

**Token Lifecycle Not Fully Proven**:
- Test credentials bypass Cloudflare's bot detection
- Single-use token enforcement is Cloudflare's responsibility (not mocked)
- Replay attack prevention cannot be fully tested with always-pass credentials
- Real-world testing requires production Cloudflare credentials with actual bot detection enabled

### What These Tests DO NOT Verify

- Real bot detection (only test credentials)
- Single-use token enforcement edge cases (Cloudflare's responsibility)
- Replay attack scenarios with actual production detection
- Performance under real botnet traffic

**Conclusion**: These tests validate implementation correctness and fail-closed behavior, but do NOT validate real bot detection capability. Production testing with real Cloudflare credentials is required before enabling bot detection in production.

---

## Known Limitations for Slice 3

1. **No Rate Limiting Yet**
   - CAPTCHA prevents automated bots
   - Does not limit human retry attempts
   - Consider adding in follow-up

2. **Test Credentials Only**
   - Using Cloudflare test keys limits realistic testing
   - Full bot detection only works with production keys
   - Plan production testing with real keys

3. **No Audit Logging**
   - Failed login attempts not logged to audit table yet
   - Consider adding in follow-up for security monitoring

4. **Hostname Validation Dev/Prod Split**
   - Skipped in development (`NODE_ENV !== 'production'`)
   - Enabled in production only
   - Requires production domain in Cloudflare config

---

## Readiness for Deployment

After all tests pass:
- ✅ Slice 3 is production-ready
- ✅ Safe to merge to main branch
- ✅ Safe to deploy to production
- ⚠️ Requires Cloudflare production credentials for goldentopper.vercel.app
- ⚠️ Does NOT require database changes
- ⚠️ Does NOT affect existing logged-in users
