// Read configuration identity only. Never print URLs, keys, project refs or env values.
// No network requests or database connections are made.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['.env.local', '.env.development', '.env.production', '.env.staging'];
const targets = new Map();
for (const file of files) {
  const location = path.join(root, file);
  if (!fs.existsSync(location)) continue;
  const source = fs.readFileSync(location, 'utf8');
  const raw = source.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]*)/m)?.[1]?.trim();
  if (raw) targets.set(file, raw.replace(/^['"]|['"]$/g, '').replace(/\/$/, ''));
}
console.log(JSON.stringify({
  networkAccessed: false,
  files: files.map(file => ({ file, exists: fs.existsSync(path.join(root, file)),
    databaseTargetConfigured: targets.has(file),
    matchesProductionTarget: targets.has(file) && targets.has('.env.production')
      ? targets.get(file) === targets.get('.env.production') : null,
  })),
  isolatedStagingVerified: false,
  note: 'Distinct local URLs do not prove an isolated staging project or authorized connection.',
}, null, 2));
