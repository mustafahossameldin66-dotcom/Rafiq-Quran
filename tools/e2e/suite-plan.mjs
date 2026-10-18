import { freshPage, finishOnboarding, goto, installClock, MEM } from './lib.mjs';
export const name = 'plan: units (ayahs/surah/page/juz), labels, daily limit';
export async function run({ browser, url, check }) {
  const page = await freshPage(browser, url);
  await finishOnboarding(page); await goto(page, 'plan');
  const toast = () => page.evaluate(() => (document.querySelector('.toast, #toast')?.textContent || '').trim());
  const rangeOf = () => page.evaluate(async () => { const p = await window.RAFIQ_MEM.plan(); return p.newRange ? [p.newRange.start, p.newRange.end, p.newRange.label] : null; });
  async function setPlan(unit, amount, idx) {
    await page.selectOption('#planUnit', unit); await page.waitForTimeout(150);
    await page.fill('#planAmount', String(amount));
    if (unit !== 'ayahs') await page.fill('#planStartIndex', String(idx));
    const label = await page.evaluate(() => document.querySelector('#planStartUnitLabel')?.childNodes[0]?.textContent);
    await page.evaluate(() => document.querySelector('#coreSavePlan').click()); await page.waitForTimeout(1200);
    return { label, range: await rangeOf(), toast: await toast() };
  }
  let r = await setPlan('surah', 2, 112);
  check('surah ×2 from 112 → 112:1 … 113:5', r.range && r.range[0].s === 112 && r.range[1].s === 113 && r.range[1].a === 5, JSON.stringify(r.range));
  check('field label follows the unit (surah)', r.label.includes('السورة'), r.label);
  check('toast says "سورة" not "آية"', r.toast.includes('2 سورة'), r.toast);
  r = await setPlan('juz', 1, 30);
  check('juz 30 → 78:1 … 114:6 (offline)', r.range && r.range[0].s === 78 && r.range[1].s === 114 && r.range[1].a === 6, JSON.stringify(r.range));
  check('field label follows the unit (juz)', r.label.includes('الجزء'), r.label);
  r = await setPlan('page', 2, 1);
  check('page unit without a cached index warns instead of failing silently', r.range === null && /فهرس الصفحات/.test(r.toast), r.toast);
  r = await setPlan('ayahs', 5);
  check('ayahs ×5 → 1:1 … 1:5', r.range && r.range[0].s === 1 && r.range[1].a === 5, JSON.stringify(r.range));

  // daily limit: after the planned range is recorded, no second "new" range today; tomorrow shows the next one
  const clock = await installClock(page);
  await MEM(page, 'setPlanPreset', { amount: 3, unit: 'ayahs', startSurah: 3, startAyah: 1 });
  const labels = () => page.evaluate(async () => (await window.RAFIQ_MEM.plan()).newRanges.map(r => `${r.start.s}:${r.start.a}-${r.end.a}${r.auto ? ' auto' : ''}${r.origin ? ' recorded' : ''}`));
  await clock.set(0);
  check('day 0 proposes 3:1-3', (await labels()).join() === '3:1-3 auto', (await labels()).join());
  await goto(page, 'plan'); await page.evaluate(() => document.querySelector('#memStartSession').click()); await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('[data-action="record"]').click()); await page.waitForTimeout(500);
  check('after recording, day 0 shows only the recorded item (no second proposal)', (await labels()).join() === '3:1-3 recorded', (await labels()).join());
  await clock.set(1);
  check('day 1 proposes the next range 3:4-6', (await labels()).join() === '3:4-6 auto', (await labels()).join());
  await clock.set(2); await MEM(page, 'markNew', 20, 1, 20, 5);
  check('a manual memorization outside the plan does not cancel the plan', (await labels()).join() === '3:4-6 auto,20:1-5 recorded', (await labels()).join());
  check('no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await page.context().close();
}
