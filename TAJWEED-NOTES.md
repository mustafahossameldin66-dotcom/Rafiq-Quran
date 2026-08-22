# Tajweed implementation — stable path

- Runtime source: Al Quran Cloud `quran-tajweed`; the app requests the current ayah first, then falls back to the surah endpoint.
- The response parser accepts both the single-ayah shape (`data.text`) and surah shape (`data.ayahs`).
- Successful ayah results are cached locally by `surah:ayah`, so the same study view works offline afterward.
- No Quran Foundation browser call is used directly; current Content APIs require authenticated app credentials/server-side integration.
- The UI only displays source-marked tajweed; it does not infer colored tajweed rules from plain Quran text.
- Connected-pronunciation is a separate conservative teaching layer. The original Quran text is never altered.
- Example: `وَلَٰكِن لَّا` may be shown as `وَلَٰكِلَّا` only in the pronunciation aid when the source supports the idgham-without-ghunnah context.

Reference for the source markup and rule legend: Al Quran Cloud Tajweed Guide.
