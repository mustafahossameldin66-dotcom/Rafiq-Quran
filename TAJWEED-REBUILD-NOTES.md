# Tajweed rebuild

The tajweed renderer now has one normalization pipeline for Al Quran Cloud's legacy bracket encoding and modern tagged payloads.

The documented legacy form `[h:9421[ٱ]` is converted into a safe `<tajweed>` element before it reaches the DOM. Raw bracket markers are never inserted into `innerHTML`.

The renderer accepts both ayah-shaped and surah-shaped API responses, caches normalized ayahs, and preserves the Qur'an text itself unchanged.
