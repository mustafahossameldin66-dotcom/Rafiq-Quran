# End-to-end tests (real Chromium, fully offline)

```
node tools/e2e/run.mjs            # every suite
node tools/e2e/run.mjs backup     # only suites whose file name contains "backup"
```

Needs [Playwright](https://playwright.dev) with a Chromium build:

```
cd tools/e2e && npm i -D playwright && npx playwright install chromium
```

Environment overrides: `PLAYWRIGHT_PATH=/path/to/node_modules/playwright`, `CHROMIUM_PATH=/path/to/chrome`.

The runner serves the project from a throw-away local server, blocks every non-local request (so results never
depend on the network), and exits with code 1 if any check fails. Run it together with `node tools/preflight.mjs`
before each release.

| Suite | Covers |
|---|---|
| `suite-smoke` | first-run onboarding, all 9 views open, built-in juz index, no uncaught JS errors |
| `suite-plan` | plan units (ayahs / surah / page / juz), labels, offline page warning, one planned range per day |
| `suite-backup` | export, import, 5 kinds of bad files, storage-full rollback, preferences (reciter) survive reload |
| `suite-memorization` | 7-day stabilization, weekly and spaced scheduling, overlap / reversed / out-of-range handling |
| `suite-session` | session task order, recitation hints, grading, completion state, modal geometry |

Each regression fixed in this project has a check that fails if the bug comes back (verified by re-introducing it).
Not covered: anything that needs the network (online hadith, MP3Quran reciters, audio playback, push notifications).
