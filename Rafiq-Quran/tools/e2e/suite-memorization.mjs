import { freshPage, finishOnboarding, installClock, MEM, memData } from './lib.mjs';
export const name = 'memorization: stabilization, weekly + spaced scheduling, edge cases';
export async function run({ browser, url, check }) {
  const page = await freshPage(browser, url); await finishOnboarding(page);
  const clock = await installClock(page);
  const items = async () => (await memData(page)).items;
  await MEM(page, 'setReviewMode', 'weekly'); await clock.set(0);
  await MEM(page, 'markNew', 1, 1, 1, 7);
  let it = (await items())[0]; const id = it.id;
  check('new memorization starts in the stabilizing phase', it.phase === 'stabilizing');
  await MEM(page, 'grade', id, 'good'); await MEM(page, 'grade', id, 'good');
  check('grading twice on the same day counts once', (await items())[0].stabilizationHistory.length === 1);
  await clock.set(1); await MEM(page, 'grade', id, 'good');
  await clock.set(2); await MEM(page, 'grade', id, 'relearn');
  it = (await items())[0];
  check('"relearn" resets stabilization progress and counts a lapse', it.stabilizationHistory.length === 0 && it.lapses === 1 && it.phase === 'stabilizing');
  for (let d = 3; d <= 8; d++) { await clock.set(d); await MEM(page, 'grade', id, 'good'); }
  check('6 distinct days are not enough', (await items())[0].phase === 'stabilizing');
  await clock.set(9); await MEM(page, 'grade', id, 'good'); it = (await items())[0];
  check('7th distinct day → review phase, due in 7 days', it.phase === 'review' && it.dueKey === await clock.key(16), `${it.phase} ${it.dueKey}`);

  const reviewIds = async () => (await MEM(page, 'plan')).reviews.map(r => r.id || r.itemId);
  await clock.set(12); check('not listed in reviews before it is due', !(await reviewIds()).includes(id));
  await clock.set(16); check('listed in reviews on its due day', (await MEM(page, 'plan')).reviews.length > 0);
  await MEM(page, 'grade', id, 'good'); it = (await items())[0];
  check('weekly: "good" → due +7 days', it.dueKey === await clock.key(23));
  await clock.set(23); await MEM(page, 'grade', id, 'relearn'); it = (await items())[0];
  check('weekly: "relearn" → due tomorrow, lapse counted', it.dueKey === await clock.key(24) && it.lapses === 2);

  await clock.set(100); await MEM(page, 'setReviewMode', 'spaced');
  const iv = {};
  for (const [g, s] of [['easy', 2], ['good', 3], ['hard', 4], ['relearn', 5]]) {
    const p = await page.evaluate(([s]) => window.RAFIQ_MEM.addPrior(s, 1, s, 3).id, [s]);
    iv[g] = (await MEM(page, 'grade', p, g)).item.interval;
  }
  check('spaced: easy > good > hard ≥ relearn, relearn = 1 day', iv.easy > iv.good && iv.good > iv.hard && iv.hard >= iv.relearn && iv.relearn === 1, JSON.stringify(iv));
  const g0 = await page.evaluate(() => window.RAFIQ_MEM.addPrior(6, 1, 6, 3).id); const seq = []; let day = 200;
  for (let i = 0; i < 5; i++) { await clock.set(day); const r = await MEM(page, 'grade', g0, 'good'); seq.push(r.item.interval); day += r.item.interval; }
  check('spaced: repeated "good" grows the interval', seq.every((v, i) => !i || v >= seq[i - 1]) && seq.at(-1) > seq[0], seq.join('→'));

  check('overlapping an existing range is rejected', !(await page.evaluate(() => window.RAFIQ_MEM.markNew(1, 3, 1, 5))));
  const n0 = (await items()).length; const cross = await page.evaluate(() => window.RAFIQ_MEM.markNew(10, 120, 11, 3));
  check('range crossing a surah boundary is accepted', !!cross && (await items()).length === n0 + 1);
  const rev = await page.evaluate(() => window.RAFIQ_MEM.markNew(30, 5, 30, 2));
  check('reversed range is normalized (start ≤ end)', rev.start.a === 2 && rev.end.a === 5);
  const revP = await page.evaluate(() => window.RAFIQ_MEM.addPrior(40, 9, 40, 4));
  check('reversed prior range is normalized too', revP.start.a === 4 && revP.end.a === 9);
  const crazy = await page.evaluate(() => window.RAFIQ_MEM.markNew(999, 999, 999, 999));
  check('out-of-range surah/ayah is clamped to a real ayah', crazy.start.s === 114 && crazy.start.a >= 1);

  const sig = async () => JSON.stringify((await items()).map(i => [i.id, i.phase, i.dueKey, i.lapses]));
  const s1 = await sig(); await page.reload(); await page.waitForTimeout(1500);
  check('memorization data survives a reload unchanged', s1 === await sig());
  check('no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await page.context().close();
}
