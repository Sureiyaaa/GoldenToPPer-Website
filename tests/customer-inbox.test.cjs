const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => imports[name] ?? require(name), module, module.exports);
  return module.exports;
}
const model = loadTs('lib/customer-inbox.ts');
const client = { first_name: 'Juan', last_name: 'Dela Cruz', email: 'juan@example.com', phone_number: '09171234567' };
const inquiry = { id: 1, created_at: '2026-10-05T08:00:00Z', client, project_table: { title: 'City Clou' }, admin_inquire_reads: [] };
const support = { id: 1, created_at: '2026-10-04T08:00:00Z', client: [{ ...client, first_name: 'John', last_name: 'Reyes' }], 'type of inquiry': 'Payment & billing', message: 'Please help with my receipt.', admin_contact_reads: [{ admin_id: 'admin-a' }] };
const loan = { id: 1, created_at: '2026-10-05T09:00:00Z', client: { ...client, first_name: 'Maria', last_name: 'Santos' }, project_table: [{ title: 'Park One' }], banks: { bank_name: 'BDO' }, tower: 'Tower A', unit_no: 0, floor_no: 12, co_buyer_name: 'Pedro Santos', is_agreed: true, admin_loan_preapp_reads: [{ admin_id: 'admin-a' }] };
const normalized = () => model.normalizeCustomerInbox([inquiry], [support], [loan], 'admin-a');

function serverHarness(options = {}) {
  const calls = [];
  const sources = { inquire: [inquiry], contact: [support], loan_preapp: [loan], ...options.sources };
  const auth = { session: 'admin-a', profile: { permissions: { notifications_code: { can_view: true } } }, ...options.auth };
  class Query {
    constructor(table) { this.table = table; this.start = 0; this.end = 499; this.filters = []; }
    select(selection, opts) { this.selection = selection; this.opts = opts; return this; }
    order(column, opts) { (this.orders ??= []).push([column, opts]); return this; }
    range(start, end) { this.start = start; this.end = end; return this; }
    eq(column, value) { this.filters.push([column, value]); return this; }
    async returns() {
      calls.push({ op: 'select', table: this.table, start: this.start, selection: this.selection, filters: this.filters, orders: this.orders });
      if (options.fetchError === this.table) return { data: null, count: null, error: { message: 'Database failed' } };
      const source = sources[this.table];
      const data = source.slice(this.start, Math.min(this.end + 1, this.start + (options.responseCap ?? 500)));
      return { data, count: this.opts.count ? source.length : null, error: null };
    }
    async upsert(values, opts) { calls.push({ op: 'upsert', table: this.table, values, opts }); return { error: options.writeError ? { message: 'Failed' } : null }; }
    delete() { return { match: async values => { calls.push({ op: 'delete', table: this.table, values }); return { error: options.writeError ? { message: 'Failed' } : null }; } }; }
  }
  const actions = loadTs('app/actions/admin_fetchers.ts', {
    '@supabase/supabase-js': { createClient: () => ({ from: table => new Query(table) }) },
    './auth': { getCustomSession: async () => auth.session, getRBACProfile: async () => auth.profile },
    '@/lib/customer-inbox': model,
  });
  return { actions, calls, auth };
}

test('three sources retain their own detail fields and sort together, with collision-safe keys', () => {
  const items = normalized();
  assert.deepEqual(items.map(item => item.type), ['loan_application', 'inquiry', 'customer_support']);
  assert.equal(new Set(items.map(model.customerInboxKey)).size, 3);
  assert.equal(items[0].name, 'Maria Santos');
  assert.equal(items[0].client_email, client.email);
  assert.equal(items[0].client_phone, client.phone_number);
  assert.equal(items[0].project_name, 'Park One');
  assert.equal(items[0].bank_name, 'BDO');
  assert.equal(items[0].tower, 'Tower A');
  assert.equal(items[0].unit_no, 0);
  assert.equal(items[0].floor_no, 12);
  assert.equal(items[0].co_buyer_name, 'Pedro Santos');
  assert.equal(items[1].title, 'Inquiry: City Clou');
  assert.equal(items[2].message, support.message);
});

test('read state is scoped per admin, including loans with per-admin persistence', () => {
  assert.equal(normalized()[0].is_read, true);
  assert.equal(normalized()[0].can_mark_read, true);
  const other = model.normalizeCustomerInbox([inquiry], [support], [loan], 'admin-b');
  assert.equal(other[0].is_read, false);
  assert.equal(other[0].can_mark_read, true);
});

test('search matches sender, email, project, bank and actual support message', () => {
  for (const query of ['maria santos', 'JUAN@EXAMPLE.COM', 'City Clou', 'BDO', 'receipt']) {
    assert.ok(model.filterCustomerInbox(normalized(), query, 'all', 'all').length > 0, query);
  }
  assert.equal(model.filterCustomerInbox(normalized(), 'does not exist', 'all', 'all').length, 0);
});

test('all type/read filters work together, including tracked loans', () => {
  for (const type of Object.keys(model.customerInboxTypeLabels)) assert.equal(model.filterCustomerInbox(normalized(), '', type, 'all').length, 1);
  assert.equal(model.filterCustomerInbox(normalized(), '', 'all', 'read').length, 2);
  assert.equal(model.filterCustomerInbox(normalized(), '', 'all', 'unread').length, 1);
  assert.equal(model.filterCustomerInbox(normalized(), '', 'loan_application', 'read').length, 1);
});

