// Offline CSV reconciliation only. Does not connect to Supabase or execute SQL.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function parseCsv(source) {
  const rows = []; let row = [], field = '', quoted = false;
  source = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  if (!header) throw new Error('Empty CSV');
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV row ${index + 2} has unexpected width`);
    return Object.fromEntries(header.map((key, i) => [key, values[i]]));
  });
}

const targeted = new Set(['admin_users', 'groups', 'module_access', 'admin_contact_reads',
  'admin_inquire_reads', 'admin_loan_preapp_reads', 'audit_logs', 'client', 'contact',
  'inquire', 'loan_preapp', 'navbar_projects', 'our story']);

function reconcile(directory) {
  const root = path.resolve(__dirname, '..');
  const files = fs.readdirSync(directory).filter(file => /^0[1-7]_.*\.csv$/.test(file)).sort();
  if (files.length !== 7) throw new Error('Expected exactly seven CSV exports');
  const exports = files.map(file => {
    const bytes = fs.readFileSync(path.join(directory, file));
    return { file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), rows: parseCsv(bytes.toString('utf8')) };
  });
  const policies = exports.find(e => e.file.startsWith('03_')).rows;
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261110010000_harden_cms_browser_grants.sql'), 'utf8');
  const expected = policies.filter(p => targeted.has(p.table_name) && p.policyname !== 'null');
  for (const policy of expected) {
    const table = policy.table_name.includes(' ') ? `"${policy.table_name}"` : policy.table_name;
    const statement = `drop policy if exists "${policy.policyname.replaceAll('"', '""')}" on public.${table};`;
    if (!sql.includes(statement)) throw new Error(`Missing reviewed policy drop: ${policy.table_name}/${policy.policyname}`);
  }
  const drops = [...sql.matchAll(/drop policy if exists "([^"]+)" on public\.(?:"([^"]+)"|([a-z_]+));/g)];
  if (drops.length !== expected.length) throw new Error('Unexpected number of existing-policy drops');
  for (const [, name, quotedTable, table] of drops) {
    if (!expected.some(p => p.table_name === (quotedTable || table) && p.policyname === name)) throw new Error('Drop absent from supplied evidence');
  }
  const followupPath = path.join(root, 'supabase/migrations/20261110030000_harden_remaining_cms_mutations.sql');
  let followupPolicyDropsVerified = 0;
  if (fs.existsSync(followupPath)) {
    const followup = fs.readFileSync(followupPath, 'utf8');
    for (const [, name, quotedTable, table] of followup.matchAll(/drop policy if exists "([^"]+)" on public\.(?:"([^"]+)"|([a-z_]+));/g)) {
      if (!policies.some(p => p.table_name === (quotedTable || table) && p.policyname === name)) throw new Error('Follow-up policy drop absent from CSV evidence');
      followupPolicyDropsVerified++;
    }
    for (const policy of policies.filter(p => !targeted.has(p.table_name) && ['ALL', 'INSERT', 'UPDATE', 'DELETE'].includes(p.cmd))) {
      if (!followup.includes(`drop policy if exists "${policy.policyname}" on public.${policy.table_name};`)) throw new Error('Remaining mutation policy not handled');
    }
  }
  const versions = exports.find(e => e.file.startsWith('07_')).rows.map(r => r.version);
  const local = fs.readdirSync(path.join(root, 'supabase/migrations')).map(file => file.match(/^(\d+)_/)?.[1]).filter(Boolean);
  return {
    exports: exports.map(({ file, sha256, rows }) => ({ file, sha256, rows: rows.length })),
    tables: new Set(exports[0].rows.map(r => r.table_name)).size,
    exactPolicyDropsVerified: expected.length,
    followupPolicyDropsVerified,
    remoteVersions: versions, localVersions: local,
    matchingVersions: versions.filter(v => local.includes(v)),
    remainingAuthenticatedMutationPolicies: policies.filter(p => !targeted.has(p.table_name) && ['ALL', 'INSERT', 'UPDATE', 'DELETE'].includes(p.cmd))
      .map(({ table_name, policyname, cmd, roles }) => ({ table_name, policyname, cmd, roles })),
  };
}

module.exports = { parseCsv, reconcile };
if (require.main === module) {
  if (!process.argv[2]) throw new Error('Pass the directory containing the seven extracted CSVs');
  console.log(JSON.stringify(reconcile(process.argv[2]), null, 2));
}
