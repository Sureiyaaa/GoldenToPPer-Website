const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261110005500_restrict_verify_admin_login_rpc.sql');
const rollback = read('supabase/rollback/20261110005500_restore_verify_admin_login_rpc.sql');
const statements = sql => sql.replace(/--[^\n]*/g, '').trim();

test('login RPC containment is atomic and limits ACL changes to the verified signature', () => {
  const sql = statements(migration);
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;$/);
  const acl = sql.match(/(?:revoke|grant)\s+[\s\S]*?;/gi);
  assert.deepEqual(acl, [
    'revoke execute on function public.verify_admin_login(text, text)\n  from public, anon, authenticated;',
    'grant execute on function public.verify_admin_login(text, text) to service_role;',
  ]);
});

test('login RPC preflight rejects missing functions, owner/definer drift and unexpected overloads', () => {
  assert.match(migration, /target oid := pg_catalog\.to_regprocedure\('public\.verify_admin_login\(text,text\)'\)/);
  assert.match(migration, /if target is null then\s+raise exception/);
  assert.match(migration, /p\.prokind = 'f'\s+and p\.prosecdef and r\.rolname = 'postgres'/);
  assert.match(migration, /n\.nspname = 'public' and p\.proname = 'verify_admin_login'\s+and p\.oid <> target/);
  assert.match(migration, /raise exception 'Unreviewed verify_admin_login overload/);
  assert.ok(migration.indexOf('$check_verify_admin_login$;') < migration.indexOf('revoke execute'));
});

test('login RPC postflight aborts on effective browser execution or missing service execution', () => {
  assert.match(migration, /signature text := 'public\.verify_admin_login\(text,text\)'/);
  assert.match(migration, /foreach role_name in array array\['anon', 'authenticated'\] loop/);
  assert.match(migration, /if pg_catalog\.has_function_privilege\(role_name, signature, 'EXECUTE'\) then\s+raise exception/);
  assert.match(migration, /if not pg_catalog\.has_function_privilege\('service_role', signature, 'EXECUTE'\) then\s+raise exception/);
  assert.ok(migration.indexOf('$verify_login_rpc_acl$;') < migration.lastIndexOf('commit;'));
});

test('containment and rollback preserve function implementation, owner and search path', () => {
  for (const source of [migration, rollback]) {
    const sql = statements(source);
    assert.doesNotMatch(sql, /\b(?:create\s+(?:or\s+replace\s+)?function|alter\s+function|drop\s+function|set\s+search_path|alter\s+default\s+privileges)\b/i);
    assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from|truncate|grant\s+all|with\s+grant\s+option)\b/i);
  }
});

test('manual rollback warns about exposure and restores only verified original EXECUTE recipients', () => {
  assert.match(rollback, /WARNING: rollback REOPENS/);
  assert.match(rollback, /MANUAL ROLLBACK ONLY/);
  const sql = statements(rollback);
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;$/);
  assert.deepEqual(sql.match(/(?:revoke|grant)\s+[\s\S]*?;/gi), [
    'grant execute on function public.verify_admin_login(text, text)\n  to public, postgres, anon, authenticated, service_role;',
  ]);
});
