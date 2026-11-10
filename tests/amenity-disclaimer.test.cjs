const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../app/actions/projects.ts'), 'utf8');
const allowlist = source.match(/const AMENITY_FIELDS = [^\n]+/)[0];
const filter = source.slice(source.indexOf('function filterObjectToAllowlist('), source.indexOf('// Phase 2.3C: Validate child record'));
const builder = source.slice(source.indexOf('const buildAmenityValues = ('), source.indexOf('for (const item of amenities)'));
const code = ts.transpileModule(`${allowlist}\n${filter}\n${builder}\nreturn buildAmenityValues;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const buildAmenityValues = new Function(code)();

test('database write values retain enabled and disabled disclaimers while filtering unrelated fields', () => {
  for (const enabled of [true, false]) {
    const values = buildAmenityValues({
      title: 'Pool', disclaimer_enabled: enabled,
      disclaimer_text: '  Artist’s impression only.  ', project_id: 999,
    });
    assert.equal(values.disclaimer_enabled, enabled);
    assert.equal(values.disclaimer_text, 'Artist’s impression only.');
    assert.equal(values.project_id, undefined);
  }
});

test('blank disclaimer text uses the default and long text is limited', () => {
  assert.equal(buildAmenityValues({ disclaimer_text: '  ' }).disclaimer_text, "Architect's vision only.");
  assert.equal(buildAmenityValues({ disclaimer_text: 'x'.repeat(201) }).disclaimer_text.length, 200);
});
