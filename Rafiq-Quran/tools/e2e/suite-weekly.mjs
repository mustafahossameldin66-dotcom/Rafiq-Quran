import { freshPage, finishOnboarding, installClock, MEM, memData } from './lib.mjs';
export const name = 'weekly review: "pages" distribution (with and without page data)';

// All ayahs of a task list (the tests only use ranges inside surah 2).
const expand = tasks => tasks.flatMap(t => {
  if (t.start.s !== 2 || t.end.s !== 2) return [NaN];
  return Array.from({ length: t.end.a - t.start.a + 1 }, (_, i) => t.start.a + i);
});
const weekOf = plan => Object.keys(plan.weeklyAssignments || {}).sort().map(k => plan.weeklyAssignments[k]);
const coversExactlyOnce = (tasks, from, to) => {
  const all = expand(tasks).sort((a, b) => a - b);
  return all.length === to - from + 1 && all.every((v, i) => v === from + i);
};

export async function run({ browser, url, check }) {
  // ---------------------------------------------------------------- 1) no page data (offline)
  {
    const page = await freshPage(browser, url); await finishOnboarding(page);
    await installClock(page);
    await page.evaluate(() => { window.RAFIQ_QURAN_INDEX.resolve = () => null; });
    await MEM(page, 'setReviewMode', 'weekly');
    await page.evaluate(() => window.RAFIQ_MEM.addPrior(2, 1, 2, 50));
    await MEM(page, 'setWeeklyReviewConfig', { enabled: true, distribution: 'pages' });
    const plan = await MEM(page, 'plan');
    const days = weekOf(plan), all = days.flat();

    check('no page data: the week still has 7 days of review (no empty/"- - -" days)', days.length === 7 && days.every(d => d.length > 0), `days=${days.length} sizes=${days.map(d => d.length)}`);
    check('no page data: today shows a real range, not nothing', plan.reviews.length > 0 && !!plan.reviews[0].start && !!plan.reviews[0].end);
    check('no page data: falls back to ayah distribution and says so', all.length > 0 && all.every(t => t.distribution === 'ayahs'), [...new Set(all.map(t => t.distribution))].join(','));
    check('no page data: the 7 days cover 2:1–2:50 exactly once (no gap, no overlap)', coversExactlyOnce(all, 1, 50));
    check('no page data: days are balanced (no day above ceil(50/7)=8 ayahs)', days.length === 7 && days.every(d => expand(d).length <= 8), days.map(d => expand(d).length).join(','));
    check('no page data: the user\'s chosen "pages" setting is not overwritten', (await memData(page)).plan.weeklyReview.distribution === 'pages');
    check('no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors[0]);
    await page.context().close();
  }

  // ---------------------------------------------------------------- 2) page data available
  {
    const page = await freshPage(browser, url); await finishOnboarding(page);
    await installClock(page);
    // 14 synthetic "pages" over 2:1–2:50 (page starts: 1,4,8,12,16,20,24,28,32,36,40,44,47,49)
    const starts = [1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 47, 49];
    await page.evaluate(starts => {
      const pages = starts.map((a, i) => ({ index: i + 1, start: { s: 2, a }, end: { s: 2, a: (starts[i + 1] ?? 51) - 1 }, unit: 'page' }));
      window.RAFIQ_QURAN_INDEX.ensure = async () => ({ pages, juz: [] });
    }, starts);
    await MEM(page, 'setReviewMode', 'weekly');
    await page.evaluate(() => window.RAFIQ_MEM.addPrior(2, 1, 2, 50));
    await MEM(page, 'setWeeklyReviewConfig', { enabled: true, distribution: 'pages' });
    const plan = await MEM(page, 'plan');
    const days = weekOf(plan), all = days.flat();

    check('with page data: distribution is "pages" (no fallback)', all.length > 0 && all.every(t => t.distribution === 'pages'), [...new Set(all.map(t => t.distribution))].join(','));
    check('with page data: 7 non-empty days, 2:1–2:50 covered exactly once', days.length === 7 && days.every(d => d.length > 0) && coversExactlyOnce(all, 1, 50), days.map(d => d.length).join(','));
    check('with page data: every day starts exactly on a page boundary', days.every(d => d.every(t => starts.includes(t.start.a))), days.map(d => d.map(t => t.start.a)).join(' | '));
    check('with page data: no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors[0]);
    await page.context().close();
  }
}
