const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => imports[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}

function harness(superAdmin, session = true) {
  const calls = [];
  const imports = {
    '@supabase/supabase-js': { createClient: () => ({ rpc: async (name, values) => { calls.push({ name, values }); return { error: null }; } }) },
    './auth': {
      requireSuperAdmin: async () => { if (!session || !superAdmin) throw new Error('Unauthorized'); return 'synthetic-admin'; },
      getCustomSession: async () => session ? 'synthetic-admin' : null,
      getCurrentUser: async () => session ? { id: 'synthetic-admin', username: 'synthetic', is_super_admin: superAdmin } : null,
    },
    '@/lib/customer-inbox': {},
  };
  return { users: load('app/actions/user.ts', imports), audit: load('app/actions/admin_fetchers.ts', imports), calls };
}

test('account and audit RPC actions reject unauthenticated and non-super administrators before RPC access', async () => {
  for (const [superAdmin, session] of [[false, false], [false, true]]) {
    const h = harness(superAdmin, session);
    assert.equal((await h.users.createUserAction({})).success, false);
    assert.equal((await h.users.updateUserAction({})).success, false);
    await assert.rejects(h.audit.deleteAuditLogAction(1), /super admin/);
    assert.equal(h.calls.length, 0);
  }
});

test('authorized server callers retain the three verified RPC entry points', async () => {
  const h = harness(true);
  assert.equal((await h.users.createUserAction({ username: 'synthetic', password: 'synthetic-only', is_super_admin: false, group_id: '1' })).success, true);
  assert.equal((await h.users.updateUserAction({ id: 'synthetic-id', is_super_admin: false, group_id: '1', password: '' })).success, true);
  await h.audit.deleteAuditLogAction(1);
  assert.deepEqual(h.calls.map(c => c.name), ['create_admin_user', 'update_admin_user', 'remove_audit_log_entry']);
  assert.equal(h.calls[1].values.new_plain_password, null);
  assert.equal(h.calls[2].values.p_actor_id, 'synthetic-admin');
});

test('RPC containment targets exact verified overloads without redefining function bodies', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261110005000_restrict_admin_rpc_execution.sql'), 'utf8').replace(/\r\n/g, '\n');
  for (const signature of [
    'public.create_admin_user(text, text, boolean, integer)',
    'public.update_admin_user(uuid, boolean, integer, text)',
    'public.remove_audit_log_entry(bigint, text, text)',
  ]) {
    assert.ok(sql.includes(`revoke execute on function ${signature}\n  from public, anon, authenticated;`));
    assert.ok(sql.includes(`grant execute on function ${signature} to service_role;`));
  }
  assert.match(sql, /has_function_privilege/);
  assert.doesNotMatch(sql, /create\s+(or\s+replace\s+)?function/i);
});

test('default changes restrict only postgres public-schema defaults and fail closed within that scope', () => {
  const source = fs.readFileSync(path.join(root, 'supabase/migrations/20261110020000_scope_public_default_privileges.sql'), 'utf8');
  const sql = source.replace(/--[^\n]*/g, '').trim();
  const statements = sql.match(/alter default privileges[\s\S]*?;/gi);
  assert.deepEqual(statements.map(statement => statement.replace(/\s+/g, ' ')), [
    'alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;',
    'alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;',
    'alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;',
  ]);
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;$/);
  assert.match(sql, /if exists \(/);
  assert.match(sql, /n\.nspname = 'public'/);
  assert.match(sql, /d\.defaclrole = 'postgres'::regrole/);
  assert.match(sql, /d\.defaclobjtype in \('r', 'S', 'f'\)/);
  assert.match(sql, /a\.grantee in \(0, 'anon'::regrole::oid, 'authenticated'::regrole::oid\)/);
  assert.match(sql, /raise exception 'Residual postgres public-schema defaults/);
  assert.doesNotMatch(sql, /supabase_admin|\bgrant\b|\balter\s+role\b/i);
  assert.doesNotMatch(sql, /grant\s+.*\s+to\s+(anon|authenticated)/i);
  assert.match(source, /DEFERRED security work requiring an already-authorized operator/);
  assert.match(source, /per-schema REVOKE cannot cancel global grants or the built-in\s+-- PUBLIC EXECUTE default/);
});
