// No browser is available in this environment, so this stubs just enough of the DOM/BOM
// to execute every module's top-level code and surface load-time exceptions.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

const store = new Map();
const noop = () => {};

function makeEl(id = '') {
  const el = {
    id, hidden: false, textContent: '', innerHTML: '', value: '', checked: false, src: '',
    dataset: {},
    style: new Proxy({ setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
                     { get: (t, k) => (k in t ? t[k] : ''), set: () => true }),
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    removeAttribute: noop, appendChild: noop, append: noop, insertAdjacentHTML: noop, remove: noop,
    focus: noop, click: noop, play: () => Promise.resolve(), pause: noop, load: noop,
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, matches: () => false,
    scrollIntoView: noop, getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    paused: true, duration: 0, currentTime: 0, children: [], parentElement: null,
    width: 0, height: 0,
    getContext: () => ({ clearRect: noop, fillRect: noop, beginPath: noop, arc: noop, fill: noop,
      stroke: noop, moveTo: noop, lineTo: noop, closePath: noop, save: noop, restore: noop,
      translate: noop, rotate: noop, scale: noop, drawImage: noop, setTransform: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }), fillText: noop, measureText: () => ({ width: 0 }) }),
  };
  return el;
}
const elFor = id => { if (!store.has(id)) store.set(id, makeEl(id)); return store.get(id); };

const document = {
  readyState: 'complete',
  body: makeEl('body'),
  documentElement: makeEl('html'),
  hidden: false,
  createElement: () => makeEl(),
  createDocumentFragment: () => makeEl(),
  getElementById: id => (ids.has(id) ? elFor(id) : null),
  querySelector: sel => {
    const m = /^#([A-Za-z0-9_-]+)$/.exec(String(sel).trim());
    if (m) return ids.has(m[1]) ? elFor(m[1]) : null;
    return null;
  },
  querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
};

const localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

const errors = [];
const handlers = new Map();
let rafBudget = 40;
const sandbox = {
  console: { log: noop, warn: noop, error: (...a) => errors.push('console.error: ' + a.join(' ')), info: noop },
  document, localStorage, sessionStorage: localStorage,
  navigator: { onLine: false, userAgent: 'node', serviceWorker: { register: () => Promise.resolve() },
               hardwareConcurrency: 4, deviceMemory: 4, clipboard: { writeText: () => Promise.resolve() },
               geolocation: { getCurrentPosition: noop } },
  location: { origin: 'https://example.test', href: 'https://example.test/', protocol: 'https:' },
  fetch: () => Promise.reject(new Error('offline in smoke test')),
  caches: { open: () => Promise.resolve({ match: () => Promise.resolve(null), keys: () => Promise.resolve([]), put: () => Promise.resolve(), add: () => Promise.resolve() }), match: () => Promise.resolve(null), keys: () => Promise.resolve([]) },
  indexedDB: { open: () => ({ result: { objectStoreNames: { contains: () => true }, createObjectStore: noop, transaction: () => ({ objectStore: () => ({ get: () => ({}), put: () => ({}) }) }) } }) },
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  // Runs the callback a bounded number of times: enough to execute one-shot rAF work,
  // without hanging on the app's recursive animation loops.
  requestAnimationFrame: fn => { if (rafBudget-- > 0) { try { fn(0); } catch (e) { throw e; } } return 1; },
  cancelAnimationFrame: noop, requestIdleCallback: () => 1,
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  getComputedStyle: () => new Proxy({}, { get: () => '' }),
  Audio: function () { return makeEl(); },
  Image: function () { return makeEl(); },
  CustomEvent: function (t, o) { return { type: t, detail: o && o.detail }; },
  Notification: { permission: 'default', requestPermission: () => Promise.resolve('default') },
  CSS: { escape: s => String(s) },
  Intl, JSON, Math, Date, Promise, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
  URL, URLSearchParams, TextDecoder, TextEncoder, Blob: function () {}, FormData: function () {},
  performance: { now: () => 0 },
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  __handlers: handlers,
  addEventListener: (type, fn) => { const a = handlers.get(type) || []; a.push(fn); handlers.set(type, a); },
  removeEventListener: noop, dispatchEvent: noop,
  scrollTo: noop, alert: noop, confirm: () => true, prompt: () => null,
  btoa: s => Buffer.from(String(s)).toString('base64'),
  atob: s => Buffer.from(String(s), 'base64').toString('binary'),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

// Same order as index.html.
const order = ['js/tajweed-parser.js','js/content-manager.js','js/app.js','js/memorization-engine.js',
               'js/settings.js','js/quran-index.js','js/mobile-shell.js','js/sw-register.js',
               'js/ambient-effects.js','js/mushaf-premium.js'];

process.on('unhandledRejection', () => {}); // offline fetch rejections are expected here

let failed = 0;
for (const file of order) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  try {
    new vm.Script(code, { filename: file }).runInContext(sandbox);
    console.log(`✓ loaded ${file}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${file} threw at load: ${e.name}: ${e.message}`);
  }
}

// Exercise a few entry points that used to throw.
const probes = [
  ['fetchOnlineHadith reachable', () => typeof sandbox.window.RAFIQ_APP === 'object'],
  ['window.syncRafiqPauseButton defined', () => typeof sandbox.window.syncRafiqPauseButton === 'function'],
  ['window.RAFIQ_QURAN_INDEX.juzBoundsLocal defined', () => typeof sandbox.window.RAFIQ_QURAN_INDEX?.juzBoundsLocal === 'function'],
  ['window.RAFIQ_MEM exposed', () => typeof sandbox.window.RAFIQ_MEM === 'object'],
  ['window.rafiqToast exposed', () => typeof sandbox.window.rafiqToast === 'function'],
];
for (const [label, fn] of probes) {
  let pass = false;
  try { pass = !!fn(); } catch {}
  console.log(`${pass ? '✓' : '✗'} ${label}`);
  if (!pass) failed++;
}

try {
  sandbox.window.RAFIQ_QURAN_INDEX.juzBoundsLocal(1, 1).then(r => {
    console.log('✓ offline juz 1 resolves to', JSON.stringify(r?.start), '->', JSON.stringify(r?.end));
  }).catch(e => console.error('✗ juz resolve threw:', e.message));
} catch (e) { console.error('✗ juz resolve threw:', e.message); failed++; }

setTimeout(() => {
  console.log('');
  console.log(failed ? `${failed} smoke failures.` : 'Smoke test clean: every module loaded without throwing.');
  process.exitCode = failed ? 1 : 0;
}, 50);
