Rafiq Quran — Ultimate Superstar Release

Core architecture:
- Offline-first PWA with bundled Quran data.
- Service Worker caches local core files.
- IndexedDB caches study content and downloaded recitations.
- Quran is local-first; network is used for updates and external content.

Mushaf:
- 114 surahs and full bundled Quran text.
- Surah index/search/navigation.
- Ayah selection, memorization state, last position, audio, and in-page Ayah Study.
- Ayah Study tabs: summary, Tafsir, Word Meanings, Tajweed, and Asbab al-Nuzul.
- Quranpedia API provides the external scholarly data; cached results remain available offline.
- Asbab al-Nuzul checks the selected Al-Wahidi book first (Quranpedia book 242), with a verified alternate edition fallback.

Recitations:
- Curated primary list requested for this release: 35 named reciters.
- MP3Quran API dynamically resolves current reciter/read metadata and available surahs when online.
- Last successful catalog is cached locally; curated names remain visible when offline.
- Play, pause, stop, previous, next, reciter/surah/ayah selection, and download center.
- Download scopes: ayah, surah, juz, full Quran, Al-Zahrawain, Al-Tawaseem, Al-Hawamim, Al-Musabbihat, Al-Muawwidhat, and Al-Mufassal.
- Previously downloaded audio is stored in IndexedDB for offline playback.

Removed:
- Live TV/radio features (Makkah, Madinah, Quran Radio), per project direction.
- Obsolete duplicate study-modal layer.
- Light mode and old calm-session UI.

QA checks performed:
- node --check passed for all JS files.
- No duplicate HTML ids.
- No missing local asset references from index.html.
- Quran JSON contains 114 surahs.
- Requested reciter list is embedded as the offline curated catalog.
- No live-broadcast code paths remain.
- ZIP integrity checked after packaging.

External-source caveat:
- Live MP3Quran/Quranpedia APIs and audio streams require network access at runtime; local cached/bundled fallbacks are used where supported.
