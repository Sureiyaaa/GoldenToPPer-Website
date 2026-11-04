const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const defaultEnv = {
  NODE_ENV: 'production', VERCEL: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-server-only-secret',
  TURNSTILE_SECRET_KEY: 'test-non-dummy-secret',
};
let db;

function loadTs(file, imports, env = defaultEnv, fetchImpl) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', 'console', 'fetch', code)(
    name => Object.hasOwn(imports, name) ? imports[name] : require(name),
    module, module.exports, { env }, quiet, fetchImpl,
  );
  return module.exports;
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261104060532_add_admin_login_rate_limits.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261104061451_add_admin_login_failed_attempt_lockout.sql'), 'utf8'));
});
beforeEach(async () => db.exec('reset role; truncate public.admin_login_rate_limits, public.admin_login_account_limits; set role service_role;'));
after(async () => { if (db) await db.close(); });

const bucket = (scope, digit = 'a') => `${scope}:${digit.repeat(64)}`;
async function consume(key) {
  return (await db.query('select * from public.consume_admin_login_rate_limit($1)', [key])).rows[0];
}
async function adminExec(sql) {
  await db.exec(`reset role; ${sql}; set role service_role;`);
}
async function begin(key = bucket('username')) {
  return (await db.query('select * from public.begin_admin_login_attempt($1)', [key])).rows[0];
}
async function complete(key, token, succeeded) {
  return (await db.query('select * from public.complete_admin_login_attempt($1,$2,$3)', [key, token, succeeded])).rows[0];
}
async function fail(key = bucket('username')) {
  const attempt = await begin(key);
  assert.equal(attempt.status, 'allowed');
  return complete(key, attempt.attempt_token, false);
}

