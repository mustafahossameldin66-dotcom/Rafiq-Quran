# Rafiq Stable Build

- Base restored from the last build where Mushaf and recitation-page functionality were intact.
- Restored the previous font setup (Amiri + Tajawal via the project's prior configuration).
- Removed the live-broadcast UI and live-stream JavaScript entirely.
- Removed all remaining calls to the deleted live renderer so app initialization cannot crash.
- Kept the Ayah Study bridge: `window.openAyahStudy = openStudy`.
- Kept the full reciter loading/caching/rendering flow.
- Kept the existing Mushaf fallback to `quran-uthmani.json`.
- Removed the settings favorite-reciter selector as requested earlier.
