# Rafiq Quran — Memorization Core v1

The memorization core is intentionally separated into one module: `js/memorization-engine.js`.

It owns:
- new memorization ranges
- imported prior memorization
- 7-day stabilization
- spaced review intervals (7, 14, 30, 60+ days depending on grading)
- daily session planning
- weekly forecast
- tomorrow / upcoming schedule
- backlog visibility
- session grading: easy / good / hard / relearn behavior
- legacy memorized-ayah migration into prior ranges

The existing galaxy remains visual only; the core schedule is data-driven and independent.
This is a planning system, not a religious ruling; the 7-day stabilization and review intervals are configurable study methodology.

## Core UX included
- One-tap "ابدأ جلسة اليوم" with task sequencing.
- Self-recite challenge with reveal + grading.
- Study-ayah and audio entry points from each session task.
- Smart snooze for one day.
- Weak-point list from repeated hard/relearn outcomes.
- Weekly review day opens all due review groups.
- Daily review cap on non-weekly days to prevent overload.
- Tomorrow + 7-day forecast with new memorization ranges.
- Legacy memorized-ayahs are grouped into prior ranges on first run.
