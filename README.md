# رفيق القرآن — Refactored GitHub Pages Build

This build keeps the original visual design and feature surface while separating the project into external CSS/JS modules.

## Structure

- `index.html` — markup
- `css/tokens.css` — design tokens and Quran font
- `css/app.css` — visual system (kept in original cascade order for visual parity)
- `css/print.css` — print entry point
- `js/state.js` — application state and defaults
- `js/storage.js` — debounced localStorage persistence
- `js/data.js` — stable static data tables
- `js/particles.js` — canvas particle bursts
- `js/app.js` — application behavior

## GitHub Pages

Upload the **contents** of this folder to the root of the existing repository. Keep your existing `quran-uthmani.json`, `sw.js`, manifest and icon files.

Do not put this folder inside another folder in the repository. `index.html` must remain at repository root if Pages publishes `/ (root)`.
