# Rafiq Quran — Release Candidate QA

Build date: 2026-08-22

## Pre-release gate
- HTML IDs: 235 unique
- No `<style>` blocks outside `<head>`
- All local HTML references resolve
- JavaScript syntax checks pass for all 6 JS modules
- CSS brace-balance checks pass
- No exact duplicate CSS blocks in project CSS files
- `content-manifest.json` and `manifest.webmanifest` parse as valid JSON

## Critical runtime paths repaired
- Ayah Study bridge remains `window.openAyahStudy`
- Restored missing `prefetchStudy()` dependency that previously caused `openStudy()` to abort
- Restored missing `getAuthoritativeTajweed()` dependency
- Restored missing `normalizeClass()` used by tajweed inspector
- Restored missing `buildConnectedPronunciation()` used by tajweed rendering
- Study prefetch runs non-blocking via `Promise.allSettled`
- Tajweed remains source-marked only; no heuristic rule inference is used for tajweed classification
- Quranpedia book API IDs remain mapped as 32 / 2013 / 2919

## Known environment limit
A full interactive browser click-through could not be executed in this environment because the local Chromium runtime is blocked by the execution environment. This build therefore should be treated as a Release Candidate only after the required smoke-test checklist is completed on the user's Chrome/Edge environment.

- Removed the daily 'سبب النزول الموثق' home card and its Daily fetch/render pipeline; Quranpedia asbab remains available inside Ayah Study.
