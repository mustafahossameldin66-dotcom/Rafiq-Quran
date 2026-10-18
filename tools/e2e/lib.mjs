// Shared helpers for the end-to-end suites. No dependencies except Playwright (see README.md).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean);
  for (const c of candidates) {
    try {
      if (c.startsWith('/')) return createRequire(import.meta.url)(c);
      return await import(c);
    } catch { /* try next */ }
  }
  throw new Error('Playwright not found. Run `npm i -D playwright` in this folder or set PLAYWRIGHT_PATH=/path/to/node_modules/playwright');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
export function startServer(root = ROOT) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/index.html`, close: () => new Promise(r => server.close(r)) })));
}

export async function launch() {
  const { chromium } = await loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
}

/** Fresh isolated browser context + page. Non-local requests are blocked so tests are deterministic and offline. */
export async function freshPage(browser, url, { width = 400, height = 900, acceptDownloads = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'ar', acceptDownloads });
  const page = await ctx.newPage();
  page.jsErrors = [];
  page.on('pageerror', e => page.jsErrors.push(e.message));
  page.on('dialog', d => d.accept());
  const origin = new URL(url).origin;
  await page.route('**/*', r => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return page;
}

/** Click through the 3-step first-run onboarding. `reciterIndex` picks the reciter on step 1. */
export async function finishOnboarding(page, reciterIndex = null) {
  if (reciterIndex !== null) await page.evaluate(i => document.querySelectorAll('input[name="onboardingReciter"]')[i]?.click(), reciterIndex);
  for (let i = 0; i < 3; i++) { await page.click('#onboardingNext', { force: true }).catch(() => {}); await page.waitForTimeout(220); }
  await page.waitForTimeout(800);
}
export const goto = async (page, view) => { await page.evaluate(v => document.querySelector(`#bottomNav [data-view="${v}"], [data-view="${v}"]`)?.click(), view); await page.waitForTimeout(600); };

/** Simulated calendar for the memorization engine: day(n) = 2026-03-01 + n days. */
export async function installClock(page) {
  await page.evaluate(() => {
    const base = new Date(2026, 2, 1); window.__day = 0;
    window.__key = n => { const d = new Date(base); d.setDate(d.getDate() + n); return `rafiq-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    window.RAFIQ_GET_RITUAL_KEY = () => window.__key(window.__day);
  });
  return { set: n => page.evaluate(n => { window.__day = n; }, n), key: n => page.evaluate(n => window.__key(n), n) };
}

export const MEM = (page, fn, ...args) => page.evaluate(([f, a]) => { const r = window.RAFIQ_MEM[f](...a); return r && r.then ? r.then(x => x) : r; }, [fn, args]);
export const memData = page => page.evaluate(() => window.RAFIQ_MEM.getData());
export const tmpFile = name => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rafiq-e2e-')), name);
export { pathToFileURL };
