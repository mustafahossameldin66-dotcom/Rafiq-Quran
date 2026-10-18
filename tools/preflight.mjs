import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const fail = [];
const ok = (label, detail='') => console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
const bad = (label, detail='') => { console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); fail.push(label); };

const htmlPath = path.join(root,'index.html');
const html = fs.readFileSync(htmlPath,'utf8');
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const dupIds = [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
dupIds.length ? bad('duplicate ids',dupIds.join(', ')) : ok('unique HTML ids',String(ids.length));
const body = html.split(/<\/head>/i)[1] || '';
(body.match(/<style\b/gi)||[]).length ? bad('style tags outside head',String((body.match(/<style\b/gi)||[]).length)) : ok('no style tags outside head');
const localRefs = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>/^(?:\.?\/)?(?:assets|css|js|quran-uthmani|manifest|sw\.js)/.test(x));
const missing = [];
for (const ref of localRefs){const file=ref.split('?')[0];if(!fs.existsSync(path.join(root,file)))missing.push(ref)}
missing.length ? bad('missing local refs',missing.join(', ')) : ok('local references resolve',String(localRefs.length));

for (const dir of ['js']) {
  for (const file of fs.readdirSync(path.join(root,dir)).filter(x=>x.endsWith('.js'))) {
    try { execFileSync('node',['--check',path.join(root,dir,file)],{stdio:'ignore'}); ok(`syntax ${dir}/${file}`); }
    catch { bad(`syntax ${dir}/${file}`); }
  }
}

for (const file of fs.readdirSync(path.join(root,'css')).filter(x=>x.endsWith('.css'))) {
  const text=fs.readFileSync(path.join(root,'css',file),'utf8');
  let depth=0, quote=null, esc=false, start=0; const blocks=[];
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===quote)quote=null;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch==='{'){if(depth===0)start=text.lastIndexOf('\n',i)+1;depth++}
    else if(ch==='}'){depth--;if(depth<0){bad(`CSS brace balance ${file}`);break}if(depth===0)blocks.push(text.slice(start,i+1).trim())}
  }
  if(depth!==0)bad(`CSS brace balance ${file}`); else ok(`CSS brace balance ${file}`);
  const counts=new Map(); for(const b of blocks)counts.set(b,(counts.get(b)||0)+1);
  const exact=[...counts.values()].filter(v=>v>1).reduce((n,v)=>n+v-1,0);
  // Warning only: exact copies are only safe to delete when nothing between them re-targets the same
  // properties, which must be verified per rule (see css/ audit notes) - so don't fail the build on them.
  exact ? console.warn(`⚠ exact duplicate CSS blocks ${file} — ${exact} (review before removing)`) : ok(`no exact duplicate CSS blocks ${file}`,String(blocks.length));
}

for (const file of ['content-manifest.json','manifest.webmanifest']) {
  try { JSON.parse(fs.readFileSync(path.join(root,file),'utf8')); ok(`valid JSON ${file}`); }
  catch { bad(`invalid JSON ${file}`); }
}

// Built-in juz table (js/quran-index.js) must be 30 contiguous ranges that match the bundled Quran text.
try {
  const quran = JSON.parse(fs.readFileSync(path.join(root,'quran-uthmani.json'),'utf8'));
  const src = fs.readFileSync(path.join(root,'js','quran-index.js'),'utf8');
  const J = JSON.parse(src.match(/const JUZ_BOUNDS=(\[\[.*?\]\]);/s)[1]);
  const cnt = s => quran[s-1].count, errs = [];
  if (J.length !== 30) errs.push(`expected 30 juz, found ${J.length}`);
  J.forEach(([s,a,es,ea],i) => {
    if (!(a>=1&&a<=cnt(s)) || !(ea>=1&&ea<=cnt(es))) errs.push(`juz ${i+1}: ayah out of range`);
    if (i<J.length-1) { const nx = ea<cnt(es)?[es,ea+1]:[es+1,1]; if (nx[0]!==J[i+1][0]||nx[1]!==J[i+1][1]) errs.push(`juz ${i+1}→${i+2} not contiguous`); }
  });
  if (J[0][0]!==1||J[0][1]!==1||J[29][2]!==114||J[29][3]!==cnt(114)) errs.push('juz table must span 1:1 → 114:end');
  errs.length ? bad('built-in juz table',errs.join('; ')) : ok('built-in juz table','30 contiguous ranges');
} catch (e) { bad('built-in juz table',String(e.message||e)); }

try { execFileSync('node',[path.join(root,'tools','stamp.mjs'),'--check'],{stdio:'inherit',cwd:root}); }
catch { bad('asset version stamps out of date','run: node tools/stamp.mjs'); }

if(fail.length){process.exitCode=1;console.error(`\n${fail.length} checks failed.`)}else{console.log('\nAll preflight checks passed.')}
