const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

function submission({ accepted = true, initialToken = 'verified-token', currentToken = 'verified-token', result = { success: true } } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../app/payment/paymentclient.tsx'), 'utf8');
  const ast = ts.createSourceFile('paymentclient.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'onSubmit') initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(initializer, 'Payment submission handler must exist');
  const code = ts.transpileModule('module.exports = ' + initializer, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const requests = [], notices = [], errors = [], resets = [], tokens = [], alerts = [];
  const dependencies = {
    captchaToken: initialToken,
    requestFormConsent: async notice => { notices.push(notice); return accepted; },
    turnstileWidgetIdRef: { current: 'payment-widget' },
    window: { turnstile: { getResponse: id => { assert.equal(id, 'payment-widget'); return currentToken; }, reset: id => resets.push(id) } },
    setCaptchaError: value => errors.push(value),
    setCaptchaToken: value => tokens.push(value),
    setServerError: value => errors.push(value),
    submitPaymentAction: async (...args) => { requests.push(args); return result; },
    toE164PhoneNumber: (value, country) => parsePhoneNumberFromString(value, country)?.number || null,
    console: { log() {}, error() {} },
    alert: value => alerts.push(value),
  };
  const module = { exports: {} };
  new Function('module', ...Object.keys(dependencies), code)(module, ...Object.values(dependencies));
  return { submit: module.exports, requests, notices, errors, resets, tokens, alerts };
}

const payment = { firstName: 'Test', lastName: 'Payer', email: 'test@example.invalid', phoneCountry: 'PH', contactNumber: '0917 123 4567', projectId: '1', merchantId: null, tower: 'Tower A', unitNumber: '101', paymentPurpose: 'Reservation Fee', amount: '1000' };
const { phoneCountry: _phoneCountry, ...submittedFields } = payment;
const submittedPayment = { ...submittedFields, contactNumber: '+639171234567' };

test('payment requires verification before requesting cookie/privacy choices', async () => {
  const ui = submission({ initialToken: null });
  await ui.submit(payment);
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.notices.length, 0);
  assert.deepEqual(ui.errors, ['Please complete the verification.']);
});

test('cancelling the payment privacy notice preserves verification and sends nothing', async () => {
  const ui = submission({ accepted: false });
  await ui.submit(payment);
  assert.equal(ui.notices[0].purpose, 'Payment information');
  assert.equal(ui.requests.length, 0);
  assert.deepEqual(ui.tokens, []);
  assert.deepEqual(ui.resets, []);
});

test('verification expiring during privacy review blocks submission and asks for verification again', async () => {
  const ui = submission({ currentToken: '' });
  await ui.submit(payment);
  assert.equal(ui.requests.length, 0);
  assert.deepEqual(ui.tokens, [null]);
  assert.deepEqual(ui.errors, ['Verification expired. Please complete the verification again.']);
});

test('accepted payment uses the current verification response and API-compatible contact number', async () => {
  const ui = submission({ currentToken: 'fresh-response' });
  await ui.submit(payment);
  assert.deepEqual(ui.requests, [[submittedPayment, 'fresh-response']]);
  assert.deepEqual(ui.alerts, ['Payment processed successfully!']);
});

test('international payment numbers submit as E.164', async () => {
  const ui = submission({ currentToken: 'fresh-response' });
  const internationalPayment = { ...payment, phoneCountry: 'US', contactNumber: '(415) 555-2671' };
  await ui.submit(internationalPayment);
  assert.equal(ui.requests[0][0].contactNumber, '+14155552671');
  assert.equal(Object.hasOwn(ui.requests[0][0], 'phoneCountry'), false);
});

test('server rejection retains the existing payment retry behavior', async () => {
  const ui = submission({ result: { error: 'Please verify your payment details.' } });
  await ui.submit(payment);
  assert.equal(ui.requests.length, 1);
  assert.deepEqual(ui.resets, ['payment-widget']);
  assert.deepEqual(ui.tokens, [null]);
  assert.equal(ui.errors.at(-1), 'Please verify your payment details.');
});
