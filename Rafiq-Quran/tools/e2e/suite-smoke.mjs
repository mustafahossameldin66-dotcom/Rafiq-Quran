import { freshPage, finishOnboarding, goto } from './lib.mjs';
export const name = 'smoke: boot, every view, built-in juz index';
const VIEWS = ['home', 'quran', 'plan', 'recitations', 'athar', 'schedule', 'progress', 'galaxy', 'settings'];
export async function run({ browser, url, check }) {
  const page = await freshPage(browser, url);
  check('first run shows onboarding', await page.evaluate(() => !document.querySelector('#welcomeScreen')?.classList.contains('hidden')));
  await finishOnboarding(page);
  check('onboarding completes and is remembered', await page.evaluate(() => { const k = Object.keys(localStorage).find(k => /^rafiq-state-/.test(k)); return JSON.parse(localStorage[k]).onboardingComplete === true; }));
  for (const v of VIEWS) { await goto(page, v); check(`view "${v}" opens`, await page.evaluate(() => document.body.dataset.view) === v); }
  const juz = await page.evaluate(async () => JSON.stringify(await window.RAFIQ_QURAN_INDEX.resolve('juz', 30, 1)));
  check('juz 30 resolves offline to 78:1 → 114:6', juz.includes('"s":78,"a":1') && juz.includes('"s":114,"a":6'), juz);
  check('no uncaught JavaScript errors', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await page.context().close();
}
