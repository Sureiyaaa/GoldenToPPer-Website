// Read the committed source without checking out or overwriting working files.
// Usage: node scripts/run-security-regression-baseline.cjs [test files...]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.env.GT_SECURITY_BASELINE_READ === '1') {
  const read = fs.readFileSync;
  const cache = new Map();
  fs.readFileSync = function (file, options) {
    if (typeof file === 'string') {
      const relative = path.relative(root, path.resolve(file)).split(path.sep).join('/');
      if (/^(app|lib|utils|tests)\//.test(relative) && /\.(tsx?|cjs)$/.test(relative)) {
        if (!cache.has(relative)) cache.set(relative, execFileSync('git', ['show', `HEAD:${relative}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }));
        const content = cache.get(relative);
        const encoding = typeof options === 'string' ? options : options?.encoding;
        return encoding ? content.toString(encoding) : Buffer.from(content);
      }
    }
    return read.apply(this, arguments);
  };
} else {
  const files = process.argv.slice(2);
  if (!files.length) files.push('tests/project-creation.test.cjs', 'tests/news-cover-visibility.test.cjs');
  console.log('Baseline commit:', execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  const result = spawnSync(process.execPath, ['--require', __filename, '--test', ...files], {
    cwd: root, env: { ...process.env, GT_SECURITY_BASELINE_READ: '1' }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
