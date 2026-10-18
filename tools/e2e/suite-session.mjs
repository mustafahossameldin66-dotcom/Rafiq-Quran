import { freshPage, finishOnboarding, goto, MEM, memData } from './lib.mjs';
export const name = 'session: tasks, recitation hints, grading, completion';
export async function run({ browser, url, check }) {
  const page = await freshPage(browser, url); await finishOnboarding(page);
  await page.evaluate(() => { const M = window.RAFIQ_MEM; M.setReviewMode('spaced'); M.addPrior(1, 1, 1, 7); M.markNew(2, 1, 2, 5); M.setPlanPreset({ amount: 3, unit: 'ayahs', startSurah: 3, startAyah: 1 }); });
  await page.waitForTimeout(500); await goto(page, 'plan');
  const open = async () => { await page.evaluate(() => document.querySelector('#memStartSession').click()); await page.waitForTimeout(800); };
  await open();
  const kinds = await page.$$eval('.mem-session-task', r => r.map(x => x.querySelector('strong').textContent));
  check('tasks are ordered: review → stabilization → new (no duplicate row for an already-recorded range)', kinds.join('|') === 'مراجعة مستحقة|تثبيت|حفظ جديد', kinds.join('|'));

  // Measure the real text extent (Range), not the full-width block box, against the close button.
  const overlap = await page.evaluate(() => { const btn = document.querySelector('.mem-modal-close').getBoundingClientRect(); const textBox = sel => { const rg = document.createRange(); rg.selectNodeContents(document.querySelector(sel)); return rg.getBoundingClientRect(); }; return ['.mem-modal-kicker', '.mem-modal-card h3'].map(s => { const y = textBox(s); return !(btn.right <= y.left || btn.left >= y.right || btn.bottom <= y.top || btn.top >= y.bottom); }); });
  check('close button does not overlap the kicker or the title', !overlap.some(Boolean), JSON.stringify(overlap));
  await page.evaluate(() => document.querySelector('.mem-session-task [data-action="recite"]').click()); await page.waitForTimeout(400);
  check('recitation hides the text initially', await page.evaluate(() => document.querySelector('#reciteText').hidden));
  await page.evaluate(() => document.querySelector('[data-hint="firstword"]').click());
  const fw = await page.evaluate(() => document.querySelector('#reciteText').textContent.trim());
  check('"first word" hint shows exactly one word and an ellipsis', fw.endsWith('…') && fw.replace('…', '').trim().split(/\s+/).length === 1, fw);
  await page.evaluate(() => document.querySelector('[data-hint="all"]').click());
  check('"show text" reveals all 7 ayahs of 1:1–7', await page.evaluate(() => document.querySelectorAll('#reciteText p').length) === 7);
  const before = (await memData(page)).priorRanges[0];
  await page.evaluate(() => document.querySelector('[data-grade="good"]').click()); await page.waitForTimeout(400);
  check('grading shows the next review date', /بعد|غدًا|مستحق/.test(await page.evaluate(() => document.querySelector('#reciteNextPreview').textContent)));
  await page.waitForTimeout(1200);
  const after = (await memData(page)).priorRanges[0];
  check('grading updates history and due date; modal closes; row marked done', after.history.length === before.history.length + 1 && after.dueKey !== before.dueKey && await page.evaluate(() => !document.querySelector('.mem-recite-card') && !!document.querySelector('.mem-session-task .mem-done')));

  await page.evaluate(() => [...document.querySelectorAll('.mem-session-task')].find(r => r.textContent.includes('تثبيت')).querySelector('[data-action="recite"]').click()); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-grade="easy"]').click()); await page.waitForTimeout(1500);
  check('stabilization session is recorded', (await memData(page)).items.find(i => i.start.s === 2).stabilizationHistory.length === 1);
  await page.evaluate(() => document.querySelector('[data-action="record"]').click()); await page.waitForTimeout(600);
  const d = await memData(page); const rec = d.items.find(i => i.start.s === 3);
  check('recording the planned range creates a stabilizing item 3:1–3 and advances the cursor to 3:4', rec?.phase === 'stabilizing' && rec.end.a === 3 && d.plan.cursor?.s === 3 && d.plan.cursor?.a === 4);

  await page.evaluate(() => document.querySelector('.mem-modal-close').click()); await page.waitForTimeout(300);
  check('× closes the modal', await page.evaluate(() => !document.querySelector('.mem-modal')));
  await open();
  check('reopening after finishing shows the completed state', /أنجزت/.test(await page.evaluate(() => document.querySelector('.mem-modal-card h3')?.textContent || '')));
  await page.evaluate(() => document.querySelector('.mem-modal-backdrop').click()); await page.waitForTimeout(300);
  check('clicking the backdrop closes the modal', await page.evaluate(() => !document.querySelector('.mem-modal')));
  check('no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await page.context().close();
}
