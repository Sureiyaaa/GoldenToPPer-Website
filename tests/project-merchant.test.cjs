const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const actionSource = fs.readFileSync(path.join(root, 'app/actions/projects.ts'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'app/admin/projects/page.tsx'), 'utf8');
const accessMigrationSource = fs.readFileSync(path.join(root, 'supabase/migrations/20261103000000_harden_customer_and_project_access.sql'), 'utf8');

function projectActions({ session = true, canEdit = true } = {}) {
  const state = {
    project: { id: 1, title: 'City Clou', merchant_id: null },
    writes: [],
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = 'select';
      this.filters = [];
    }
    select(columns) { this.columns = columns; return this; }
    update(values) { this.operation = 'update'; this.values = values; return this; }
    insert(values) { this.operation = 'insert'; this.values = values; return this; }
    upsert(values) { this.operation = 'upsert'; this.values = values; return this; }
    delete() { this.operation = 'delete'; return this; }
    eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
    is(column, value) { this.filters.push((row) => row[column] === value); return this; }
    ilike(column, value) { this.filters.push((row) => String(row[column]).toLowerCase() === String(value).toLowerCase()); return this; }
    in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
    order() { return this; }
    limit() { return this; }
    single() { return this.execute('single'); }
    maybeSingle() { return this.execute('maybeSingle'); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute(cardinality) {
      let rows = this.table === 'project_table' ? [state.project] : [];
      rows = rows.filter((row) => this.filters.every((filter) => filter(row)));

      if (this.operation === 'update') {
        for (const row of rows) Object.assign(row, this.values);
        state.writes.push({ table: this.table, values: { ...this.values } });
      } else if (this.operation === 'insert' || this.operation === 'upsert' || this.operation === 'delete') {
        state.writes.push({ table: this.table, values: this.values });
      }

      const data = cardinality ? (rows[0] ?? null) : rows;
      return { data, error: null };
    }
  }

  const actionCode = ts.transpileModule(actionSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const actionModule = { exports: {} };
  new Function('require', 'module', 'exports', 'console', actionCode)(
    (name) => {
      if (name === '@supabase/supabase-js') {
        return { createClient: () => ({ from: (table) => new Query(table) }) };
      }
      if (name === './auth') {
        return {
          getCustomSession: async () => session ? 'admin-session' : null,
          getCurrentUser: async () => ({ id: 1, username: 'admin' }),
          getRBACProfile: async () => ({
            permissions: {
              edit_project: { can_view: true, can_edit: canEdit },
            },
          }),
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    actionModule,
    actionModule.exports,
    { log() {}, warn() {}, error() {} }
  );

  return { actions: actionModule.exports, state };
}

function savePayload(merchantId) {
  return {
    targetProjectId: 1,
    cleanProjectData: { merchant_id: merchantId },
    finalData: {
      merchant_id: merchantId,
      tags: [],
      towers: [],
      unit_layouts: [],
      amenities: [],
      child_markers: [],
      map_latitude: '',
      map_longitude: '',
    },
  };
}

test('admin merchant field loads, participates in dirty state, and saves nullable values through the existing workflow', () => {
  assert.match(pageSource, /merchant_id: data\.projData\.merchant_id \|\| ""/);
  assert.match(pageSource, /register\('merchant_id'\)/);
  assert.match(pageSource, /merchant_id: finalData\.merchant_id\?\.trim\(\) \|\| null/);
  assert.match(pageSource, />\s*Paynamics\s*</);
  assert.match(pageSource, />\s*Merchant ID\s*</);
});

test('authorized project editors can persist and reload a merchant ID without unrelated project fields', async () => {
  const harness = projectActions();
  const result = await harness.actions.saveProjectAction(savePayload('mock-merchant'));
  assert.equal(result.success, true);
  assert.equal(harness.state.project.merchant_id, 'mock-merchant');
  assert.equal(harness.state.project.title, 'City Clou');

  const reloaded = await harness.actions.fetchProjectForEdit(1);
  assert.equal(reloaded.projData.merchant_id, 'mock-merchant');

  const projectWrite = harness.state.writes.find((write) => write.table === 'project_table');
  assert.deepEqual(projectWrite.values, { merchant_id: 'mock-merchant' });
});

test('blank merchant IDs persist as null', async () => {
  const harness = projectActions();
  const result = await harness.actions.saveProjectAction(savePayload(null));
  assert.equal(result.success, true);
  assert.equal(harness.state.project.merchant_id, null);
});

test('public and unauthorized users cannot update project merchant IDs', async () => {
  for (const options of [{ session: false }, { canEdit: false }]) {
    const harness = projectActions(options);
    const result = await harness.actions.saveProjectAction(savePayload('attacker-value'));
    assert.equal(result.success, false);
    assert.match(result.error, /Unauthorized/);
    assert.equal(harness.state.project.merchant_id, null);
    assert.equal(harness.state.writes.length, 0);
  }
});

test('merchant updates remain behind the project allowlist and server edit authorization', () => {
  assert.match(actionSource, /PROJECT_TABLE_FIELDS[^\n]*'merchant_id'/);
  const authorization = actionSource.indexOf('await authorizeProjectOperation(operation)');
  const projectUpdate = actionSource.indexOf('.update(filteredCleanData)', authorization);
  assert.ok(authorization >= 0 && projectUpdate > authorization);
});

test('project grants are read-only, column-limited, and retain active public pages', () => {
  assert.match(accessMigrationSource, /revoke insert, update, delete on table public\.project_table from public, anon, authenticated/);
  assert.match(accessMigrationSource, /create policy project_table_public_read_active[\s\S]*using \(is_active = true and deleted_at is null\)/);
  const publicGrant = accessMigrationSource.match(/grant select \(([\s\S]*?)\) on table public\.project_table to anon, authenticated/)?.[1] || '';
  for (const field of ['id', 'title', 'slug', 'status', 'address', 'city', 'country', 'sqm', 'unit_total', 'image', 'img_awards', 'map_icon', 'virtual_tour_url', 'is_active', 'deleted_at']) {
    assert.match(publicGrant, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(publicGrant, /\bmerchant_id\b/);
  assert.doesNotMatch(publicGrant, /\bproximity\b/, 'unused proximity column does not exist in production');

  for (const file of ['app/projects/page.tsx', 'app/projects/[slug]/page.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /from\('project_table'\)[\s\S]{0,100}select\((?:'|`)\s*\*/);
    assert.doesNotMatch(source, /\bproximity\b/, 'public project pages must not request the nonexistent column');
  }
});
