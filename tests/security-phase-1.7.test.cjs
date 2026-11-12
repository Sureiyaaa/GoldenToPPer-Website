const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function harness(permissions = 'SUPER_ADMIN', initial = {}) {
  const calls = [], tables = structuredClone(initial);
  class Query {
    constructor(table) { this.table = table; this.op = 'select'; this.filters = []; }
    select(fields) { this.fields = fields; return this; }
    eq(k, v) { this.filters.push(row => String(row[k]) === String(v)); return this; }
    in(k, values) { this.filters.push(row => values.map(String).includes(String(row[k]))); return this; }
    is(k, v) { this.filters.push(row => (row[k] ?? null) === v); return this; }
    not(k, op, values) { this.filters.push(row => !values.slice(1, -1).split(',').includes(row[k])); return this; }
    order() { return this; }
    limit() { return this; }
    update(values) { this.op = 'update'; this.values = values; return this; }
    insert(values) { this.op = 'insert'; this.values = values; return this; }
    async execute(single = false) {
      calls.push({ table: this.table, op: this.op, values: this.values, fields: this.fields });
      const source = tables[this.table] ??= [];
      let rows = source.filter(row => this.filters.every(f => f(row)));
      if (this.op === 'insert') { rows = (Array.isArray(this.values) ? this.values : [this.values]).map(v => ({ id: source.length + 1, ...v })); source.push(...rows); }
      if (this.op === 'update') rows.forEach(row => Object.assign(row, this.values));
      return { data: single ? rows[0] ?? null : rows, error: single && rows.length !== 1 ? { message: 'Synthetic missing row' } : null };
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    single() { return this.execute(true); }
    async maybeSingle() { const result = await this.execute(); return { data: result.data[0] ?? null, error: null }; }
  }
  const auth = {
    getRBACProfile: async () => permissions === null ? null : ({ permissions }),
    getCustomSession: async () => permissions === null ? null : 'synthetic-admin',
    getCurrentUser: async () => permissions === null ? null : ({ id: 'synthetic-admin', username: 'synthetic', is_super_admin: permissions === 'SUPER_ADMIN' }),
    requireSuperAdmin: async () => { if (permissions !== 'SUPER_ADMIN') throw new Error('Unauthorized'); return 'synthetic-admin'; },
  };
  function load(file) {
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', code)(name => {
      if (name === './auth') return auth;
      if (name === '@supabase/supabase-js') return { createClient: () => ({ from: t => new Query(t) }) };
      if (name === '@/lib/customer-inbox') return {};
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return { access: load('app/actions/admin-access.ts'), actions: load('app/actions/admin_fetchers.ts'), calls, tables };
}
const promo = { title: 'Synthetic promotion', description: 'Synthetic details', status: 'New', validity_date: '2026-12-31' };
const tour = { id: 1, title: 'Synthetic unit', unit_name: 'Unit A', tower_name: 'Tower A', status: 'Hidden', view_areas: [] };

test('unrelated CMS roles and absent sessions cannot read or mutate newly protected content', async () => {
  for (const role of [null, {}]) {
    const h = harness(role);
    for (const run of [
      () => h.access.fetchModulesManagementAction(), () => h.access.setModuleVisibilityAction(1, false),
      () => h.access.fetchAdminNewsAction(), () => h.actions.fetchAdminPromotionsList(),
      () => h.actions.fetchAdminBanksList(), () => h.actions.fetchAdminVirtualToursList(),
      () => h.actions.savePromotionAction(promo, null), () => h.actions.saveVirtualTourAction({}, null),
      () => h.actions.saveProjectVirtualToursAction(1, [tour], []),
      () => h.actions.toggleVirtualTourStatus(1, 'Hidden'),
      () => h.actions.saveWebsiteSectionStatesAction([{ id: 1, is_active: false, module_name: 'x', display_name: 'x' }]),
    ]) await assert.rejects(run, /Unauthorized|permission/);
    assert.equal(h.calls.length, 0);
  }
});

test('module management preserves super-admin changes and blocks protected module IDs', async () => {
  const h = harness('SUPER_ADMIN', { modules: [{ id: 1, module_code: 'edit_news', is_active: true }, { id: 2, module_code: 'admin_manage', is_active: true }] });
  await h.access.setModuleVisibilityAction(1, false);
  assert.equal(h.tables.modules[0].is_active, false);
  await assert.rejects(h.access.setModuleVisibilityAction(2, false), /Unable/);
  assert.equal(h.tables.modules[1].is_active, true);
  await assert.rejects(h.access.setModuleVisibilityAction(1, 'false'));
});

test('promotion create/edit permissions are separate and extra columns cannot be injected', async () => {
  const creator = harness({ promotion_code: { can_create: true } });
  assert.equal((await creator.actions.savePromotionAction(promo, null)).success, true);
  await assert.rejects(creator.actions.savePromotionAction(promo, '1'), /permission/);
  const editor = harness({ promotion_code: { can_edit: true } }, { promotions: [{ id: 1 }] });
  await editor.actions.savePromotionAction(promo, '1');
  await assert.rejects(editor.actions.savePromotionAction({ ...promo, is_active: true }, '1'));
  assert.equal(editor.calls.length, 1);
});

test('tour updates retain Hidden status, require edit permission, and cannot target another project', async () => {
  const h = harness({ virtual_tours: { can_view: true, can_edit: true } }, { virtual_tours: [{ ...tour, project_id: 1 }] });
  await h.actions.saveProjectVirtualToursAction(1, [tour], []);
  assert.equal(h.tables.virtual_tours[0].status, 'Hidden');
  await assert.rejects(h.actions.saveProjectVirtualToursAction(2, [{ ...tour, title: 'Wrong project' }], []));
  assert.equal(h.tables.virtual_tours[0].title, tour.title);
  await assert.rejects(h.actions.saveProjectVirtualToursAction(1, [{ ...tour, id: 'temp-123' }], []), /permission/);
  await assert.rejects(h.actions.saveProjectVirtualToursAction(1, [tour], [1]), /Archive/);
});

test('website section permissions use stored module codes, not browser labels', async () => {
  const h = harness({ edit_news: { can_edit: true } }, { modules: [{ id: 1, module_code: 'edit_project', module_name: 'Projects', is_active: true }] });
  await assert.rejects(h.actions.saveWebsiteSectionStatesAction([{ id: 1, is_active: false, module_name: 'edit_news', display_name: 'News' }]), /permission/);
  assert.equal(h.tables.modules[0].is_active, true);
  assert.equal(h.calls.filter(c => c.op === 'update').length, 0);
});

test('malformed public submissions are rejected before service-role database access', async () => {
  const h = harness('SUPER_ADMIN', { project_table: [{ id: 1, is_active: true, deleted_at: null }] });
  for (const value of [null, {}, { firstName: 'x', lastName: 'x', email: 'bad', phone: '123', project: '1' }]) {
    assert.equal((await h.actions.submitInquiryAction(value)).success, false);
    assert.equal((await h.actions.submitContactAction(value)).success, false);
  }
  assert.equal(h.calls.length, 0);
  const person = { firstName: 'Synthetic', lastName: 'Customer', email: 'synthetic@example.test', phone: '09171234567' };
  assert.equal((await h.actions.submitInquiryAction({ ...person, project: '1' })).success, true);
  assert.equal((await h.actions.submitContactAction({ ...person, typeOfInquiry: 'Customer Support', message: 'Synthetic request' })).success, true);
  const hidden = harness('SUPER_ADMIN', { project_table: [{ id: 1, is_active: false, deleted_at: null }] });
  assert.equal((await hidden.actions.submitInquiryAction({ ...person, project: '1' })).success, false);
  assert.equal(hidden.calls.some(call => call.op !== 'select'), false);
});

test('remaining mutation migration closes all 15 table write paths and contains no blanket browser regrant', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261110030000_harden_remaining_cms_mutations.sql'), 'utf8');
  assert.equal([...sql.matchAll(/drop policy if exists "(?:Admin Full Access|Allow Admin Edits|Allow authenticated inserts on banks|Allow authenticated updates on banks|Allow authenticated deletes on project_banks|Allow authenticated inserts on project_banks|Allow full access for authenticated users|Allow admin full access on virtual_tours)"/g)].length, 19);
  assert.match(sql, /has_any_column_privilege/);
  assert.match(sql, /cmd <> 'SELECT'/);
  assert.doesNotMatch(sql, /grant\s+.*to\s+(?:anon|authenticated)/i);
  const rpc = fs.readFileSync(path.join(root, 'supabase/migrations/20261110005000_restrict_admin_rpc_execution.sql'), 'utf8');
  assert.match(rpc, /Unreviewed administrator\/audit overload/);
});
