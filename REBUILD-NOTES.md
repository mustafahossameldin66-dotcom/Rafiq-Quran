# Rafiq Quran — Rebuilt Release

This release was rebuilt from the last complete application build, not from the broken typography-only patch.

## Critical runtime fixes
- Restored the complete navigation/bootstrap layer and all core app helpers.
- Removed the undefined `daily` runtime reference from the Athar renderer.
- Kept the welcome/start button fully bound and operational.
- Daily cards render a local fallback immediately and then refresh online.
- Daily online refresh no longer freezes for the whole ritual day when an online request fails.
- Daily verse refresh uses Bonyan's browser-friendly `/ayat/:id` route instead of the authenticated client-side Quran Foundation Content API.
- Hadith and Azkar refresh through Bonyan with local fallbacks.
- Cause-of-revelation follows the currently selected daily verse and is never pinned to one fixed ayah.

## Product cleanup
- Removed live broadcast UI and all live/HLS runtime loading.
- Removed all broadcast-related network requests.
- Kept recitations as the only audio network feature, with explicit offline download.
- Added the premium local typography/icon identity stylesheet to the offline service-worker core.
- Replaced pictographic emoji UI symbols with the restrained Rafiq glyph system.
- Kept Quran text font stack separate from general UI text.
- Bumped app state/service-worker versions so stale deployed caches do not revive the broken build.

## Offline-first behavior
- Quran shell and data remain bundled locally.
- Scientific study content remains cache/dump backed.
- Daily content uses online refresh + last-known-good/local fallback.
- Undownloaded audio remains online-only.
