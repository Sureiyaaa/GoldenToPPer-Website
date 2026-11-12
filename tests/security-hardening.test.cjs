const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createHmac } = require('node:crypto');

function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => imports[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}

function harness(profile = { permissions: 'SUPER_ADMIN' }, options = {}) {
  const calls = [];
  const rows = options.rows ?? [{ id: 1, project_table: { title: 'Synthetic', is_active: false, deleted_at: null } }];
  class Query {
    constructor(table) { this.call = { table, operation: 'select', filters: [] }; }
    select(fields) { this.call.fields = fields; return this; }
    update(values) { this.call.operation = 'update'; this.call.values = values; return this; }
    insert(values) { this.call.operation = 'insert'; this.call.values = values; return this; }
    eq(...args) { this.call.filters.push(args); return this; }
    in(...args) { this.call.filters.push(args); return this; }
    is() { return this; }
    limit() { return this; }
    order() { return this; }
    then(resolve, reject) { calls.push(this.call); return Promise.resolve({ data: rows, error: options.error ?? null }).then(resolve, reject); }
    async single() {
      calls.push(this.call);
      return { data: options.missing ? null : { id: 1 }, error: options.error ?? null };
    }
  }
  const imports = {
    '@supabase/supabase-js': { createClient: () => ({ from: table => new Query(table) }) },
    './auth': {
      getRBACProfile: async () => profile,
      getCurrentUser: async () => ({ id: 'synthetic-admin', is_super_admin: profile?.permissions === 'SUPER_ADMIN' }),
      getCustomSession: async () => profile ? 'synthetic-admin' : null,
    },
    '@/lib/customer-inbox': load('lib/customer-inbox.ts'),
  };
  return {
    access: load('app/actions/admin-access.ts', imports),
    story: load('app/actions/admin_fetchers.ts', imports), calls,
  };
}

const navigation = { nav_title: ' Project ', tagline: ' Tagline ', nav_image_url: null, is_active: false };
const milestone = { year: '2026', title: 'Synthetic milestone', description: 'Synthetic description', image: '/images/story.webp' };

test('all new actions and Story operations reject missing/insufficient CMS permissions before DB access', async () => {
  for (const profile of [null, { permissions: {} }, { permissions: { admin_manage: { can_view: false }, edit_project: { can_edit: false }, our_story: { can_edit: false } } }]) {
    const h = harness(profile);
    for (const invoke of [
      () => h.access.fetchUsersAccessAction(), () => h.access.fetchDepartmentPermissionsAction(1),
      () => h.access.fetchAdminNavigationAction(), () => h.access.saveNavigationAction(1, navigation),
      () => h.access.saveNavigationOrderAction([1]), () => h.story.fetchAdminStoryList(),
      () => h.story.fetchStoryForEdit(1), () => h.story.saveStoryAction(milestone, null),
      () => h.story.saveStoryAction(milestone, '1'),
    ]) await assert.rejects(invoke, /Unauthorized|permission/);
    assert.equal(h.calls.length, 0);
  }
});

test('administrator listing uses explicit noncredential projections and verified profile', async () => {
  const h = harness({ permissions: { admin_manage: { can_view: true } } });
  const result = await h.access.fetchUsersAccessAction();
  await h.access.fetchDepartmentPermissionsAction(1);
  assert.deepEqual(result.currentUser, { id: 'synthetic-admin', is_super_admin: false });
  assert.equal(h.calls.length, 4);
  for (const call of h.calls) assert.doesNotMatch(call.fields, /\*|password|hash/i);
  assert.match(h.calls.find(c => c.table === 'admin_users').fields, /groups\(group_name\)/);
  assert.deepEqual(h.calls.find(c => c.table === 'module_access').filters, [['group_id', '1']]);
});

test('view-only editor sees hidden navigation but cannot save or reorder it', async () => {
  const h = harness({ permissions: { edit_project: { can_view: true } } });
  assert.equal((await h.access.fetchAdminNavigationAction()).length, 1);
  await assert.rejects(h.access.saveNavigationAction(1, navigation), /permission/);
  await assert.rejects(h.access.saveNavigationOrderAction([1]), /permission/);
  assert.equal(h.calls.length, 1);
});

