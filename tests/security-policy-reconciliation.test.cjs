const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('../scripts/reconcile-security-metadata.cjs');
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261110010000_harden_cms_browser_grants.sql'), 'utf8');
const policies = require('../supabase/inspection/phase-1.6c-reviewed-policies.json');

test('offline evidence parsing handles quoted SQL commas, escaped quotes, CRLF and missing trailing newline', () => {
  assert.deepEqual(parseCsv('table_name,definition\r\nexample,"CHECK (x IN (1,2))"\r\nexample,"a ""quoted"" name"'), [
    { table_name: 'example', definition: 'CHECK (x IN (1,2))' },
    { table_name: 'example', definition: 'a "quoted" name' },
  ]);
  assert.throws(() => parseCsv('a,b\n1'), /unexpected width/);
  assert.throws(() => parseCsv('a\n"unclosed'), /Unclosed/);
});

test('every existing-policy drop corresponds exactly to the reviewed CSV-derived manifest', () => {
  const expected = Object.entries(policies).flatMap(([table, names]) => names.map(name => ({ table, name })));
  const actual = [...sql.matchAll(/drop policy if exists "([^"]+)" on public\.(?:"([^"]+)"|([a-z_]+));/g)]
    .map(([, name, quoted, plain]) => ({ table: quoted || plain, name }));
  assert.equal(expected.length, 38);
  assert.deepEqual(actual, expected);
});

test('public replacement policies preserve published content and exclude hidden/archived references', () => {
  const nav = sql.slice(sql.indexOf('create policy gt_public_navigation_read'), sql.indexOf('drop policy if exists gt_public_story_read'));
  assert.match(nav, /for select to anon, authenticated/);
  assert.match(nav, /is_active = true and exists/);
  assert.match(nav, /p\.id = navbar_projects\.project_id/);
  assert.match(nav, /p\.is_active = true and p\.deleted_at is null/);
  const story = sql.slice(sql.indexOf('create policy gt_public_story_read'), sql.indexOf('revoke all privileges'));
  assert.match(story, /using \(is_active = true and is_archived is null\)/);
  assert.match(sql, /grant select on table public\.navbar_projects, public\."our story" to anon, authenticated/);
  assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete)[^;]*to\s+(?:public|anon|authenticated)\s*;/i);
});

test('unknown policy drift and unsafe role/column privileges abort rather than being broadly dropped or ignored', () => {
  assert.match(sql, /not c\.relrowsecurity/);
  assert.match(sql, /rolbypassrls or rolsuper/);
  assert.match(sql, /has_table_privilege/);
  assert.match(sql, /has_column_privilege/);
  assert.match(sql, /Unexpected policy on hardened tables/);
  assert.doesNotMatch(sql, /execute\s+format\('drop policy/i);
  assert.doesNotMatch(sql, /(?:delete from|truncate table)\s+public\./i);
});
