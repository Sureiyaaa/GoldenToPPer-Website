const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, imports = {}, logger = console, browserWindow) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', 'window', code)(
    name => imports[name] ?? require(name), module, module.exports, logger, browserWindow,
  );
  return module.exports;
}
const validation = loadTs('lib/validations/loan.ts');
const inbox = loadTs('lib/customer-inbox.ts');
const valid = {
  condo: '1', bank: '2', tower: 'Tower A', unit: '1201', floor: '12',
  buyerName: 'Juan Dela Cruz', coBuyerName: 'NA', email: 'juan@example.com',
  phone: '09171234567', isAgreed: true,
};
const existing = {
  id: 42, first_name: 'Juan', last_name: 'Dela Cruz',
  email: 'Juan@Example.com', phone_number: '09170000000',
};

function harness(options = {}) {
  const calls = [], logs = [], clients = (options.clients ?? []).map(row => ({ ...row })), loans = [];
  class Query {
    constructor(table) { this.table = table; this.op = 'select'; this.filters = []; }
    select(selection) { this.selection = selection; return this; }
    insert(values) { this.op = 'insert'; this.values = values; return this; }
    update(values) { this.op = 'update'; this.values = values; return this; }
    eq(column, value) { this.filters.push(['eq', column, value]); return this; }
    ilike(column, value) { this.filters.push(['ilike', column, value]); return this; }
    is(column, value) { this.filters.push(['is', column, value]); return this; }
    order() { return this; }
    limit() { return this; }
    maybeSingle() { return this.execute(); }
    single() { return this.execute(); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute() {
      calls.push({ table: this.table, op: this.op, values: this.values, filters: this.filters });
      const stage = this.table === 'client'
        ? (this.op === 'select' ? 'lookup' : 'client-' + this.op)
        : this.table === 'loan_preapp' ? 'loan-insert' : this.table + '-lookup';
      if (options.fail === stage) return { data: null, error: { message: 'PRIVATE database detail', code: '42501' } };
      if (this.table === 'project_table' || this.table === 'banks') {
        return { data: options.unavailable === this.table ? null : { id: this.table === 'banks' ? 2 : 1 }, error: null };
      }
      if (this.table === 'client') {
        if (this.op === 'select') {
          const email = this.filters.find(filter => filter[1] === 'email');
          const literal = email[2].replace(/\\([\\%_])/g, '$1').toLowerCase();
          return { data: clients.find(row => row.email.toLowerCase() === literal) ?? null, error: null };
        }
        if (this.op === 'insert') {
          if (options.uniqueRace) {
            clients.push({ ...existing, email: valid.email });
            options.uniqueRace = false;
            return { data: null, error: { code: '23505', message: 'PRIVATE unique violation' } };
          }
          const row = { id: 100, ...this.values };
          clients.push(row);
          return { data: row, error: null };
        }
        const id = this.filters.find(filter => filter[1] === 'id')[2];
        Object.assign(clients.find(row => row.id === id), this.values);
        return { data: null, error: null };
      }
      if (this.table === 'loan_preapp') loans.push({ id: loans.length + 1, ...this.values });
      return { data: null, error: null };
    }
  }
  const createCalls = [];
  const supabase = {
    createClient: (...args) => {
      createCalls.push(args);
      return { from: table => new Query(table) };
    },
  };
  const imports = {
    '@supabase/supabase-js': supabase,
    '@/lib/validations/loan': validation,
    '@/lib/customer-inbox': inbox,
    './auth': {},
  };
  const logger = { error: (...args) => logs.push(args) };
  return {
    actions: loadTs('app/actions/loan.ts', imports, logger),
    publicActions: loadTs('app/actions/admin_fetchers.ts', imports, logger),
    calls, logs, clients, loans, createCalls,
  };
}

test('new-client loan normalizes fields, creates client and inserts actual loan columns', async () => {
  const h = harness();
  assert.deepEqual(await h.actions.submitLoanPreApplicationAction({
    ...valid, buyerName: '  Juan   Dela Cruz ', email: ' Juan@EXAMPLE.COM ',
    coBuyerName: ' NA ', tower: ' Tower A ', phone: ' +639171234567 ',
    client_id: 999, is_read: true,
  }), { success: true });
  assert.deepEqual(h.clients, [{
    id: 100, first_name: 'Juan', last_name: 'Dela Cruz', email: valid.email, phone_number: '+639171234567',
  }]);
  assert.deepEqual(h.loans, [{
    id: 1, client_id: 100, project_id: 1, banks_id: 2, tower: 'Tower A',
    unit_no: 1201, floor_no: 12, co_buyer_name: 'NA', is_agreed: true,
  }]);
  assert.ok(h.createCalls.at(-1)[2].auth.persistSession === false);
});

test('case-insensitive existing-client lookup reuses ID, refreshes phone and preserves useful names', async () => {
  const h = harness({ clients: [existing] });
  assert.deepEqual(await h.actions.submitLoanPreApplicationAction({ ...valid, buyerName: 'Different Buyer' }), { success: true });
  assert.equal(h.clients.length, 1);
  assert.equal(h.loans[0].client_id, 42);
  assert.equal(h.clients[0].first_name, 'Juan');
  assert.equal(h.clients[0].last_name, 'Dela Cruz');
  assert.equal(h.clients[0].phone_number, valid.phone);
  assert.equal(h.calls.filter(call => call.table === 'client' && call.op === 'insert').length, 0);
});

test('email LIKE wildcards are escaped and cannot reuse an unrelated client', async () => {
  const h = harness({ clients: [{ ...existing, email: 'juana@example.com' }] });
  await h.actions.submitLoanPreApplicationAction({ ...valid, email: 'juan_@example.com' });
  const lookup = h.calls.find(call => call.table === 'client' && call.op === 'select');
  assert.deepEqual(lookup.filters[0], ['ilike', 'email', 'juan\\_@example.com']);
  assert.equal(h.clients.length, 2);
  assert.equal(h.loans[0].client_id, 100);
});

test('missing names are filled, single-token names retain N/A fallback without clobbering a surname', async () => {
  const h = harness({ clients: [{ ...existing, first_name: ' ', last_name: 'N/A' }] });
  await h.actions.submitLoanPreApplicationAction(valid);
  assert.equal(h.clients[0].first_name, 'Juan');
  assert.equal(h.clients[0].last_name, 'Dela Cruz');
  const single = harness();
  await single.actions.submitLoanPreApplicationAction({ ...valid, buyerName: 'Juan', unit: '0', floor: '0' });
  assert.equal(single.clients[0].last_name, 'N/A');
  assert.equal(single.loans[0].unit_no, 0);
  assert.equal(single.loans[0].floor_no, 0);
  const reuse = harness({ clients: [existing] });
  await reuse.actions.submitLoanPreApplicationAction({ ...valid, buyerName: 'Juan' });
  assert.equal(reuse.clients[0].last_name, existing.last_name);
});

test('unique-email race reuses the winning client when the database enforces uniqueness', async () => {
  const h = harness({ uniqueRace: true });
  assert.deepEqual(await h.actions.submitLoanPreApplicationAction(valid), { success: true });
  assert.equal(h.clients.length, 1);
  assert.equal(h.loans[0].client_id, 42);
});

test('malformed payloads are rejected before any database access', async () => {
  const h = harness();
  const mutations = [
    { condo: '0' }, { condo: '-1' }, { condo: '1junk' }, { condo: '1.5' },
    { condo: '2147483648' }, { condo: [] }, { bank: '0' }, { bank: '1e2' },
    { tower: '  ' }, { tower: 'A'.repeat(101) }, { buyerName: '  ' },
    { buyerName: 'A' }, { buyerName: 'A'.repeat(201) }, { coBuyerName: '  ' },
    { email: 'invalid' }, { email: 'a@example.com\r\nBcc:other@example.com' },
    { phone: '12345678901' }, { phone: '+63171234567' }, { phone: '0917123456' },
    { unit: '' }, { unit: '-1' }, { unit: '1.2' }, { unit: '12suffix' },
    { floor: '' }, { floor: '-2' }, { floor: '1e2' }, { floor: '2147483648' },
    { isAgreed: false }, { isAgreed: 'true' },
  ];
  for (const payload of [null, undefined, [], {}, ...mutations.map(change => ({ ...valid, ...change }))]) {
    const result = await h.actions.submitLoanPreApplicationAction(payload);
    assert.equal(result.success, false, JSON.stringify(payload));
    assert.match(result.error, /check your application details/);
  }
  assert.equal(h.calls.length, 0);
});

test('unavailable project or bank prevents customer and loan writes', async () => {
  for (const unavailable of ['project_table', 'banks']) {
    const h = harness({ unavailable });
    const result = await h.actions.submitLoanPreApplicationAction(valid);
    assert.equal(result.success, false);
    assert.equal(h.calls.some(call => call.op !== 'select'), false);
  }
});

test('database failures return safe messages, log server details, and stop subsequent writes', async () => {
  for (const fail of ['project_table-lookup', 'banks-lookup', 'lookup', 'client-insert', 'client-update', 'loan-insert']) {
    const h = harness({ fail, clients: fail === 'client-update' ? [existing] : [] });
    const result = await h.actions.submitLoanPreApplicationAction(valid);
    assert.deepEqual(result, { success: false, error: "We couldn't submit your application. Please try again." });
    assert.equal(h.logs.length, 1);
    assert.equal(h.logs[0][1].message, 'PRIVATE database detail');
    assert.equal(h.loans.length, 0);
  }
});

test('unchanged inquiry/contact actions still create and reuse a client that loans also reuse', async () => {
  const h = harness();
  for (const [name, data] of [
    ['submitInquiryAction', { project: '1' }],
    ['submitContactAction', { typeOfInquiry: 'Customer Support', message: 'Help' }],
  ]) {
    assert.deepEqual(await h.publicActions[name]({
      firstName: 'Juan', lastName: 'Dela Cruz', email: valid.email, phone: valid.phone, ...data,
    }), { success: true });
  }
  assert.deepEqual(await h.actions.submitLoanPreApplicationAction(valid), { success: true });
  assert.equal(h.clients.length, 1);
  assert.equal(h.loans[0].client_id, h.clients[0].id);
  assert.ok(h.calls.some(call => call.table === 'inquire' && call.op === 'insert'));
  assert.ok(h.calls.some(call => call.table === 'contact' && call.op === 'insert'));
});

test('persisted loan fields feed existing Customer Inbox normalization', async () => {
  const h = harness();
  await h.actions.submitLoanPreApplicationAction(valid);
  const row = {
    ...h.loans[0], created_at: '2026-10-07T04:00:00Z', client: h.clients[0],
    project_table: { title: 'City Clou' }, banks: { bank_name: 'BDO' },
  };
  const [item] = inbox.normalizeCustomerInbox([], [], [row], 'admin-a');
  assert.equal(item.name, valid.buyerName);
  assert.equal(item.project_name, 'City Clou');
  assert.equal(item.bank_name, 'BDO');
  for (const field of ['tower', 'unit_no', 'floor_no', 'co_buyer_name', 'is_agreed']) assert.equal(item[field], row[field]);
});

function clientSubmit(action) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app/partnerbanks/partnerbanksclient.tsx'), 'utf8');
  const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'onSubmit') initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const code = ts.transpileModule('module.exports = ' + initializer, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const calls = [], module = { exports: {} };
  new Function('module', 'submitLoanPreApplicationAction', 'alert', 'reset', 'setIsModalOpen', 'console', 'process', code)(
    module, action, message => calls.push(['alert', message]), () => calls.push(['reset']),
    value => calls.push(['modal', value]), { error() {} }, { env: { NODE_ENV: 'production' } },
  );
  return { submit: module.exports, calls, source };
}

