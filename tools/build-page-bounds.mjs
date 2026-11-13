import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const quran = JSON.parse(fs.readFileSync(path.join(root, 'quran-uthmani.json'), 'utf8'));
const cnt = s => quran[s - 1].count;

async function run() {
  console.log('Fetching verified page bounds from quran-qcf4...');
  const res = await fetch('https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/verses.json');
  const raw = await res.json();
  function cmp(a, b) { return a.s !== b.s ? a.s - b.s : a.a - b.a; }
  const pages = Array.from({ length: 604 }, (_, i) => ({ index: i + 1, start: null, end: null }));
  for (const [key, row] of Object.entries(raw)) {
    const m = key.match(/^(\d+):(\d+)$/);
    const pg = Number(row?.page);
    if (!m || !(pg >= 1 && pg <= 604)) continue;
    const pt = { s: Number(m[1]), a: Number(m[2]) };
    const item = pages[pg - 1];
    if (!item.start || cmp(pt, item.start) < 0) item.start = pt;
    if (!item.end || cmp(pt, item.end) > 0) item.end = pt;
  }
  
  // Validate contiguity
  for (let i = 0; i < 604; i++) {
    const p = pages[i];
    if (!p.start || !p.end) throw new Error(`Missing bounds for page ${i + 1}`);
    if (i > 0) {
      const prev = pages[i - 1].end;
      const expectedNext = prev.a < cnt(prev.s) ? { s: prev.s, a: prev.a + 1 } : { s: prev.s + 1, a: 1 };
      if (p.start.s !== expectedNext.s || p.start.a !== expectedNext.a) {
        throw new Error(`Page ${i+1} (${p.start.s}:${p.start.a}) does not follow page ${i} (${prev.s}:${prev.a})`);
      }
    }
  }
  if (pages[0].start.s !== 1 || pages[0].start.a !== 1) throw new Error('Page 1 does not start at 1:1');
  if (pages[603].end.s !== 114 || pages[603].end.a !== cnt(114)) throw new Error('Page 604 does not end at 114:6');
  
  const bounds = pages.map(p => [p.start.s, p.start.a, p.end.s, p.end.a]);
  const boundsJson = JSON.stringify(bounds);
  console.log(`✓ 604 page boundaries verified (${boundsJson.length} bytes). Injecting into js/quran-index.js...`);
  
  // Read js/quran-index.js
  const indexPath = path.join(root, 'js', 'quran-index.js');
  let indexCode = fs.readFileSync(indexPath, 'utf8');
  
  const target = 'const builtinJuz=()=>JUZ_BOUNDS.map(([s,a,es,ea],i)=>({index:i+1,start:{s,a},end:{s:es,a:ea},unit:\'juz\'}));';
  if (!indexCode.includes(target)) throw new Error('target for JUZ_BOUNDS not found in js/quran-index.js');
  
  const injection = `${target}
  // حدود الصفحات الـ 604 (مصحف المدينة النبوية - رواية حفص) مضمّنة محليًا فلا تحتاج إنترنت.
  const PAGE_BOUNDS=${boundsJson};
  const builtinPages=()=>PAGE_BOUNDS.map(([s,a,es,ea],i)=>({index:i+1,start:{s,a},end:{s:es,a:ea},unit:'page'}));`;
  
  indexCode = indexCode.replace(target, injection);
  
  // Update resolvePage to use builtin PAGE_BOUNDS first
  const resolveTarget = 'async function resolvePage(index,amount){';
  const resolveReplace = `async function resolvePage(index,amount){if(Array.isArray(PAGE_BOUNDS)&&PAGE_BOUNDS.length===604){const lastIndex=Math.min(604,index+amount-1),first=PAGE_BOUNDS[index-1],last=PAGE_BOUNDS[lastIndex-1];if(first&&last)return{start:{s:first[0],a:first[1]},end:{s:last[2],a:last[3]},unit:'page',index,amount}}`;
  indexCode = indexCode.replace(resolveTarget, resolveReplace);
  
  // Update ensure to return builtinPages
  const ensureTarget = 'async function ensure(){const r=await ensureRemote();return {...(r||{}),juz:builtinJuz()}}';
  const ensureReplace = 'async function ensure(){const r=await ensureRemote();return {...(r||{}),juz:builtinJuz(),pages:(Array.isArray(r?.pages)&&r.pages.length===604)?r.pages:builtinPages()}}';
  indexCode = indexCode.replace(ensureTarget, ensureReplace);
  
  fs.writeFileSync(indexPath, indexCode, 'utf8');
  console.log('✓ Updated js/quran-index.js successfully.');
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
