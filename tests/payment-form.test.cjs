const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../lib/payment-form.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const helperModule = { exports: {} };
new Function('module', 'exports', code)(helperModule, helperModule.exports);

const {
  getProjectMerchantId,
  isValidPhilippineMobileSubscriber,
  normalizePhilippineMobileSubscriber,
  toPaymentApiContactNumber,
} = helperModule.exports;

test('normalizes common Philippine mobile formats to ten subscriber digits', () => {
  for (const value of [
    '9123456789',
    '09123456789',
    '+63 912 345 6789',
    '63-912-345-6789',
    '+63 (0) 912-345-6789',
    '0063 912 345 6789',
  ]) {
    assert.equal(normalizePhilippineMobileSubscriber(value), '9123456789');
  }
});

test('strips accidental repeated prefixes and limits pasted input', () => {
  assert.equal(normalizePhilippineMobileSubscriber('+63 63 09123456789'), '9123456789');
  assert.equal(normalizePhilippineMobileSubscriber('09123456789000'), '9123456789');
});

test('validates Philippine subscriber numbers and preserves the local API contract', () => {
  assert.equal(isValidPhilippineMobileSubscriber('9123456789'), true);
  assert.equal(isValidPhilippineMobileSubscriber('8123456789'), false);
  assert.equal(isValidPhilippineMobileSubscriber('912345678'), false);
  assert.equal(toPaymentApiContactNumber('9123456789'), '09123456789');
});

test('merchant association updates and clears with project selection', () => {
  const projects = [
    { project_id: 1, project_name: 'One', merchant_id: 'merchant-one' },
    { project_id: 2, project_name: 'Two', merchant_id: null },
  ];

  assert.equal(getProjectMerchantId('1', projects), 'merchant-one');
  assert.equal(getProjectMerchantId('2', projects), null);
  assert.equal(getProjectMerchantId('', projects), null);
  assert.equal(getProjectMerchantId('999', projects), null);
});

test('project retrieval and submission use the database merchant association', () => {
  const action = fs.readFileSync(path.join(__dirname, '../app/actions/payment.ts'), 'utf8');
  assert.match(action, /select\('id, title, merchant_id'\)/);
  assert.match(action, /select\('id, merchant_id'\)/);
  assert.match(action, /projectData\.merchant_id \?\? null/);
  assert.match(action, /authoritativeMerchantId !== submittedMerchantId/);
});

test('payment project response is server-allowlisted to the three approved fields', async () => {
  const actionSource = fs.readFileSync(path.join(__dirname, '../app/actions/payment.ts'), 'utf8');
  const actionCode = ts.transpileModule(actionSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  class Query {
    select() { return this; }
    eq() { return this; }
    is() { return this; }
    order() { return this; }
    then(resolve) {
      return Promise.resolve({
        data: [
          { id: 1, title: 'City Clou', merchant_id: 'test-merchant', image: 'private-image', email: 'payer@example.invalid', unit_number: '1008' },
          { id: 2, title: 'No Merchant', merchant_id: null, contact_number: '09123456789' },
        ],
        error: null,
      }).then(resolve);
    }
  }

  const actionModule = { exports: {} };
  new Function('require', 'module', 'exports', actionCode)(
    (name) => {
      if (name === '@supabase/supabase-js') {
        return { createClient: () => ({ from: () => new Query() }) };
      }
      if (name === 'zod') return require('zod');
      throw new Error(`Unexpected import: ${name}`);
    },
    actionModule,
    actionModule.exports
  );

  const result = await actionModule.exports.fetchProjectsForPayment();
  assert.deepEqual(result, [
    { project_name: 'City Clou', project_id: 1, merchant_id: 'test-merchant' },
    { project_name: 'No Merchant', project_id: 2, merchant_id: null },
  ]);
  assert.ok(result.every((project) => (
    Object.keys(project).sort().join(',') === 'merchant_id,project_id,project_name'
  )));
});

test('payment submission responses do not echo payer or property data', () => {
  const action = fs.readFileSync(path.join(__dirname, '../app/actions/payment.ts'), 'utf8');
  assert.doesNotMatch(action, /return\s*\{[^}]*paymentData/s);
  assert.doesNotMatch(action, /return\s*\{[^}]*contactNumber/s);
  assert.doesNotMatch(action, /console\.(?:log|warn|error)\([^\n]*paymentData/);
});

test('payment UI no longer requests tower or unit-type records', () => {
  const client = fs.readFileSync(path.join(__dirname, '../app/payment/paymentclient.tsx'), 'utf8');
  assert.doesNotMatch(client, /fetchTowersForProject|fetchUnitTypesForTower/);
  assert.doesNotMatch(client, /towerId|unitTypeId|payment-unit-type|Unit Type/);
  assert.match(client, /register\("tower"\)/);
  assert.match(client, /tower: ''/);
  assert.doesNotMatch(client, /shouldUnregister:\s*true/);
});
