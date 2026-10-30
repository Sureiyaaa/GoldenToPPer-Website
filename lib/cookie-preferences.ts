export const COOKIE_PREFERENCES_NAME = 'gt_cookie_preferences';
export const COOKIE_PREFERENCES_VERSION = 1;

export type CookiePreferences = {
  version: typeof COOKIE_PREFERENCES_VERSION;
  optionalMedia: boolean;
};

export function readCookiePreferences(cookieHeader: string): CookiePreferences | null {
  const value = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_PREFERENCES_NAME}=`));
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value.slice(COOKIE_PREFERENCES_NAME.length + 1)));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const preference = parsed as Record<string, unknown>;
    if (preference.version !== COOKIE_PREFERENCES_VERSION || typeof preference.optionalMedia !== 'boolean') return null;
    return { version: COOKIE_PREFERENCES_VERSION, optionalMedia: preference.optionalMedia };
  } catch {
    return null;
  }
}

export function serializeCookiePreferences(optionalMedia: boolean, secure: boolean): string {
  const value: CookiePreferences = { version: COOKIE_PREFERENCES_VERSION, optionalMedia };
  // No Expires/Max-Age: this is a browser-session preference, not a login token.
  return `${COOKIE_PREFERENCES_NAME}=${encodeURIComponent(JSON.stringify(value))}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}
