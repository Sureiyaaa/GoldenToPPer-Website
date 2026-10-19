// Exercise the real save action and schema with in-memory auth/database mocks.
// No requests are sent to storage or Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const snapshot = value => JSON.parse(JSON.stringify(value));

function fixture() {
  const state = { row: { id: 'article', image: '/cover.jpg', show_cover_on_article: false }, writes: [], operations: [] };
  const client = { from: () => ({
    select() { return this; }, eq() { return this; },
    async single() { return { data: state.row, error: null }; },
    // Snapshot the JSON wire payload, including omission of undefined fields.
    update(value) { const sent = snapshot(value); state.writes.push(sent); state.operations.push('update'); Object.assign(state.row, sent); return this; },
    insert([value]) { const sent = snapshot(value); state.writes.push(sent); state.operations.push('insert'); state.row = { show_cover_on_article: true, ...sent }; return this; },
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
  return {
    state,
    action: load(path.join(root, 'app/actions/news.ts')),
    schema: load(path.join(root, 'lib/validations/news.ts')),
    sections: load(path.join(root, 'app/types/article-sections.ts')),
  };
}

const richBody = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const section = (id = 'section-a', order = 0) => ({ id, headingEnabled: false, layout: 'image-above', body: richBody('Section content'), order });
const sectionDocument = sections => ({ version: 1, sections, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' });
const historicalLayouts = ['image-above', 'title-above', 'image-contained', 'sidebar-image-right', 'sidebar-image-left'];
const articleContent = { title: 'Existing article', excerpt: 'Article content remains available.' };

test('production section validators accept optional heading/image fields, empty documents and stored section placements', () => {
  const { sections } = fixture();
  const layouts = ['image-above', 'image-below', 'image-left', 'image-right', 'image-contained', 'text-only'];
  for (const layout of layouts) {
    const value = { ...section(), layout };
    assert.ok(sections.isValidSectionLayout(layout));
    assert.ok(sections.isValidSection(value), 'heading text and image are optional for every stored placement');
    assert.ok(sections.isValidSectionsDocument(sectionDocument([value])));
  }
  for (const value of [
    { ...section(), headingEnabled: true },
    { ...section(), heading: 'Retained hidden heading', image: '/section.jpg' },
    { ...section(), body: { type: 'doc', content: [] } },
    { ...section(), body: richBody('X') },
    { ...section(), body: richBody('word '.repeat(1000)) },
  ]) assert.ok(sections.isValidSection(value), 'length guidance is not a validation restriction');
  assert.ok(sections.isValidSectionsDocument(sectionDocument([])), 'empty sections documents are supported');
});

test('production section validators reject missing identifiers, incorrect required fields and malformed documents safely', () => {
  const { sections } = fixture();
  const invalidSections = [null, undefined, [], {},
    ...[undefined, null, '', 12].map(id => ({ ...section(), id })),
    ...[undefined, 'yes', 1].map(headingEnabled => ({ ...section(), headingEnabled })),
    ...[undefined, null, 'unknown', 'sidebar-image-right', 1].map(layout => ({ ...section(), layout })),
    ...[undefined, null, 'plain text', 1].map(body => ({ ...section(), body })),
    ...[undefined, null, 'zero', false].map(order => ({ ...section(), order })),
  ];
  for (const value of invalidSections) {
    assert.ok(!sections.isValidSection(value), JSON.stringify(value));
    assert.ok(!sections.isValidSectionsDocument(sectionDocument([value])));
  }
  const valid = sectionDocument([section()]);
  for (const value of [null, undefined, [], {},
    ...[undefined, null, '1', 0, 2].map(version => ({ ...valid, version })),
    ...[undefined, null, {}, 'sections'].map(items => ({ ...valid, sections: items })),
    { ...valid, createdAt: undefined }, { ...valid, createdAt: 123 }, { ...valid, updatedAt: null },
  ]) assert.ok(!sections.isValidSectionsDocument(value), JSON.stringify(value));
});

test('production legacy adaptation uses the current optional-image model without rewriting the source article', () => {
  const { sections } = fixture();
  for (const image of [undefined, '/legacy-cover.jpg']) {
    const legacy = { title: 'Legacy article', excerpt: 'Legacy paragraph', image, article_layout: 'sidebar-image-left' };
    const before = snapshot(legacy);
    const doc = sections.adaptLegacyArticleToSections(legacy);
    assert.ok(sections.isValidSectionsDocument(doc));
    assert.equal(doc.sections.length, 1);
    assert.ok(doc.sections[0].id.startsWith('legacy-'));
    assert.equal(doc.sections[0].headingEnabled, false);
    assert.equal(doc.sections[0].layout, 'image-above', 'adapted sections use a supported placement even without an image');
    assert.equal(doc.sections[0].image, image);
    assert.deepEqual(snapshot(doc.sections[0].body), richBody('Legacy paragraph'));
    assert.deepEqual(snapshot(legacy), before);
  }
});

test('production section excerpts scan array order across sections and enforce the existing 200-character limit', () => {
  const { sections } = fixture();
  const empty = { ...section('empty', 99), body: { type: 'doc', content: [{ type: 'paragraph' }] } };
  const first = { ...section('first', 7), body: { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '   ' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(199), marks: [{ type: 'bold' }] }, { type: 'text', text: 'YZ', marks: [{ type: 'italic' }] }] },
  ] } };
  const doc = sectionDocument([empty, first, section('later', 0)]);
  const before = snapshot(doc);
  assert.equal(sections.deriveExcerptFromSections(doc), 'x'.repeat(199) + 'Y');
  assert.deepEqual(doc, before, 'excerpt derivation does not sort sections or alter their rich content');
  assert.equal(sections.deriveExcerptFromSections(sectionDocument([])), '');
});

test('real save action normalizes section JSON and preserves stable IDs, order, hidden headings and unrelated article fields', async () => {
  const doc = sectionDocument([
    { ...section('b', 7), heading: 'Hidden heading', image: '/hidden-section.jpg', layout: 'text-only' },
    { ...section('a', 2), layout: 'image-contained' },
  ]);
  for (const input of [doc, JSON.stringify(doc)]) {
    const { state, action } = fixture();
    Object.assign(state.row, { ...articleContent, slug: 'retained-slug', date: '2026-10-19', category: 'News', article_layout: 'sidebar-image-left', article_content: richBody('Retained legacy content') });
    const before = snapshot(state.row);
    const payload = { article_sections: input };
    const result = await action.saveArticleToDB(payload, 'article');
    assert.equal(result.success, true);
    assert.equal(state.operations.at(-1), 'update');
    assert.deepEqual(state.writes.at(-1), { article_sections: doc, excerpt: 'Section content' });
    assert.deepEqual(state.row, { ...before, article_sections: doc, excerpt: 'Section content' });
    assert.deepEqual(snapshot(payload), { article_sections: input }, 'the caller payload is unchanged');
    const reordered = sectionDocument([{ ...doc.sections[1], order: 0 }, { ...doc.sections[0], order: 1 }]);
    await action.saveArticleToDB({ article_sections: reordered }, 'article');
    assert.deepEqual(state.row.article_sections, reordered, 'the submitted canonical array and order numbers are retained');
    const legacyContent = richBody('Explicit legacy content supplies the final excerpt.');
    await action.saveArticleToDB({ article_sections: reordered, article_content: JSON.stringify(legacyContent) }, 'article');
    assert.deepEqual(state.row.article_content, legacyContent);
    assert.equal(state.row.excerpt, 'Explicit legacy content supplies the final excerpt.', 'supplied article_content retains its existing excerpt precedence');
    assert.deepEqual(state.row.article_sections, reordered);
    const blank = sectionDocument([]);
    await action.saveArticleToDB({ ...articleContent, article_sections: blank }, 'article');
    assert.deepEqual(state.row.article_sections, blank);
    assert.equal(state.row.excerpt, articleContent.excerpt, 'empty sections do not invent an excerpt');
  }
});

test('real save action rejects malformed section submissions before any database write', async () => {
  const { state, action } = fixture();
  const before = snapshot(state.row);
  const valid = sectionDocument([section()]);
  for (const input of ['{invalid json}', 'null', [], {}, { ...valid, version: 2 }, { ...valid, sections: {} }, sectionDocument([null]), sectionDocument([{ ...section(), id: '' }]), sectionDocument([{ ...section(), body: 'invalid' }])]) {
    await assert.rejects(action.saveArticleToDB({ ...articleContent, article_sections: input }, 'article'), /Invalid article sections:/);
    assert.equal(state.writes.length, 0);
    assert.deepEqual(state.row, before);
  }
  await assert.rejects(action.saveArticleToDB({ article_sections: sectionDocument([]) }, null), /Article must have content/);
  assert.equal(state.writes.length, 0);
});

test('real save action accepts all five historical article layouts on creation and edit while retaining unrelated data', async () => {
  for (const editId of [null, 'article']) {
    for (const layout of historicalLayouts) {
      const { state, action } = fixture();
      Object.assign(state.row, { ...articleContent, slug: 'existing-slug', category: 'News', date: '2026-10-19', article_sections: sectionDocument([section()]), article_content: richBody('Stored rich content'), article_layout: layout });
      const before = snapshot(state.row);
      const payload = { ...articleContent, title: 'Updated article title', article_layout: layout };
      const result = await action.saveArticleToDB(payload, editId);
      assert.equal(result.success, true);
      assert.equal(state.operations.at(-1), editId ? 'update' : 'insert');
      assert.equal(state.writes.at(-1).article_layout, layout);
      assert.equal(result.data[0].article_layout, layout);
      if (editId) assert.deepEqual(state.row, { ...before, ...payload }, 'partial edits preserve sections, cover preference, slug and other omitted fields');
    }
  }
});

test('real save action distinguishes omitted, undefined and null article layouts on creation and edit', async () => {
  for (const editId of [null, 'article']) {
    for (const fields of [{}, { article_layout: undefined }, { article_layout: null }]) {
      const { state, action } = fixture();
      state.row.article_layout = 'sidebar-image-left';
      await action.saveArticleToDB({ ...articleContent, ...fields }, editId);
      const explicitNull = fields.article_layout === null;
      const expected = explicitNull ? null : editId ? 'sidebar-image-left' : 'image-above';
      assert.equal(state.row.article_layout, expected);
      assert.equal(Object.hasOwn(state.writes.at(-1), 'article_layout'), explicitNull || !editId, 'omitted edit fields stay out of the JSON wire payload');
    }
  }
});

test('real save action rejects unsupported article layouts and filters unauthorized fields on create and edit', async () => {
  for (const editId of [null, 'article']) {
    const { state, action } = fixture();
    const before = snapshot(state.row);
    for (const article_layout of ['', 'invalid-layout', 'text-only', 'image-left', 1, false, {}]) {
      await assert.rejects(action.saveArticleToDB({ ...articleContent, article_layout }, editId), /Invalid layout preset:/);
      assert.equal(state.writes.length, 0);
      assert.deepEqual(state.row, before);
    }
    await action.saveArticleToDB({ ...articleContent, article_layout: 'title-above', id: 'injected-id', is_active: false, is_archived: true, created_at: 'injected', malicious_field: 'blocked' }, editId);
    assert.deepEqual(state.writes.at(-1), { ...articleContent, article_layout: 'title-above' });
    if (editId) assert.equal(state.row.id, 'article');
  }
});

test('shared NewsSchema strips unknown layout and section fields rather than supplying obsolete layout validation', () => {
  const { schema } = fixture();
  const values = { ...articleContent, date: '2026-10-19', category: 'News', slug: 'existing-article' };
  assert.deepEqual(snapshot(schema.NewsSchema.parse(values)), values);
  for (const article_layout of [...historicalLayouts, null, 'invalid-layout']) {
    const parsed = schema.NewsSchema.parse({ ...values, article_layout, article_sections: sectionDocument([section()]), malicious_field: 'blocked' });
    assert.deepEqual(snapshot(parsed), values, 'legacy layout validation belongs to the action and editor form schema');
  }
});

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
