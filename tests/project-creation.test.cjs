const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const valid = {
  title: 'New Project', slug: '/new-project', status: 'Pre-selling',
  address: 'Test Address', city: 'Cebu', country: 'Philippines',
  sqm: '', unit_total: '',
};
const privateError = { code: '23505', message: 'PRIVATE duplicate key value violates unique constraint navbar_projects_project_id_unique' };

function harness(options = {}) {
  const projects = (options.projects || []).map(row => ({ deleted_at: null, ...row }));
  const navigation = (options.navigation || []).map(row => ({ ...row }));
  const calls = [], logs = [];
  let nextProjectId = Math.max(100, ...projects.map(row => row.id)) + 1;
  let nextNavId = Math.max(100, ...navigation.map(row => row.id)) + 1;

  class Query {
    constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.orders = []; }
    select(columns) { this.columns = columns; return this; }
    insert(values) { this.op = 'insert'; this.values = values; return this; }
    upsert(values, settings) { this.op = 'upsert'; this.values = values; this.settings = settings; return this; }
    update(values) { this.op = 'update'; this.values = values; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(column, value) { this.filters.push(row => row[column] === value); this.filterColumns = [...(this.filterColumns || []), column]; return this; }
    neq(column, value) { this.filters.push(row => row[column] !== value); return this; }
    is(column, value) { this.filters.push(row => row[column] === value); return this; }
    in(column, values) { this.filters.push(row => values.includes(row[column])); return this; }
    order(column, { ascending }) { this.orders.push([column, ascending]); return this; }
    single() { return this.execute('single'); }
    maybeSingle() { return this.execute('maybeSingle'); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute(cardinality) {
      calls.push({ table: this.table, op: this.op, values: this.values, columns: this.columns });
      const isNav = this.table === 'navbar_projects';
      const stage = isNav
        ? (this.op === 'select' && this.filterColumns?.includes('project_id') ? 'navigation-read' : `navigation-${this.op}`)
        : (this.op === 'select' && this.filterColumns?.includes('slug') ? 'slug-check' : `project-${this.op}`);
      if (options.throwAt === stage) throw new Error(`PRIVATE transport error at ${stage}`);
      if ((options.fail || []).includes(stage)) return { data: null, error: privateError };

      const table = isNav ? navigation : projects;
      let rows = table.filter(row => this.filters.every(filter => filter(row)));
      if (this.op === 'insert' || this.op === 'upsert') {
        rows = [];
        for (const values of Array.isArray(this.values) ? this.values : [this.values]) {
          if (isNav) {
            if (navigation.some(row => row.project_id === values.project_id)) {
              if (this.op === 'upsert' && this.settings.ignoreDuplicates) continue;
              return { data: null, error: privateError };
            }
            const row = { id: nextNavId++, ...values };
            navigation.push(row);
            rows.push(row);
          } else {
            const row = { id: nextProjectId++, deleted_at: null, ...values };
            projects.push(row);
            rows.push(row);
            if (!options.noTrigger) {
              // Model the supplied live auto_insert_navbar_project() definition:
              // its AFTER INSERT row exists before the insert response arrives.
              const nextOrder = Math.max(0, ...navigation.map(item => item.display_order ?? 0)) + 1;
              const nav = {
                id: nextNavId++, project_id: row.id, nav_title: row.title,
                nav_image_url: '/images/placeholder.webp',
                tagline: 'Discover our newest development.',
                display_order: nextOrder, is_active: row.is_active,
              };
              navigation.push(nav);
              if (options.duplicateTriggerRows) navigation.push({ ...nav, id: nextNavId++ });
            }
          }
        }
      } else if (this.op === 'update') {
        if (isNav && options.navigationUpdateMatchesZero) rows = [];
        for (const row of rows) Object.assign(row, this.values);
      } else if (this.op === 'delete') {
        for (const row of rows) {
          table.splice(table.indexOf(row), 1);
          if (!isNav) {
            // Match navbar_projects_project_id_fkey ON DELETE CASCADE.
            for (let i = navigation.length - 1; i >= 0; i--) {
              if (navigation[i].project_id === row.id) navigation.splice(i, 1);
            }
          }
        }
      }
      rows = [...rows].sort((a, b) => {
        for (const [column, ascending] of this.orders) {
          if (a[column] !== b[column]) return (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      if ((cardinality === 'single' && rows.length !== 1) || (cardinality === 'maybeSingle' && rows.length > 1)) {
        return { data: null, error: { code: 'PGRST116', message: `PRIVATE expected one row, received ${rows.length}` } };
      }
      return { data: cardinality ? rows[0] ?? null : rows, error: null };
    }
  }
  const source = fs.readFileSync(path.join(root, 'app/actions/projects.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', code)(
    name => {
      if (name === '@supabase/supabase-js') return { createClient: () => ({ from: table => new Query(table) }) };
      if (name === './auth') return { getCustomSession: async () => options.session === false ? null : 'test-admin' };
      throw new Error(`Unexpected import: ${name}`);
    }, module, module.exports, { error: (...args) => logs.push(args) },
  );
  return { actions: module.exports, projects, navigation, calls, logs };
}

test('A/B/C/D/H: two projects reuse trigger rows, start Hidden, and keep the trigger order', async () => {
  const existingNav = { id: 7, project_id: 1, display_order: 9, nav_title: 'Custom', tagline: 'Keep', nav_image_url: '/custom.png', is_active: false };
  const h = harness({ projects: [{ id: 1, slug: '/existing' }], navigation: [existingNav] });
  const first = await h.actions.createBasicProjectAction({ ...valid, title: ' New Project ' });
  const second = await h.actions.createBasicProjectAction({ ...valid, title: 'Second Project', slug: '/second-project' });
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.notEqual(first.projectId, second.projectId);
  for (const [result, order] of [[first, 10], [second, 11]]) {
    const projects = h.projects.filter(row => row.id === result.projectId);
    const nav = h.navigation.filter(row => row.project_id === result.projectId);
    assert.equal(projects.length, 1);
    assert.equal(nav.length, 1);
    assert.equal(projects[0].is_active, false);
    assert.equal(nav[0].nav_title, projects[0].title);
    assert.equal(nav[0].tagline, '');
    assert.equal(nav[0].nav_image_url, null);
    assert.equal(nav[0].is_active, true);
    assert.equal(nav[0].display_order, order);
  }
  assert.deepEqual(h.navigation[0], existingNav);
  assert.equal(h.calls.filter(call => call.table === 'navbar_projects' && ['insert', 'upsert'].includes(call.op)).length, 0);
  assert.ok(h.calls.filter(call => call.table === 'navbar_projects' && call.op === 'update').every(call => !Object.hasOwn(call.values, 'display_order')));
});

test('E: duplicate active slug returns the existing friendly error without writes', async () => {
  const h = harness({ projects: [{ id: 1, slug: valid.slug }] });
  assert.deepEqual(await h.actions.createBasicProjectAction(valid), {
    success: false, error: 'That URL slug is already being used by another project.',
  });
  assert.equal(h.projects.length, 1);
  assert.equal(h.navigation.length, 0);
  assert.ok(h.calls.every(call => call.op === 'select'));
});

test('F/G/H: archive, restore, and ensure reuse the original navigation row and preserve Hidden visibility', async () => {
  const h = harness();
  const created = await h.actions.createBasicProjectAction(valid);
  const navId = h.navigation[0].id;
  await h.actions.archiveProjectAction(created.projectId);
  assert.ok(h.projects[0].deleted_at);
  assert.equal(h.navigation[0].is_active, false);
  await h.actions.restoreArchivedProjectAction(created.projectId);
  assert.equal(h.projects[0].deleted_at, null);
  assert.equal(h.projects[0].is_active, false);
  assert.equal(h.navigation[0].is_active, false);
  assert.equal(h.navigation.length, 1);
  assert.equal(h.navigation[0].id, navId);
  assert.deepEqual(await h.actions.ensureProjectNavigationEntriesAction(), {
    success: true, createdCount: 0, duplicateRowsRemoved: 0,
  });
  assert.equal(h.navigation.length, 1);
  assert.ok(!h.calls.some(call => call.table === 'navbar_projects' && ['insert', 'upsert'].includes(call.op)));
});

test('ensure still repairs legacy missing rows once and preserves customized existing entries', async () => {
  const customized = { id: 1, project_id: 1, nav_title: 'Custom', tagline: 'Keep', nav_image_url: '/keep.png', display_order: 4, is_active: false };
  const h = harness({
    projects: [{ id: 1, title: 'Existing' }, { id: 2, title: 'Legacy' }],
    navigation: [customized],
  });
  assert.equal((await h.actions.ensureProjectNavigationEntriesAction()).createdCount, 1);
  assert.equal((await h.actions.ensureProjectNavigationEntriesAction()).createdCount, 0);
  assert.deepEqual(h.navigation[0], customized);
  assert.equal(h.navigation.length, 2);
  assert.equal(h.navigation[1].display_order, 5);
});

test('missing, multiple, unreadable, failed-update, or vanished trigger rows cause controlled rollback without a second insert', async () => {
  for (const options of [
    { noTrigger: true }, { duplicateTriggerRows: true },
    { fail: ['navigation-read'] }, { fail: ['navigation-update'] },
    { navigationUpdateMatchesZero: true }, { throwAt: 'navigation-update' },
  ]) {
    const h = harness(options);
    const result = await h.actions.createBasicProjectAction(valid);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Project could not be created with its navigation item. Please try again.');
    assert.equal(h.projects.length, 0);
    assert.equal(h.navigation.length, 0);
    assert.ok(h.logs.length > 0);
    assert.ok(!h.calls.some(call => call.table === 'navbar_projects' && ['insert', 'upsert'].includes(call.op)));
  }
});

test('cascade cleanup removes only the failed new project and its trigger navigation row', async () => {
  const project = { id: 1, slug: '/existing', deleted_at: null };
  const nav = { id: 1, project_id: 1, display_order: 3 };
  const h = harness({ projects: [project], navigation: [nav], fail: ['navigation-update'] });
  assert.equal((await h.actions.createBasicProjectAction(valid)).success, false);
  assert.deepEqual(h.projects, [project]);
  assert.deepEqual(h.navigation, [nav]);
});

test('failed delete archives the incomplete project, releases its active slug, and tells the admin where it went', async () => {
  const options = { fail: ['navigation-update', 'project-delete'] };
  const h = harness(options);
  const result = await h.actions.createBasicProjectAction(valid);
  assert.equal(result.success, false);
  assert.match(result.error, /incomplete project was archived/);
  assert.doesNotMatch(result.error, /PRIVATE|23505|constraint/);
  assert.equal(h.projects.length, 1);
  assert.ok(h.projects[0].deleted_at);
  assert.equal(h.projects[0].is_active, false);
  assert.equal(h.navigation.length, 1);
  assert.ok(h.logs.some(args => JSON.stringify(args).includes('Project cleanup failed')));
  options.fail = [];
  assert.equal((await h.actions.createBasicProjectAction(valid)).success, true);
});

test('transport failures during delete still use the archive fallback', async () => {
  const h = harness({ fail: ['navigation-update'], throwAt: 'project-delete' });
  const result = await h.actions.createBasicProjectAction(valid);
  assert.match(result.error, /incomplete project was archived/);
  assert.ok(h.projects[0].deleted_at);
});

test('if delete and archive both fail, the controlled error identifies the remaining project for recovery', async () => {
  const h = harness({ fail: ['navigation-update', 'project-delete', 'project-update'] });
  const result = await h.actions.createBasicProjectAction(valid);
  assert.equal(result.success, false);
  assert.match(result.error, new RegExp(`Review project ${h.projects[0].id} in Projects`));
  assert.doesNotMatch(result.error, /PRIVATE|23505|constraint/);
  assert.equal(h.projects[0].is_active, false);
  assert.ok(h.logs.some(args => JSON.stringify(args).includes('Incomplete project archive failed')));
});

test('database failures during slug lookup or project insert return a generic message and log technical details', async () => {
  for (const stage of ['slug-check', 'project-insert']) {
    const h = harness({ fail: [stage] });
    assert.deepEqual(await h.actions.createBasicProjectAction(valid), {
      success: false, error: 'Failed to create project. Please try again.',
    });
    assert.equal(h.projects.length, 0);
    assert.equal(h.navigation.length, 0);
    assert.ok(h.logs.some(args => JSON.stringify(args).includes(privateError.message)));
  }
});

test('authentication and input validation preserve friendly errors before any database access', async () => {
  for (const [options, input, message] of [
    [{ session: false }, valid, 'Unauthorized: Please log in.'],
    [{}, { ...valid, title: ' ' }, 'Project title is required.'],
    [{}, { ...valid, slug: 'no-slash' }, 'URL slug must start with "/".'],
    [{}, { ...valid, status: '' }, 'Project status is required.'],
    [{}, { ...valid, city: '' }, 'Project location is required.'],
  ]) {
    const h = harness(options);
    assert.deepEqual(await h.actions.createBasicProjectAction(input), { success: false, error: message });
    assert.equal(h.calls.length, 0);
  }
});

function loadCreateHandler(dependencies) {
  const source = fs.readFileSync(path.join(root, 'app/admin/projects/page.tsx'), 'utf8');
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'onCreateBasicProject') declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(declaration, 'creation callback must exist');
  const code = ts.transpileModule(`const ${declaration.getText(tree)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${code}\nreturn onCreateBasicProject;`)(...Object.values(dependencies));
}

test('A: UI calls creation once, audits success, and redirects into the editor even if audit logging fails', async () => {
  for (const failAudit of [false, true]) {
    const events = [];
    const handler = loadCreateHandler({
      setCreateError: value => events.push(['error', value]),
      createBasicProjectAction: async input => { events.push(['create', input]); return { success: true, projectId: 123 }; },
      createAuditLogAction: async (...args) => { events.push(['audit', ...args]); if (failAudit) throw new Error('Audit unavailable'); },
      router: { replace: url => events.push(['redirect', url]) },
      console: { warn: () => {} },
    });
    await handler(valid);
    assert.deepEqual(events.map(event => event[0]), ['error', 'create', 'audit', 'redirect']);
    assert.deepEqual(events.at(-1), ['redirect', '/admin/projects?edit=123']);
    assert.deepEqual(events[2].at(-1), { entityId: 123 });
  }
});

test('UI displays controlled creation failures without auditing or redirecting', async () => {
  const errors = [];
  const handler = loadCreateHandler({
    setCreateError: value => errors.push(value),
    createBasicProjectAction: async () => ({ success: false, error: 'Project could not be created with its navigation item. Please try again.' }),
    createAuditLogAction: () => assert.fail('failed creation must not be audited'),
    router: { replace: () => assert.fail('failed creation must not redirect') },
    console,
  });
  await handler(valid);
  assert.deepEqual(errors, ['', 'Project could not be created with its navigation item. Please try again.']);
});
