// Exercise the real save action and schema with in-memory auth/database mocks.
// No requests are sent to storage or Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function fixture() {
  const state = { row: { id: 'article', image: '/cover.jpg', show_cover_on_article: false }, writes: [] };
  const client = { from: () => ({
    select() { return this; }, eq() { return this; },
    async single() { return { data: state.row, error: null }; },
    update(value) { state.writes.push(value); Object.assign(state.row, value); return this; },
    insert([value]) { state.writes.push(value); state.row = { show_cover_on_article: true, ...value }; return this; },
    then(resolve) { resolve({ data: [state.row], error: null }); },
  }) };
  const mocks = {
    '@supabase/supabase-js': { createClient: () => client },
    'next/cache': { revalidatePath() {} },
    './auth': { getRBACProfile: async () => ({ permissions: 'SUPER_ADMIN' }) },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const localRequire = name => {
      if (mocks[name]) return mocks[name];
      if (name.startsWith('@/')) return load(path.join(root, name.slice(2)) + '.ts');
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    };
    vm.runInNewContext(source, { module, exports: module.exports, require: localRequire, process }, { filename: file });
    return module.exports;
  }
  return { state, action: load(path.join(root, 'app/actions/news.ts')), schema: load(path.join(root, 'lib/validations/news.ts')) };
}

test('cover visibility validates booleans and survives unrelated partial saves', async () => {
  const { state, action, schema } = fixture();
  const content = { title: 'Existing article', excerpt: 'Article content remains available.' };
  await action.saveArticleToDB(content, 'article');
  assert.equal(Object.hasOwn(state.writes.at(-1), 'show_cover_on_article'), false);
  assert.equal(state.row.show_cover_on_article, false);
  assert.equal(state.row.image, '/cover.jpg');
  for (const visible of [true, false]) {
    await action.saveArticleToDB({ ...content, show_cover_on_article: visible }, 'article');
    assert.equal(state.row.show_cover_on_article, visible);
    assert.equal(state.row.image, '/cover.jpg');
  }
  for (const value of [null, 'false', 0, {}]) {
    const count = state.writes.length;
    await assert.rejects(action.saveArticleToDB({ ...content, show_cover_on_article: value }, 'article'), /must be a boolean/);
    assert.equal(state.writes.length, count);
  }
  const values = { ...content, date: '2026-10-19', category: 'News', slug: 'existing-article' };
  assert.equal(Object.hasOwn(schema.NewsSchema.parse(values), 'show_cover_on_article'), false, 'shared validation does not inject a default into partial edits');
  assert.equal(schema.NewsSchema.parse({ ...values, show_cover_on_article: false }).show_cover_on_article, false);
  assert.equal(schema.NewsSchema.safeParse({ ...values, show_cover_on_article: 'false' }).success, false);
  await action.saveArticleToDB(content, null);
  assert.equal(Object.hasOwn(state.writes.at(-1), 'show_cover_on_article'), false, 'omitted create preference uses the database default');
});

test('migration adds a visible default without rewriting article assets or layouts', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261019000000_add_news_cover_visibility.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS show_cover_on_article BOOLEAN NOT NULL DEFAULT true/i);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|DROP)\b/i);
});
