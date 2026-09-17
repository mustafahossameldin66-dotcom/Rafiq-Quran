import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const fail = [];
const warn = [];
const ok   = (label, detail='') => console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
const bad  = (label, detail='') => { console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); fail.push(label); };
const note = (label, detail='') => { console.log(`! ${label}${detail ? ` — ${detail}` : ''}`); warn.push(label); };

const htmlPath = path.join(root,'index.html');
const html = fs.readFileSync(htmlPath,'utf8');
const jsDir = path.join(root,'js');
const jsFiles = fs.readdirSync(jsDir).filter(x=>x.endsWith('.js'));
const readJs = f => fs.readFileSync(path.join(jsDir,f),'utf8');

/* ---------------------------------------------------------------- structure */

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const dupIds = [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
dupIds.length ? bad('duplicate ids',dupIds.join(', ')) : ok('unique HTML ids',String(ids.length));

const body = html.split(/<\/head>/i)[1] || '';
(body.match(/<style\b/gi)||[]).length ? bad('style tags outside head') : ok('no style tags outside head');

const localRefs = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>/^(?:\.?\/)?(?:assets|css|js|quran-uthmani|manifest|sw\.js)/.test(x));
const missing = localRefs.filter(ref=>!fs.existsSync(path.join(root,ref.split('?')[0])));
missing.length ? bad('missing local refs',missing.join(', ')) : ok('local references resolve',String(localRefs.length));

// Markup that sits after the first <script> tag does not exist yet when that script runs.
// This is what made renderMethod() silently no-op on boot.
const firstScript = html.search(/<script\b/i);
const afterScripts = firstScript === -1 ? '' : html.slice(firstScript);
const lateTags = [...afterScripts.matchAll(/<(div|section|main|article|aside|header|footer|nav|dialog)\b[^>]*\bid=["']([^"']+)["']/gi)].map(m=>m[2]);
lateTags.length
  ? bad('markup declared after <script> tags', lateTags.join(', '))
  : ok('all markup precedes the scripts');

/* ------------------------------------------------------------------ syntax */

for (const file of jsFiles) {
  try { execFileSync('node',['--check',path.join(jsDir,file)],{stdio:'ignore'}); ok(`syntax js/${file}`); }
  catch { bad(`syntax js/${file}`); }
}

/* ------------------------------------------ code escaping its module wrapper */

// A trailing `})();` followed by more statements means that code runs in global scope and
// cannot see anything declared inside the IIFE. `node --check` is perfectly happy with it.
for (const file of jsFiles) {
  const text = readJs(file);
  const close = text.lastIndexOf('\n})();');
  if (close === -1) continue;
  const trailing = text.slice(close + 6).split('\n').filter(l=>l.trim() && !l.trim().startsWith('//'));
  trailing.length
    ? bad(`code after the IIFE in js/${file}`, trailing[0].slice(0,70))
    : ok(`no code escapes the IIFE in js/${file}`);
}

/* ---------------------------------------------- duplicate top-level functions */

