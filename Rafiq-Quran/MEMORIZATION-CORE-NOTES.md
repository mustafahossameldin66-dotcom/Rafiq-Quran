# Rafiq Quran — Memorization Core v4

- One user-facing plan only.
- Daily amount supports ayahs, surahs, pages, and juz. (Hizb quarters are not implemented.)
- The user does not calculate ayah counts for pages/juz; the app resolves the exact range.
- Juz boundaries are built into `js/quran-index.js` (works offline, verified by `tools/preflight.mjs`). Page boundaries still come from the network on first use and are then cached locally; offline with no cache, the page unit reports "unavailable".
- No session timer and no required session duration.
- Start Session always includes the planned new-memory range when a plan exists, even before it is recorded as memorized.
- New memorization becomes active only when the user explicitly records that they memorized the range.
- Initial stabilization is seven successful sessions.
- After stabilization, the user chooses weekly review or FSRS-like spaced repetition.
- Recitation hides the text initially and provides progressive hints.
- Review feedback: لم أتذكر / صعب / جيد / سهل; the engine schedules the next review date.
- Previous memorization uses the same range picker, including whole surahs, ayahs, pages, and juz.
- Weekly view and upcoming review/weakness information are collapsed to keep the plan page simple.