test('nullable joins and dates render honestly, and zero-valued loan fields survive', () => {
  const items = model.normalizeCustomerInbox([{ ...inquiry, client: null, project_table: null, created_at: null }], [], [{ ...loan, banks: null }], 'admin-a');
  assert.equal(items[1].name, 'Unknown customer');
  assert.equal(items[1].project_name, 'Unknown Property');
  assert.equal(model.formatCustomerInboxDate(null), 'Date unavailable');
  assert.equal(model.formatCustomerInboxDate('invalid'), 'Date unavailable');
  assert.match(model.formatCustomerInboxDate('2026-10-05T08:00:00Z'), /4:00 PM/);
  assert.equal(items[0].unit_no, 0);
});

test('mailto encodes subject delimiters and rejects injected recipient headers', () => {
  const item = normalized()[2];
  assert.match(model.customerInboxReplyHref(item), /Payment%20%26%20billing/);
  assert.match(model.customerInboxReplyHref(normalized()[0]), /Loan%20Pre-Application%20-%20Park%20One/);
  for (const email of [null, 'bad address', 'user@example.com?bcc=other@example.com', 'user@example.com\r\nBcc:evil@example.com']) {
    assert.equal(model.customerInboxReplyHref({ ...item, client_email: email }), null);
  }
});

test('fetch uses three joined queries and current-admin read filters', async () => {
  const harness = serverHarness();
  const items = await harness.actions.fetchNotificationsAction();
  assert.equal(items.length, 3);
  assert.equal(harness.calls.length, 3);
  assert.match(harness.calls.find(call => call.table === 'loan_preapp').selection, /banks!banks_id\(bank_name\)/);
  assert.match(harness.calls.find(call => call.table === 'loan_preapp').selection, /admin_loan_preapp_reads\(admin_id\)/);
  for (const call of harness.calls) assert.equal(call.filters[0][1], 'admin-a');
});

test('full fetch loads beyond 50 and beyond server response caps without per-record queries', async () => {
  const inquiries = Array.from({ length: 1051 }, (_, index) => ({ ...inquiry, id: index + 1 }));
  const harness = serverHarness({ sources: { inquire: inquiries }, responseCap: 200 });
  const items = await harness.actions.fetchNotificationsAction();
  assert.equal(items.length, 1053);
  assert.equal(harness.calls.filter(call => call.table === 'inquire').length, 6);
});

test('paging deduplicates records with the same source ID', async () => {
  const harness = serverHarness({ sources: { inquire: [inquiry, inquiry] } });
  const items = await harness.actions.fetchNotificationsAction();
  assert.equal(items.filter(item => item.type === 'inquiry').length, 1);
});

test('missing session and denied permission stop both fetch and mutation before database access', async () => {
  for (const auth of [{ session: null }, { profile: null }, { profile: { permissions: {} } }, { profile: { permissions: { notifications_code: { can_view: false } } } }]) {
    const harness = serverHarness({ auth });
    await assert.rejects(harness.actions.fetchNotificationsAction(), /Unauthorized|permission/);
    await assert.rejects(harness.actions.toggleNotificationReadAction(1, 'inquiry', true), /Unauthorized|permission/);
    assert.equal(harness.calls.length, 0);
  }
});

test('Super Admin retains notification access', async () => {
  const harness = serverHarness({ auth: { profile: { permissions: 'SUPER_ADMIN' } } });
  assert.equal((await harness.actions.fetchNotificationsAction()).length, 3);
});

test('read/unread targets the explicit junction and authenticated identity with idempotent insert', async () => {
  const harness = serverHarness();
  for (const [type, table, column] of [['inquiry', 'admin_inquire_reads', 'inquire_id'], ['customer_support', 'admin_contact_reads', 'contact_id'], ['loan_application', 'admin_loan_preapp_reads', 'loan_preapp_id']]) {
    await harness.actions.toggleNotificationReadAction('1', type, true);
    await harness.actions.toggleNotificationReadAction(1, type, false);
    const [mark, unmark] = harness.calls.slice(-2);
    assert.equal(mark.table, table);
    assert.deepEqual(mark.values, { admin_id: 'admin-a', [column]: 1 });
    assert.equal(mark.opts.ignoreDuplicates, true);
    assert.equal(unmark.op, 'delete');
    assert.deepEqual(unmark.values, mark.values);
  }
});

test('unknown type and malformed mutations never fall through', async () => {
  const harness = serverHarness();
  for (const args of [[1, 'unknown', true], [1, 'contact', true], [-1, 'inquiry', true], [true, 'inquiry', true], [[1], 'inquiry', true], [{}, 'inquiry', true], [1, 'inquiry', 'yes']]) {
    await assert.rejects(harness.actions.toggleNotificationReadAction(...args));
  }
  assert.equal(harness.calls.length, 0);
});

test('source and write failures propagate instead of reporting success or silently missing records', async () => {
  const fetch = serverHarness({ fetchError: 'loan_preapp' });
  await assert.rejects(fetch.actions.fetchNotificationsAction(), /Could not load loan_preapp/);
  const write = serverHarness({ writeError: true });
  await assert.rejects(write.actions.toggleNotificationReadAction(1, 'inquiry', true), /Could not save/);
});