for (const file of jsFiles) {
  const names = [...readJs(file).matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  const dups = [...new Set(names.filter((n,i)=>names.indexOf(n)!==i))];
  dups.length ? bad(`duplicate function declarations in js/${file}`, dups.join(', ')) : ok(`no duplicate functions in js/${file}`);
}

/* --------------------------------------------------- selector cross-reference */

const htmlIds = new Set(ids);
const jsCreatedIds = new Set();
for (const file of jsFiles) {
  const text = readJs(file);
  for (const m of text.matchAll(/id=\\?["'`]([A-Za-z0-9_-]+)\\?["'`]/g)) jsCreatedIds.add(m[1]);
  for (const m of text.matchAll(/\.id\s*=\s*["'`]([A-Za-z0-9_-]+)["'`]/g)) jsCreatedIds.add(m[1]);
}
const dangling = [];
for (const file of jsFiles) {
  const text = readJs(file);
  const used = new Set();
  for (const m of text.matchAll(/getElementById\(\s*["'`]([A-Za-z0-9_-]+)["'`]\s*\)/g)) used.add(m[1]);
  // The closing paren matters: it keeps string-concatenation selectors such as $('#view-'+view) out.
  for (const m of text.matchAll(/(?:querySelector|querySelectorAll|\$\$?)\(\s*["'`]#([A-Za-z0-9_-]+)["'`]\s*\)/g)) used.add(m[1]);
  for (const id of used) if (!htmlIds.has(id) && !jsCreatedIds.has(id)) dangling.push(`js/${file} -> #${id}`);
}
dangling.length
  ? bad('selectors that match no element anywhere', dangling.join(', '))
  : ok('every #id selector resolves to real markup');

/* ------------------------------------------------ placeholders and whitespace */

const PLACEHOLDER = /YOUR_[A-Z_]+_HERE|CHANGE_?ME|REPLACE_?ME|TODO:|FIXME|XXX_/;
const placeholders = [];
for (const file of [...jsFiles.map(f=>`js/${f}`),'sw.js','index.html']) {
  const p = path.join(root,file);
  if (!fs.existsSync(p)) continue;
  fs.readFileSync(p,'utf8').split('\n').forEach((line,i)=>{ if (PLACEHOLDER.test(line)) placeholders.push(`${file}:${i+1}`); });
}
placeholders.length ? bad('placeholder text left in source', placeholders.join(', ')) : ok('no placeholder text in source');

const nbsp = [];
for (const file of [...jsFiles.map(f=>`js/${f}`),'sw.js']) {
  const text = fs.readFileSync(path.join(root,file),'utf8');
  const count = (text.match(/^[\u00a0 \t]*\u00a0/gm)||[]).length;
  if (count) nbsp.push(`${file} (${count})`);
}
nbsp.length ? bad('non-breaking space used as indentation', nbsp.join(', ')) : ok('no invisible whitespace in code indentation');

/* --------------------------------------------------- undefined globals (opt.) */

let acorn = null;
try { acorn = await import('acorn'); } catch {}
if (!acorn) {
  note('undefined-identifier scan skipped','run `npm i -D acorn` to enable it');
} else {
  const KNOWN = new Set(('window document console localStorage sessionStorage navigator location history screen '+
  'setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback '+
  'queueMicrotask structuredClone fetch Request Response Headers URL URLSearchParams Blob File FileReader FormData '+
  'AbortController Promise Array Object String Number Boolean Math JSON Date RegExp Error TypeError RangeError Map Set '+
  'WeakMap WeakSet Symbol Proxy Reflect BigInt Intl Function parseInt parseFloat isNaN isFinite encodeURIComponent '+
  'decodeURIComponent encodeURI decodeURI btoa atob alert confirm prompt indexedDB IDBKeyRange caches crypto performance '+
  'Audio Image AudioContext webkitAudioContext CustomEvent Event IntersectionObserver MutationObserver ResizeObserver '+
  'DecompressionStream CompressionStream TextDecoder TextEncoder Node Element HTMLElement DocumentFragment Notification '+
  'matchMedia getComputedStyle self clients skipWaiting registration globalThis undefined NaN Infinity CSS '+
  'Uint8Array ArrayBuffer addEventListener removeEventListener dispatchEvent innerWidth innerHeight devicePixelRatio '+
  'scrollTo scrollBy getSelection open close print speechSynthesis SpeechSynthesisUtterance').split(/\s+/));

  const names = n => { const out=[]; (function walk(x){ if(!x) return;
    if(x.type==='Identifier') out.push(x.name);
    else if(x.type==='ObjectPattern') x.properties.forEach(p=>walk(p.type==='RestElement'?p.argument:p.value));
    else if(x.type==='ArrayPattern') x.elements.forEach(walk);
    else if(x.type==='AssignmentPattern') walk(x.left);
    else if(x.type==='RestElement') walk(x.argument); })(n); return out; };

  const problems = [];
  for (const file of jsFiles) {
    const ast = acorn.parse(readJs(file), { ecmaVersion:'latest', sourceType:'script', locations:true });
    const declared = new Set();
    (function collect(n){ if(!n||typeof n.type!=='string') return;
      if(n.type==='FunctionDeclaration'&&n.id) declared.add(n.id.name);
      if(n.type==='FunctionExpression'&&n.id) declared.add(n.id.name);
      if(n.type==='ClassDeclaration'&&n.id) declared.add(n.id.name);
      if(n.type==='VariableDeclaration') n.declarations.forEach(d=>names(d.id).forEach(x=>declared.add(x)));
      if(n.type==='FunctionExpression'||n.type==='ArrowFunctionExpression'||n.type==='FunctionDeclaration')
        n.params.forEach(p=>names(p).forEach(x=>declared.add(x)));
      if(n.type==='CatchClause'&&n.param) names(n.param).forEach(x=>declared.add(x));
      for(const k of Object.keys(n)){ if(k==='loc') continue; const v=n[k];
        if(Array.isArray(v)) v.forEach(c=>c&&typeof c.type==='string'&&collect(c));
        else if(v&&typeof v.type==='string') collect(v); } })(ast);

    (function check(n,parent){ if(!n||typeof n.type!=='string') return;
      if(n.type==='Identifier'){
        const isProp = parent && ((parent.type==='MemberExpression'&&parent.property===n&&!parent.computed)
                      || (parent.type==='Property'&&parent.key===n&&!parent.computed)
                      || parent.type==='MethodDefinition');
        if(!isProp && !declared.has(n.name) && !KNOWN.has(n.name) && n.name!=='arguments')
          problems.push(`js/${file}:${n.loc.start.line} ${n.name}`);
        return; }
      for(const k of Object.keys(n)){ if(k==='loc') continue; const v=n[k];
        if(Array.isArray(v)) v.forEach(c=>c&&typeof c.type==='string'&&check(c,n));
        else if(v&&typeof v.type==='string') check(v,n); } })(ast,null);
  }
  const unique = [...new Set(problems)];
  unique.length
    ? bad('identifiers that are never declared', unique.slice(0,12).join(', ') + (unique.length>12?` (+${unique.length-12} more)`:''))
    : ok('every identifier resolves to a declaration');
}

/* --------------------------------------------------------------------- CSS */

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
  exact ? bad(`exact duplicate CSS blocks ${file}`,String(exact)) : ok(`no exact duplicate CSS blocks ${file}`,String(blocks.length));
}

/* -------------------------------------------------------------------- JSON */

for (const file of ['content-manifest.json','manifest.webmanifest','daily-content.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root,file),'utf8')); ok(`valid JSON ${file}`); }
  catch { bad(`invalid JSON ${file}`); }
}

/* ------------------------------------------------------ service worker sanity */

const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const core = [...(sw.match(/'\.\/[^']+'/g)||[])].map(x=>x.slice(3,-1)).filter(x=>x && !x.endsWith('/'));
const swMissing = core.filter(f=>!fs.existsSync(path.join(root,f)));
swMissing.length ? bad('service worker precaches missing files', swMissing.join(', ')) : ok('service worker precache list resolves', String(core.length));

/* ------------------------------------------------------------------- result */

console.log('');
if (warn.length) console.log(`${warn.length} check(s) skipped.`);
if (fail.length) { process.exitCode = 1; console.error(`${fail.length} checks failed.`); }
else console.log('All preflight checks passed.');
