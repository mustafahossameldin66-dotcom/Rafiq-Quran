// Stamps content hashes so a changed file can never be served stale from the service worker.
//   node tools/stamp.mjs          -> rewrite ?v=<hash> in index.html and CACHE in sw.js
//   node tools/stamp.mjs --check  -> exit 1 if anything is out of date (used by preflight)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const check = process.argv.includes('--check');
const read = f => fs.readFileSync(path.join(root, f));
const hash = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const problems = [];

// 1) ?v=<hash of file content> on every local css/js reference in index.html
let html = read('index.html').toString('utf8');
html = html.replace(/((?:src|href)=["'])((?:css|js)\/[^"'?]+)\?v=[^"']*(["'])/g, (m, pre, file, post) => {
  if (!fs.existsSync(path.join(root, file))) { problems.push(`missing file referenced in index.html: ${file}`); return m; }
  return `${pre}${file}?v=${hash(read(file))}${post}`;
});
const htmlChanged = html !== read('index.html').toString('utf8');
if (htmlChanged) problems.push('index.html ?v= stamps are out of date');

// 2) service-worker cache name = hash of every precached file (index.html as it will be stamped)
let sw = read('sw.js').toString('utf8');
const coreMatch = sw.match(/const CORE=\[([^\]]*)\]/);
if (!coreMatch) { console.error('✗ could not find CORE list in sw.js'); process.exit(1); }
const core = [...coreMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const h = crypto.createHash('sha1');
for (const u of core) {
  const f = u === './' ? 'index.html' : u.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(root, f))) { problems.push(`sw.js CORE lists a missing file: ${u}`); continue; }
  h.update(f); h.update(f === 'index.html' ? html : read(f));
}
const cacheName = `rafiq-offline-${h.digest('hex').slice(0, 10)}`;
const swNext = sw.replace(/const CACHE='[^']*';/, `const CACHE='${cacheName}';`);
if (swNext !== sw) problems.push('sw.js CACHE name is out of date');

if (check) {
  if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); console.error('  → run: node tools/stamp.mjs'); process.exit(1); }
  console.log('✓ asset version stamps are current'); process.exit(0);
}
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'sw.js'), swNext);
console.log(`stamped: index.html ${htmlChanged ? 'updated' : 'unchanged'}, sw.js CACHE=${cacheName}`);
problems.filter(p => !/out of date/.test(p)).forEach(p => console.error('✗ ' + p));
