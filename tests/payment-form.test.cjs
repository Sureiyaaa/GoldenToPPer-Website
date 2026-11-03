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
new Function('require', 'module', 'exports', code)(
  (name) => {
    if (name === 'libphonenumber-js') return require('libphonenumber-js');
    throw new Error(`Unexpected import: ${name}`);
  },
  helperModule,
  helperModule.exports
);

const {
  DEFAULT_PHONE_COUNTRY,
  getProjectMerchantId,
  getPhoneValidationError,
  getPhoneLengthHint,
  getPhoneLengthInfo,
  normalizePhoneInput,
  normalizeServerContactNumber,
  searchPhoneCountries,
  toE164PhoneNumber,
  wouldExceedPhoneDigitLimit,
} = helperModule.exports;

test('Philippines is the default phone country', () => {
  assert.equal(DEFAULT_PHONE_COUNTRY, 'PH');
});

test('country search matches names, first letters, ISO codes, and dialing prefixes', () => {
  assert.equal(searchPhoneCountries('Japan')[0].iso, 'JP');
  assert.ok(searchPhoneCountries('JP').some((country) => country.iso === 'JP'));
  assert.ok(searchPhoneCountries('+81').some((country) => country.iso === 'JP'));
  const countriesStartingWithU = searchPhoneCountries('U').map((country) => country.name);
  assert.ok(countriesStartingWithU.includes('United States'));
  assert.ok(countriesStartingWithU.includes('United Kingdom'));
  assert.ok(countriesStartingWithU.includes('United Arab Emirates'));
});

test('country selector exposes required keyboard controls', () => {
  const client = fs.readFileSync(path.join(__dirname, '../app/payment/paymentclient.tsx'), 'utf8');
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
    assert.match(client, new RegExp(`event\\.key === '${key}'`));
  }
});

test('international pastes update the country and remove duplicated dialing prefixes', () => {
  assert.deepEqual(normalizePhoneInput('+81 90-1234-5678', 'PH'), {
    country: 'JP',
    input: '9012345678',
  });
  const philippines = normalizePhoneInput('+63 917 123 4567', 'PH');
  assert.equal(philippines.country, 'PH');
  assert.equal(toE164PhoneNumber(philippines.input, philippines.country), '+639171234567');
  const duplicatedPrefix = normalizePhoneInput('+63 63 917 123 4567', 'PH');
  assert.equal(toE164PhoneNumber(duplicatedPrefix.input, duplicatedPrefix.country), '+639171234567');
});

test('country metadata supplies Philippine, US, and UK national digit limits', () => {
  assert.deepEqual(getPhoneLengthInfo('PH').supportedLengths, [10]);
  assert.deepEqual(getPhoneLengthInfo('US').supportedLengths, [10]);
  assert.deepEqual(getPhoneLengthInfo('GB').supportedLengths, [7, 9, 10]);
  assert.equal(getPhoneLengthHint('', 'PH'), '0 / 10 digits');
  assert.match(getPhoneLengthHint('', 'GB'), /^0 digits · supported/);
});

test('digit limiting blocks additions but permits deletion and selection replacement', () => {
  assert.equal(wouldExceedPhoneDigitLimit('917 123 4567', '', '8', 'PH'), true);
  assert.equal(wouldExceedPhoneDigitLimit('917 123 4567', '7', '8', 'PH'), false);
  assert.equal(wouldExceedPhoneDigitLimit('917 123 4567', '7', '', 'PH'), false);
  assert.equal(wouldExceedPhoneDigitLimit('(415) 555-2671', '', '8', 'US'), true);
  assert.equal(wouldExceedPhoneDigitLimit('07911 123456', '', '7', 'GB'), true);
});

test('overlong pastes retain their digits so the UI can report the country limit', () => {
  const pasted = normalizePhoneInput('917123456789', 'PH');
  assert.equal(pasted.input.replace(/\D/g, ''), '917123456789');
  assert.equal(pasted.input.replace(/\D/g, '').length > getPhoneLengthInfo('PH').max, true);
});

test('validates and normalizes Philippine, US, and UK numbers to E.164', () => {
  for (const [input, country, expected] of [
    ['0917 123 4567', 'PH', '+639171234567'],
    ['(415) 555-2671', 'US', '+14155552671'],
    ['07911 123456', 'GB', '+447911123456'],
  ]) {
    assert.equal(getPhoneValidationError(input, country), null);
    assert.equal(toE164PhoneNumber(input, country), expected);
  }
  assert.match(getPhoneValidationError('123', 'US'), /valid US phone number/);
  assert.equal(toE164PhoneNumber('123', 'US'), null);
});

test('server accepts E.164 and legacy Philippine values while rejecting invalid numbers', () => {
  assert.equal(normalizeServerContactNumber('+639171234567'), '+639171234567');
  assert.equal(normalizeServerContactNumber('+14155552671'), '+14155552671');
  assert.equal(normalizeServerContactNumber('+447911123456'), '+447911123456');
  assert.equal(normalizeServerContactNumber('09171234567'), '+639171234567');
  assert.equal(normalizeServerContactNumber('+123'), null);
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
      if (name === '@/lib/payment-form') return helperModule.exports;
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
