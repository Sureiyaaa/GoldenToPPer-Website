# Cloudflare Turnstile CAPTCHA Setup Guide

## Overview

This document describes how to configure Cloudflare Turnstile CAPTCHA for the Golden Topper admin login page.

Turnstile is a bot-management service that verifies users without traditional CAPTCHA friction. The implementation follows a client-side widget + server-side verification model.

## Environment Variables

Two environment variables are required:

### `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`
- **Visibility**: Public (client-side)
- **Used by**: Turnstile widget on the login page
- **Purpose**: Identifies which site configuration to use
- **Location**: Can be stored in `.env.local`, `.env`, or deployment provider secrets

### `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- **Visibility**: Secret (server-side only)
- **Used by**: `loginAction()` in `app/actions/auth.ts` for token verification
- **Purpose**: Authenticates requests to Cloudflare Siteverify API
- **Location**: `.env.local` (local dev) or deployment provider secrets (production)
- **Security**: Must never be exposed to client-side code; only accessed in server actions

## Getting Credentials from Cloudflare

### Step 1: Create or Log Into Cloudflare Account
- Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
- Sign up for free if you don't have an account (Turnstile is free-tier)

### Step 2: Navigate to Turnstile
- In the left sidebar, find **Turnstile**
- Click to open the Turnstile dashboard

### Step 3: Create a New Site
- Click **Create Site** or **Add Site**
- Fill in the configuration:

#### For Local Development
- **Domain**: `localhost`
- **Mode**: Managed Challenge (recommended)
- **Widget Mode**: Implicit (auto-verify)

#### For Production
- **Domain**: `yourdomain.com` (your actual production domain)
- **Mode**: Managed Challenge
- **Widget Mode**: Implicit

**Important**: Create separate site configurations for development and production. Turnstile validates that the domain where the widget is loaded matches the configured domain.

### Step 4: Copy Credentials
After creating the site, you'll see two keys:
- **Site Key**: Copy this → `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`
- **Secret Key**: Copy this → `CLOUDFLARE_TURNSTILE_SECRET_KEY`

## Test Credentials (Development Only)

Cloudflare provides test credentials for development environments. These keys work on **any domain** (including localhost) and are useful for CI/CD and local testing.

For the complete and authoritative list of test keys, see:
[Cloudflare Turnstile Testing Documentation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

### Standard Test Keys

#### Always-Pass (Simulates successful verification)
```
Site Key:   1x00000000000000000000AA
Secret Key: 1x0000000000000000000000000000000AA
```

**Behavior**: Widget is immediately considered "verified" without user interaction. Useful for automated testing and CI/CD.

#### Always-Block (Simulates verification failure)
```
Site Key:   3x00000000000000000000BB
Secret Key: 2x0000000000000000000000000000000BB
```

**Behavior**: Widget always fails verification. Useful for testing error handling and retry logic.

#### Always-Challenge (Interactive verification)
```
Site Key:   4x4d61696c626f7800000000
Secret Key: 2x4d61696c626f7800000000
```

**Behavior**: Widget presents an interactive challenge. Useful for testing realistic bot detection flow.

### Additional Test Scenarios

Cloudflare provides additional test keys for specific scenarios (timeout simulation, network errors, etc.). Refer to the [official testing guide](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) for complete options.

**⚠ Important**: Test credentials must never be used in production. Replace with real credentials before deploying to production environments.

## Local Development Setup

1. **Copy `.env.example` to `.env.local`** (if not already present):
   ```bash
   cp .env.example .env.local
   ```

2. **Add Turnstile credentials to `.env.local`**:
   ```
   NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
   ```

3. **Restart the development server**:
   ```bash
   npm run dev
   ```

4. **Test the login page**:
   - Navigate to `http://localhost:3000/admin`
   - You should see the Turnstile widget below the password field
   - Complete the widget verification
   - Submit the form to test end-to-end

## Production Setup

1. **Create a Cloudflare site for your production domain**
2. **Store credentials securely**:
   - Add to your deployment provider's secrets management (Vercel, AWS, etc.)
   - Never commit real keys to git
3. **Set environment variables**:
   - `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` (public)
   - `CLOUDFLARE_TURNSTILE_SECRET_KEY` (secret)
4. **Verify on deployment**:
   - Confirm Turnstile widget appears on login page
   - Test login flow end-to-end

## Verifying Configuration

After adding environment variables, you can verify the setup:

```bash
# Check that env vars are readable (server-side only)
npm run dev
# Visit http://localhost:3000/admin and inspect the network tab for Siteverify API calls
```

The Cloudflare Siteverify API endpoint is:
```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
```

The loginAction server function will make this request with the token and secret key.

## Troubleshooting

### Widget doesn't appear on login page
- Ensure `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` is set in `.env.local`
- Restart dev server after setting env var
- Check browser console for errors

### "CAPTCHA verification failed"
- Verify `CLOUDFLARE_TURNSTILE_SECRET_KEY` is correct and matches the site
- Ensure the domain in Cloudflare matches where you're testing (localhost vs. production)
- Check server logs for Siteverify API response errors

### Token verification errors
- Test credentials may fail if domain doesn't match exactly
- For localhost development, use Cloudflare's always-pass test keys
- For production, ensure production domain is configured in Cloudflare

## Security Considerations

1. **Secret Key Protection**:
   - The `CLOUDFLARE_TURNSTILE_SECRET_KEY` is only accessed in `app/actions/auth.ts` (server-side)
   - It never leaves the server; it's not exposed to the browser
   - Never add `CLOUDFLARE_TURNSTILE_SECRET_KEY` to `NEXT_PUBLIC_*` prefixed variables

2. **Token Lifecycle**:
   - Turnstile tokens expire after ~5 minutes
   - Server verification checks token validity
   - Tokens are single-use and cannot be reused

3. **Integration with Existing Auth**:
   - Turnstile verification occurs **before** username/password validation
   - Failed CAPTCHA verification blocks credential checking
   - Existing session management and timeout controls remain unchanged

## References

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile API Reference](https://developers.cloudflare.com/turnstile/get-started/)
- [Siteverify Endpoint](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
