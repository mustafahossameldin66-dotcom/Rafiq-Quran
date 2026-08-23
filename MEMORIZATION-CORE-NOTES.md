# Rafiq Quran — Memorization Core v4

- One user-facing plan only.
- Daily amount supports ayahs, pages, hizb quarters, juz, or surahs.
- The user does not calculate ayah counts for pages/quarters/juz; the app resolves the exact range and caches it.
- No session timer and no required session duration.
- Start Session always includes the planned new-memory range when a plan exists, even before it is recorded as memorized.
- New memorization becomes active only when the user explicitly records that they memorized the range.
- Initial stabilization is seven successful sessions.
- After stabilization, the user chooses weekly review or FSRS-like spaced repetition.
- Recitation hides the text initially and provides progressive hints.
- Review feedback: لم أتذكر / صعب / جيد / سهل; the engine schedules the next review date.
- Previous memorization uses the same range picker, including whole surahs, ayahs, pages, quarters, and juz.
- Weekly view and upcoming review/weakness information are collapsed to keep the plan page simple.
