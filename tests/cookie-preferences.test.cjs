const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');

const filename = path.resolve(__dirname, '../lib/cookie-preferences.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { readCookiePreferences, serializeCookiePreferences } = loaded.exports;

test('absence of a preference, including admin-only cookies, never enables media', () => {
  assert.equal(readCookiePreferences(''), null);
  assert.equal(readCookiePreferences('custom_admin_session=signed-admin-token'), null);
});

test('both choices round-trip alongside unrelated cookies', () => {
  for (const optionalMedia of [false, true]) {
    const header = `other=value; ${serializeCookiePreferences(optionalMedia, false).split(';')[0]}; another=value`;
    assert.deepEqual(readCookiePreferences(header), { version: 1, optionalMedia });
  }
});

test('malformed, incomplete, or obsolete preferences fail closed', () => {
  for (const value of ['%broken', 'null', '[]', '{}', '{"optionalMedia":true}', '{"version":0,"optionalMedia":true}', '{"version":1,"optionalMedia":"true"}']) {
    assert.equal(readCookiePreferences(`gt_cookie_preferences=${encodeURIComponent(value)}`), null);
  }
});

test('a similarly named cookie cannot opt a visitor in', () => {
  assert.equal(readCookiePreferences('other_gt_cookie_preferences=%7B%22version%22%3A1%2C%22optionalMedia%22%3Atrue%7D'), null);
});

test('preferences use session duration and HTTPS security without form information', () => {
  const cookie = serializeCookiePreferences(true, true);
  assert.match(cookie, /; Path=\//);
  assert.match(cookie, /; SameSite=Lax/);
  assert.match(cookie, /; Secure$/);
  assert.doesNotMatch(cookie, /Expires=|Max-Age=|Domain=/i);
  assert.deepEqual(Object.keys(readCookiePreferences(cookie)), ['version', 'optionalMedia']);
  assert.doesNotMatch(serializeCookiePreferences(false, false), /; Secure/);
});