test('client success keeps the success message, resets form and closes modal', async () => {
  let submitted;
  const ui = clientSubmit(async data => { submitted = data; return { success: true }; });
  await ui.submit(valid);
  assert.deepEqual(submitted, valid);
  assert.deepEqual(ui.calls, [['alert', 'Application submitted successfully!'], ['reset'], ['modal', false]]);
  assert.doesNotMatch(ui.source, /from\(['"](?:client|loan_preapp)['"]\)|SUPABASE_SERVICE_ROLE_KEY|createClient/);
});

test('controlled and transport failures keep modal/form open and hide technical details', async () => {
  for (const action of [
    async () => ({ success: false, error: "We couldn't submit your application. Please try again." }),
    async () => { throw new Error('PRIVATE internal transport detail'); },
  ]) {
    const ui = clientSubmit(action);
    await ui.submit(valid);
    assert.deepEqual(ui.calls, [['alert', "We couldn't submit your application. Please try again."]]);
  }
});

test('loan INSERT event refreshes the shared bell/inbox state through the existing provider', async () => {
  const h = harness();
  const slots = [], effects = [], events = [], listeners = new Map();
  let cursor = 0, effectsRegistered = false, fetches = 0, removed = false;
  const browser = {
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: type => listeners.delete(type),
  };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useCallback: callback => callback,
    useEffect: effect => { if (!effectsRegistered) effects.push(effect); },
  };
  const channel = {
    on: (_name, filter, callback) => { events.push({ filter, callback }); return channel; },
    subscribe: callback => { callback('SUBSCRIBED'); return channel; },
  };
  const provider = loadTs('app/admin/components/customer-inbox.tsx', {
    react,
    'next/navigation': {},
    'lucide-react': {},
    '@/utils/supabase/client': {
      createClient: () => ({
        channel: () => channel,
        removeChannel: async () => { removed = true; },
      }),
    },
    '@/app/actions/admin_fetchers': {
      fetchNotificationsAction: async () => {
        fetches++;
        return inbox.normalizeCustomerInbox([], [], h.loans.map(row => ({
          ...row, created_at: '2026-10-07T04:00:00Z', client: h.clients.find(client => client.id === row.client_id),
          project_table: { title: 'City Clou' }, banks: { bank_name: 'BDO' },
        })), 'admin-a');
      },
    },
    '@/lib/customer-inbox': inbox,
  }, console, browser);
  const render = () => {
    cursor = 0;
    return provider.CustomerInboxProvider({ enabled: true, children: null }).props.value;
  };
  const initial = render();
  effectsRegistered = true;
  const cleanup = effects[0]();
  try {
    await initial.refresh();
    assert.equal(render().items.length, 0);
    assert.deepEqual(await h.actions.submitLoanPreApplicationAction(valid), { success: true });
    const event = events.find(event => event.filter.table === 'loan_preapp');
    assert.deepEqual(event.filter, { event: 'INSERT', schema: 'public', table: 'loan_preapp' });
    event.callback();
    await initial.refresh();
    const updated = render();
    assert.equal(updated.items[0].type, 'loan_application');
    assert.equal(updated.items[0].name, valid.buyerName);
    assert.equal(updated.unreadCount, 1);
    assert.ok(fetches >= 2);
  } finally {
    cleanup();
  }
  assert.equal(removed, true);
  assert.equal(listeners.size, 0);
});
