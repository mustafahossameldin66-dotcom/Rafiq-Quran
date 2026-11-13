# Rafiq Mobile Architecture v4

- One mobile CSS shell: css/mobile.css
- One mobile navigation controller: js/mobile-shell.js
- Quran page/juz/quarter resolver: js/quran-index.js
- Saved layout indexes first; first online sync populates the local cache.
- No Bonyan reciter endpoint; reciter catalog uses the same MP3Quran source as recitations.
- Service worker v13 precaches every mobile/core runtime asset.
- Document scroll is owned by the page; only the More sheet locks body scroll while open.