function harness(options = {}) {
  const events = [], cookieWrites = [], rpcKeys = [];
  const env = { ...defaultEnv, ...options.env };
  const helper = loadTs('lib/auth/login-rate-limit.ts', {}, env);
  const client = {
    async rpc(name, args) {
      events.push(name === 'consume_admin_login_rate_limit' ? 'limit' : name === 'begin_admin_login_attempt' ? 'begin' : 'complete');
      rpcKeys.push(args.p_bucket_key);
      if (options.rpcResult) return options.rpcResult(args.p_bucket_key, name);
      try {
        const result = name === 'consume_admin_login_rate_limit' ? await consume(args.p_bucket_key)
          : name === 'begin_admin_login_attempt' ? await begin(args.p_bucket_key)
          : await complete(args.p_bucket_key, args.p_attempt_token, args.p_succeeded);
        return { data: [result], error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    from(table) {
      assert.equal(table, 'admin_users');
      events.push('account');
      return {
        select() { return this; },
        eq(column, value) { assert.equal(column, 'username'); events.push(`username:${value}`); return this; },
        async maybeSingle() {
          return { data: options.noUser ? null : {
            id: 'admin-123', password_hash: 'stored-hash', is_active: options.active !== false,
          }, error: options.lookupError ? { message: 'PRIVATE lookup failure' } : null };
        },
      };
    },
  };
  const actions = loadTs('app/actions/auth.ts', {
    '@supabase/supabase-js': { createClient: () => client },
    'next/headers': {
      headers: async () => new Headers(options.headers ?? { 'x-vercel-forwarded-for': options.ip ?? '203.0.113.10' }),
      cookies: async () => ({ set: (...args) => cookieWrites.push(args) }),
    },
    bcryptjs: {
      hashSync: () => 'dummy-hash',
      compare: async (password, hash) => {
        events.push('password');
        return password === 'correct-password' && hash === 'stored-hash';
      },
    },
    '@/lib/auth/login-rate-limit': helper,
  }, env, async () => {
    events.push('captcha');
    return { ok: true, json: async () => ({ success: options.captcha !== false }) };
  });
  return {
    events, cookieWrites, rpcKeys,
    async login(username = 'admin', password = 'wrong-password', captcha = 'fresh-token') {
      const form = new FormData();
      form.set('username', username);
      form.set('password', password);
      form.set('captchaToken', captcha);
      return actions.loginAction(form);
    },
  };
}

test('SQL admits exactly 30 IP requests, including parallel callers', async () => {
  for (const [scope, limit] of [['ip', 30]]) {
    const results = await Promise.all(Array.from({ length: limit + 10 }, () => consume(bucket(scope))));
    assert.equal(results.filter(row => row.allowed).length, limit);
    for (const denied of results.filter(row => !row.allowed)) {
      assert.ok(denied.retry_after_seconds > 0 && denied.retry_after_seconds <= 900);
    }
    const stored = (await db.query('select attempts from public.admin_login_rate_limits where bucket_key=$1', [bucket(scope)])).rows[0];
    assert.equal(stored.attempts, limit + 1);
  }
});

test('denied attempts preserve the original expiry and expiry restores the full budget', async () => {
  const key = bucket('username');
  for (let i = 0; i < 5; i++) assert.equal((await consume(key)).allowed, true);
  const expiry = (await db.query('select expires_at from public.admin_login_rate_limits')).rows[0].expires_at;
  for (let i = 0; i < 3; i++) assert.equal((await consume(key)).allowed, false);
  assert.deepEqual((await db.query('select expires_at from public.admin_login_rate_limits')).rows[0].expires_at, expiry);
  await adminExec("update public.admin_login_rate_limits set expires_at = clock_timestamp() - interval '1 second'");
  for (let i = 0; i < 5; i++) assert.equal((await consume(key)).allowed, true);
  assert.equal((await consume(key)).allowed, false);
});

test('different buckets remain independent and stale cleanup is bounded', async () => {
  for (let i = 0; i < 6; i++) await consume(bucket('username'));
  assert.equal((await consume(bucket('username', 'b'))).allowed, true);
  assert.equal((await consume(bucket('ip'))).allowed, true);
  await adminExec(`insert into public.admin_login_rate_limits
    select 'ip:' || lpad(to_hex(i),64,'0'), 1, clock_timestamp() - interval '2 days'
    from generate_series(1,102) as i`);
  await consume(bucket('ip'));
  assert.equal(Number((await db.query("select count(*) as total from public.admin_login_rate_limits where expires_at < clock_timestamp() - interval '1 day'")).rows[0].total), 2);
});

test('browser roles cannot read, reset or consume counters; RPC is security invoker with RLS', async () => {
  const metadata = (await db.query(`select c.relrowsecurity, p.prosecdef from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.pronamespace=n.oid and p.proname='consume_admin_login_rate_limit'
    where n.nspname='public' and c.relname='admin_login_rate_limits'`)).rows[0];
  assert.equal(metadata.relrowsecurity, true);
  assert.equal(metadata.prosecdef, false);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role};`);
    await assert.rejects(() => consume(bucket('ip')), /permission denied/);
    await assert.rejects(() => db.query('select * from public.admin_login_rate_limits'), /permission denied/);
    await assert.rejects(() => db.query('delete from public.admin_login_rate_limits'), /permission denied/);
  }
  await db.exec('reset role; set role service_role;');
  assert.equal((await consume(bucket('ip'))).allowed, true);
});

test('SQL rejects malformed bucket keys', async () => {
  for (const key of [null, '', 'ip:plain-address', bucket('other')]) {
    await assert.rejects(() => consume(key), /Invalid login rate-limit bucket/);
  }
});

test('fifth failure starts a five-minute lock across app instances and IPs; locked requests never check passwords', async () => {
  for (let i = 0; i < 5; i++) {
    const h = harness({ ip: `203.0.113.${i + 1}` });
    const result = await h.login(i % 2 ? ' ADMIN ' : 'admin');
    if (i < 4) assert.match(result.error, /Check your username/);
    else {
      assert.match(result.error, /Too many failed sign-in attempts/);
      assert.equal(result.retryAfterSeconds, 300);
    }
    assert.deepEqual(h.events, ['limit', 'captcha', 'begin', 'account', 'username:admin', 'password', 'complete']);
  }
  const h = harness({ ip: '203.0.113.99' });
  const result = await h.login('Admin', 'correct-password');
  assert.match(result.error, /Too many failed sign-in attempts/);
  assert.ok(result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 300);
  assert.deepEqual(h.events, ['limit', 'captcha', 'begin']);
  assert.equal(h.cookieWrites.length, 0);
});

test('IP limit counts invalid CAPTCHAs and blocks before CAPTCHA calls or account lookups', async () => {
  const h = harness({ captcha: false });
  for (let i = 0; i < 30; i++) assert.match((await h.login(`user${i}`)).error, /verification/);
  const before = h.events.length;
  assert.match((await h.login('different-user', 'correct-password')).error, /Too many sign-in attempts/);
  assert.deepEqual(h.events.slice(before), ['limit']);
  assert.equal(h.events.filter(event => event === 'password').length, 0);
  const buckets = (await db.query('select bucket_key from public.admin_login_rate_limits')).rows;
  assert.equal(buckets.length, 1);
  assert.ok(buckets[0].bucket_key.startsWith('ip:'));
  const freshIP = harness({ ip: '203.0.113.20' });
  assert.deepEqual(await freshIP.login('admin', 'correct-password'), { success: true });
});

test('successful logins do not count as failures and clear earlier failures', async () => {
  const h = harness();
  for (let i = 0; i < 4; i++) assert.match((await h.login()).error, /Check your username/);
  for (let i = 0; i < 6; i++) assert.deepEqual(await h.login('admin', 'correct-password'), { success: true });
  for (let i = 0; i < 4; i++) assert.match((await h.login()).error, /Check your username/);
  assert.equal((await h.login()).retryAfterSeconds, 300);
  assert.equal(h.cookieWrites.length, 6);
  const [name, token, flags] = h.cookieWrites[0];
  assert.equal(name, 'custom_admin_session');
  assert.match(token, /^v1\.admin-123\.\d+\.[a-f0-9]{64}$/);
  assert.equal(flags.httpOnly, true);
  assert.equal(flags.secure, true);
});

test('nonexistent and inactive usernames get the same errors and limits', async () => {
  for (const options of [{ noUser: true }, { active: false }]) {
    const h = harness(options);
    const username = options.noUser ? 'missing-user' : 'inactive-user';
    for (let i = 0; i < 4; i++) assert.match((await h.login(username, 'correct-password')).error, /Check your username/);
    assert.equal((await h.login(username, 'correct-password')).retryAfterSeconds, 300);
    assert.match((await h.login(username, 'correct-password')).error, /Too many failed sign-in attempts/);
    assert.equal(h.cookieWrites.length, 0);
  }
});

test('missing migration, RPC errors, thrown errors and malformed responses fail closed at every stage', async () => {
  const failures = [
    () => ({ data: null, error: { message: 'PRIVATE database failure' } }),
    () => { throw new Error('PRIVATE network failure'); },
    () => ({ data: [], error: null }),
    () => ({ data: [{ allowed: true, retry_after_seconds: '0' }], error: null }),
    () => ({ data: [{ allowed: false, retry_after_seconds: 0 }], error: null }),
    () => ({ data: [{ allowed: true, retry_after_seconds: 901 }], error: null }),
  ];
  for (const fail of failures) {
    for (const stage of ['consume_admin_login_rate_limit', 'begin_admin_login_attempt', 'complete_admin_login_attempt']) {
      const h = harness({ rpcResult: (_key, name) => name === stage ? fail() : name === 'begin_admin_login_attempt'
        ? { data: [{ status: 'allowed', attempt_token: '12345678-1234-1234-1234-123456789abc', retry_after_seconds: 0 }], error: null }
        : { data: [{ allowed: true, retry_after_seconds: 0 }], error: null } });
      assert.deepEqual(await h.login(), { error: 'Sign-in is temporarily unavailable. Please try again later.', retryAfterSeconds: undefined });
      assert.equal(h.events.includes('account'), stage === 'complete_admin_login_attempt');
      assert.equal(h.cookieWrites.length, 0);
    }
  }
});

test('untrusted, missing or malformed production address headers block before external calls', async () => {
  for (const options of [
    { headers: { 'x-forwarded-for': '203.0.113.2' } },
    { headers: { 'x-vercel-forwarded-for': '203.0.113.2, 203.0.113.3' } },
    { headers: { 'x-vercel-forwarded-for': 'not-an-ip' } },
    { env: { VERCEL: '' } },
  ]) {
    const h = harness(options);
    assert.match((await h.login()).error, /temporarily unavailable/);
    assert.deepEqual(h.events, []);
  }
});

test('address identities resist spoofing, equivalent IPv6 spellings, and IPv6 interface rotation', () => {
  const helper = loadTs('lib/auth/login-rate-limit.ts', {});
  const address = value => helper.getLoginClientAddress(new Headers({
    'x-vercel-forwarded-for': value, 'x-forwarded-for': '198.51.100.2',
  }));
  assert.equal(address('203.0.113.10'), '203.0.113.10');
  assert.equal(address('::ffff:203.0.113.10'), '203.0.113.10');
  assert.equal(address('2001:DB8:0:1::a'), address('2001:db8:0000:0001:ffff:ffff:ffff:ffff'));
  assert.notEqual(address('2001:db8:0:1::1'), address('2001:db8:0:2::1'));
  const dev = loadTs('lib/auth/login-rate-limit.ts', {}, { NODE_ENV: 'development' });
  assert.equal(dev.getLoginClientAddress(new Headers({ 'x-forwarded-for': '1.1.1.1' })), 'local-development');
  const proxy = loadTs('lib/auth/login-rate-limit.ts', {}, { NODE_ENV: 'production', ADMIN_LOGIN_IP_HEADER: 'x-trusted-ip' });
  assert.equal(proxy.getLoginClientAddress(new Headers({ 'x-trusted-ip': '203.0.113.12' })), '203.0.113.12');
});

test('malformed and oversized credentials consume IP budget without CAPTCHA, username lookup or bcrypt', async () => {
  const h = harness();
  for (const [username, password] of [
    [' ', 'password'], ['admin', ''], ['a'.repeat(257), 'password'],
    ['admin', 'a'.repeat(1025)], [new Blob(['admin']), 'password'],
  ]) assert.match((await h.login(username, password)).error, /valid username and password/);
  assert.deepEqual(h.events, Array(5).fill('limit'));
});

test('stored bucket keys never contain raw usernames or client addresses', async () => {
  const h = harness();
  await h.login(' PrivateAdmin ');
  assert.equal(h.rpcKeys.length, 3);
  for (const key of h.rpcKeys) {
    assert.match(key, /^(ip|username):[a-f0-9]{64}$/);
    assert.equal(key.includes('privateadmin'), false);
    assert.equal(key.includes('203.0.113.10'), false);
  }
});

test('account lock starts at the fifth failure, does not slide on retries, and expiry restores login', async () => {
  for (let i = 0; i < 4; i++) assert.deepEqual(await fail(), { allowed: true, retry_after_seconds: 0 });
  assert.deepEqual(await fail(), { allowed: false, retry_after_seconds: 300 });
  const expiry = (await db.query('select locked_until from public.admin_login_account_limits')).rows[0].locked_until;
  await adminExec("update public.admin_login_account_limits set locked_until = clock_timestamp() + interval '120 seconds'");
  const remainingExpiry = (await db.query('select locked_until from public.admin_login_account_limits')).rows[0].locked_until;
  for (let i = 0; i < 3; i++) {
    const result = await begin();
    assert.equal(result.status, 'locked');
    assert.ok(result.retry_after_seconds > 0 && result.retry_after_seconds <= 120);
  }
  assert.deepEqual((await db.query('select locked_until from public.admin_login_account_limits')).rows[0].locked_until, remainingExpiry);
  assert.ok(expiry > remainingExpiry);
  await adminExec("update public.admin_login_account_limits set locked_until = clock_timestamp() - interval '1 second'");
  const attempt = await begin();
  assert.equal(attempt.status, 'allowed');
  assert.deepEqual(await complete(bucket('username'), attempt.attempt_token, true), { allowed: true, retry_after_seconds: 0 });
  assert.equal((await db.query('select failures from public.admin_login_account_limits')).rows[0].failures, 0);
});

test('parallel password attempts serialize per account, expire safely, and cannot replay results', async () => {
  const attempts = await Promise.all(Array.from({ length: 10 }, () => begin()));
  assert.equal(attempts.filter(row => row.status === 'allowed').length, 1);
  assert.equal(attempts.filter(row => row.status === 'busy').length, 9);
  const token = attempts.find(row => row.status === 'allowed').attempt_token;
  assert.equal((await complete(bucket('username'), token, false)).allowed, true);
  await assert.rejects(() => complete(bucket('username'), token, false), /expired or was already completed/);
  const old = await begin();
  await adminExec("update public.admin_login_account_limits set attempt_expires_at = clock_timestamp() - interval '1 second'");
  await assert.rejects(() => complete(bucket('username'), old.attempt_token, true), /expired or was already completed/);
  const fresh = await begin();
  assert.equal(fresh.status, 'allowed');
  assert.notEqual(fresh.attempt_token, old.attempt_token);
  await assert.rejects(() => complete(bucket('username'), old.attempt_token, false), /expired or was already completed/);
  assert.equal((await complete(bucket('username'), fresh.attempt_token, true)).allowed, true);
});

test('old failures expire after 15 minutes and a lock overrides that window until its five minutes end', async () => {
  for (let i = 0; i < 4; i++) await fail();
  await adminExec("update public.admin_login_account_limits set window_expires_at = clock_timestamp() - interval '1 second'");
  assert.equal((await fail()).allowed, true);
  assert.equal((await db.query('select failures from public.admin_login_account_limits')).rows[0].failures, 1);
  for (let i = 0; i < 4; i++) await fail();
  await adminExec("update public.admin_login_account_limits set window_expires_at = clock_timestamp() - interval '1 second'");
  assert.equal((await begin()).status, 'locked');
});

test('account state and both RPCs are inaccessible to browser roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role};`);
    await assert.rejects(() => begin(), /permission denied/);
    await assert.rejects(() => complete(bucket('username'), '12345678-1234-1234-1234-123456789abc', false), /permission denied/);
    await assert.rejects(() => db.query('select * from public.admin_login_account_limits'), /permission denied/);
    await assert.rejects(() => db.query('delete from public.admin_login_account_limits'), /permission denied/);
  }
  await db.exec('reset role; set role service_role;');
});

test('database lookup failures are not counted as failed credentials', async () => {
  const h = harness({ lookupError: true });
  assert.match((await h.login()).error, /temporarily unavailable/);
  assert.equal(h.events.includes('password'), false);
  assert.equal(h.cookieWrites.length, 0);
  assert.equal((await db.query('select failures from public.admin_login_account_limits')).rows[0].failures, 0);
});
