const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

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
    console: { log() {}, error() {} },
    alert: value => alerts.push(value),
  };
  const module = { exports: {} };
  new Function('module', ...Object.keys(dependencies), code)(module, ...Object.values(dependencies));
  return { submit: module.exports, requests, notices, errors, resets, tokens, alerts };
}

const payment = { firstName: 'Test', lastName: 'Payer', email: 'test@example.invalid', contactNumber: '09123456789', projectId: '1', towerId: '2', unitTypeId: '3', unitNumber: '101', paymentPurpose: 'Reservation Fee', amount: '1000' };

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

test('accepted payment uses the current verification response and original form values', async () => {
  const ui = submission({ currentToken: 'fresh-response' });
  await ui.submit(payment);
  assert.deepEqual(ui.requests, [[payment, 'fresh-response']]);
  assert.deepEqual(ui.alerts, ['Payment processed successfully!']);
});

test('server rejection retains the existing payment retry behavior', async () => {
  const ui = submission({ result: { error: 'Please verify your payment details.' } });
  await ui.submit(payment);
  assert.equal(ui.requests.length, 1);
  assert.deepEqual(ui.resets, ['payment-widget']);
  assert.deepEqual(ui.tokens, [null]);
  assert.equal(ui.errors.at(-1), 'Please verify your payment details.');
});
