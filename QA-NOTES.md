# Rafiq Quran — Mushaf & Ayah Study Repair

## Scope
- Preserved the current stable visual/interaction base and existing font setup.
- Repaired Ayah Study content rendering without changing the app's visual identity.
- Kept the Quranpedia source inside the Rafiq UI: direct API content when available, embedded Quranpedia fallback when live API content is unavailable.
- Corrected tajweed retrieval for browser runtime by using the public Al Quran Cloud `quran-tajweed` edition for the browser-safe fallback; the app still follows a source-marked-only policy and does not infer tajweed heuristically.
- The tajweed panel now only explains the dagger alif (ألف خنجرية) when the ayah actually contains the marker.
- Tajweed rule clicks no longer bubble/default-scroll the page.
- Quranpedia book source links are matched to the selected study section.

## Study books
- Logical 2012 -> Quranpedia book 32: التفسير الميسر
- 2013: معاني الكلمات من كتاب السراج في بيان غريب القرآن
- 2919: أسباب نزول القرآن - الواحدي

## Validation
`node tools/preflight.mjs` passed:
- 235 unique HTML IDs
- all project JavaScript files pass `node --check`
- no broken local references
- CSS brace balance valid
- no exact duplicate CSS blocks detected by the preflight
- manifest JSON valid
