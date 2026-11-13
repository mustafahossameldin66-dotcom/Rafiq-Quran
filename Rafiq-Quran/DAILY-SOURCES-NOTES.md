# Daily sources safety pass

- Removed direct client-side Quran Foundation random-verse calls. The daily verse now comes from the bundled Uthmani Quran dataset and rotates once per ritual day.
- Removed Bonyan random hadith/azkar endpoints.
- Daily hadith now uses the Arabic Sahih al-Bukhari edition from fawazahmed0/hadith-api via jsDelivr, with the documented raw GitHub fallbacks. The source edition is `ara-bukhari`.
- Daily dua remains local-curated because no authoritative public random-dua endpoint was accepted as a dependency.
- Quranpedia dump URLs were re-verified against the official 2026-08-20 dumps page; `tafsir-book-32.json.gz`, `tafsir-book-2013.json.gz`, and `asbab-book-2919.json.gz` are official entries.
