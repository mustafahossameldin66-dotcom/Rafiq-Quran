import fs from 'node:fs';
import { freshPage, finishOnboarding, goto, MEM, tmpFile } from './lib.mjs';
export const name = 'backup: export/import, bad files, quota rollback, preferences survive';
export async function run({ browser, url, check }) {
  const page = await freshPage(browser, url, { acceptDownloads: true });
  await finishOnboarding(page, 1); // choose the 2nd reciter
  const mainState = () => page.evaluate(() => JSON.parse(localStorage.getItem('rafiq-state-v85')));
  const snapshot = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^rafiq-/.test(k) && !/daily|welcome|device-id|reciters|layout|page-map/.test(k)).sort().map(k => [k, localStorage.getItem(k)])));
  const strip = v => { let o; try { o = JSON.parse(v ?? 'null'); } catch { return String(v); } if (o && typeof o === 'object') delete o.__activityVersion; return JSON.stringify(o); }; // __activityVersion is a runtime repaint counter
  const lastToast = () => page.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*=toast]')].map(e => e.textContent.trim()).filter(Boolean).pop() || '');

  // chosen reciter must survive a settings change + reload (regression: hydrateSettings used to drop prefs.reciter)
  await goto(page, 'settings');
  await page.evaluate(() => document.querySelector('.perf-btn[data-performance="lite"]').click()); await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(1500);
  check('chosen reciter survives reload', (await mainState()).prefs?.reciter === 'Minshawy_Murattal_128kbps', String((await mainState()).prefs?.reciter));

  await MEM(page, 'addPrior', 1, 1, 1, 7); await MEM(page, 'setPlanPreset', { amount: 3, unit: 'ayahs', startSurah: 2, startAyah: 1 }); await page.waitForTimeout(500);
  await goto(page, 'settings');
  const before = await snapshot();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.querySelector('#exportData').click())]);
  const file = tmpFile('backup.json'); await dl.saveAs(file);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('export has the expected format', payload.format === 'rafiq-backup' && payload.localStorage && !Array.isArray(payload.localStorage));
  check('export contains main state and memorization data', Object.keys(payload.localStorage).some(k => /^rafiq-state-/.test(k)) && Object.keys(payload.localStorage).some(k => /memorization/.test(k)));

  await MEM(page, 'addPrior', 114, 1, 114, 6); await MEM(page, 'setPlanPreset', { amount: 9, unit: 'juz' });
  await page.evaluate(() => document.querySelector('.perf-btn[data-performance="high"]').click()); await page.waitForTimeout(400);
  check('changes after export are visible before import', JSON.stringify(await snapshot()) !== JSON.stringify(before));
  await page.setInputFiles('#importData', file); await page.waitForLoadState('load'); await page.waitForTimeout(2500);
  const restored = await snapshot();
  check('import restores exactly what was exported (and is not overwritten by stale in-memory state)', Object.keys(before).every(k => strip(restored[k]) === strip(before[k])), Object.keys(before).filter(k => strip(restored[k]) !== strip(before[k])).join());
  check('performance setting restored (lite), not the post-export value (high)', (await mainState()).prefs.performance === 'lite');

  await goto(page, 'settings');
  const mainKey = Object.keys(payload.localStorage).find(k => /^rafiq-state-/.test(k));
  const bad = { 'not JSON': '{ nope', 'wrong format': JSON.stringify({ hello: 1 }), 'array payload': JSON.stringify({ format: 'rafiq-backup', localStorage: [] }), 'no rafiq keys': JSON.stringify({ format: 'rafiq-backup', localStorage: { other: 'x' } }), 'corrupt main state': JSON.stringify({ format: 'rafiq-backup', localStorage: { [mainKey]: '{broken' } }) };
  for (const [label, body] of Object.entries(bad)) {
    const s0 = await snapshot();
    await page.setInputFiles('#importData', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(body) }); await page.waitForTimeout(600);
    check(`bad file "${label}" is rejected, data untouched`, JSON.stringify(s0) === JSON.stringify(await snapshot()), await lastToast());
  }

  await MEM(page, 'addPrior', 112, 1, 112, 4); await page.waitForTimeout(400);
  const pre = await snapshot();
  await page.evaluate(() => { let n = 0; const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function (k, v) { n++; if (n === 2) throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  await page.setInputFiles('#importData', file); await page.waitForTimeout(1200);
  await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
  check('storage full in the middle of an import → previous data fully restored', JSON.stringify(pre) === JSON.stringify(await snapshot()), await lastToast());
  check('no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await page.context().close();
}