test('authorized navigation save trims fields and cannot modify relationship/order through edit payload', async () => {
  const h = harness({ permissions: { edit_project: { can_edit: true } } });
  await h.access.saveNavigationAction('1', navigation);
  assert.deepEqual(h.calls[0].values, { ...navigation, nav_title: 'Project', tagline: 'Tagline' });
  for (const payload of [
    { ...navigation, project_id: 9 }, { ...navigation, display_order: 99 },
    { ...navigation, is_active: 'true' }, { ...navigation, nav_title: ' ' },
    { ...navigation, nav_image_url: 'javascript:alert(1)' },
    { ...navigation, nav_image_url: '//example.test/image' },
  ]) await assert.rejects(h.access.saveNavigationAction(1, payload));
  assert.equal(h.calls.length, 1);
});

test('invalid IDs, duplicate orders and missing records do not report success', async () => {
  const h = harness();
  for (const id of [null, true, {}, -1, 0, '1x', '9007199254740992']) {
    await assert.rejects(h.access.saveNavigationAction(id, navigation));
    await assert.rejects(h.access.fetchDepartmentPermissionsAction(id));
  }
  for (const ids of [[], [1, '1'], ['bad'], true]) await assert.rejects(h.access.saveNavigationOrderAction(ids));
  assert.equal(h.calls.length, 0);
  const missing = harness(undefined, { missing: true });
  await assert.rejects(missing.access.saveNavigationAction(1, navigation), /Unable to save/);
  await assert.rejects(missing.story.saveStoryAction(milestone, '1'), /Could not save/);
});

test('ordering verifies IDs before updates and only updates display_order', async () => {
  const h = harness(undefined, { rows: [{ id: 2 }, { id: 1 }] });
  await h.access.saveNavigationOrderAction([2, 1]);
  assert.deepEqual(h.calls.filter(c => c.operation === 'update').map(c => c.values), [{ display_order: 1 }, { display_order: 2 }]);
  const missing = harness(undefined, { rows: [] });
  await assert.rejects(missing.access.saveNavigationOrderAction([1]), /Reload/);
  assert.equal(missing.calls.filter(c => c.operation === 'update').length, 0);
});

test('Story create/edit permissions are independent and privileged payload fields are rejected', async () => {
  const create = harness({ permissions: { our_story: { can_create: true } } });
  assert.equal((await create.story.saveStoryAction(milestone, null)).id, 1);
  assert.equal(create.calls[0].values[0].is_active, true);
  await assert.rejects(create.story.saveStoryAction(milestone, '1'), /permission/);
  const edit = harness({ permissions: { our_story: { can_edit: true } } });
  await edit.story.saveStoryAction(milestone, '1');
  assert.deepEqual(edit.calls[0].values, milestone);
  await assert.rejects(edit.story.saveStoryAction(milestone, null), /permission/);
  for (const payload of [{ ...milestone, is_active: false }, { ...milestone, is_archived: true }, { ...milestone, id: 9 }, { ...milestone, year: 'bad' }, { ...milestone, image: 'javascript:x' }]) {
    await assert.rejects(edit.story.saveStoryAction(payload, '1'));
  }
  assert.equal(edit.calls.length, 1);
});

test('database errors propagate through authorized reads and writes', async () => {
  const h = harness(undefined, { error: { message: 'synthetic database failure' } });
  await assert.rejects(h.access.fetchUsersAccessAction(), /Unable to load/);
  await assert.rejects(h.access.fetchDepartmentPermissionsAction(1), /Unable to load/);
  await assert.rejects(h.access.fetchAdminNavigationAction(), /Unable to load/);
  await assert.rejects(h.access.saveNavigationAction(1, navigation), /Unable to save/);
  await assert.rejects(h.access.saveNavigationOrderAction([1]), /Reload/);
  await assert.rejects(h.story.saveStoryAction(milestone, null), /Could not save/);
});

test('custom-session verification rejects forged/expired cookies and inactive accounts before granting RBAC', async () => {
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
  try {
    const signed = expiry => {
      const payload = `v1.synthetic-admin.${expiry}`;
      return `${payload}.${createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(payload).digest('hex')}`;
    };
    for (const [token, active, expected] of [
      [null, true, false], ['forged', true, false], [signed(Date.now() - 1000), true, false],
      [signed(Date.now() + 60000), false, false], [signed(Date.now() + 60000), true, true],
    ]) {
      const auth = load('app/actions/auth.ts', {
        'next/headers': { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
        bcryptjs: { hashSync: () => 'synthetic', compare: async () => true },
        '@supabase/supabase-js': { createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'synthetic-admin', is_active: active, is_super_admin: true } }) }) }) }) }) },
      });
      assert.equal(Boolean(await auth.getRBACProfile()), expected);
    }
  } finally {
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
