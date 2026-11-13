/* تتبّع القارئ: تُضاء الآية التي يقرؤها القارئ الآن في المصحف وتنتقل مع التلاوة.
   - القرّاء بنمط «آية بآية» (الحصري، المنشاوي، عبد الباسط): الآية الحالية معروفة بدقة.
   - القرّاء بنمط «السورة كاملة» (مثل فارس عباد): لا توجد حدود آيات في الملف، فالموضع تقديري
     بحسب نسبة الوقت إلى طول النص، وقد ينحرف قليلًا عن القارئ. */
(() => {
  'use strict';
  const audio = document.getElementById('quranAudio');
  if (!audio) return;

  let last = { surah: 0, ayah: 0 };
  const normLen = t => String(t || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\s]/g, '').length;
  const weightCache = new Map();

  function weights(surah) {
    if (weightCache.has(surah)) return weightCache.get(surah);
    const su = window.RAFIQ_API?.quran?.[surah - 1];
    if (!su) return null;
    const hasBasmala = surah !== 1 && surah !== 9;
    const w = su.verses.map(v => normLen(v.text) + 3); // +3 لوقفة بين الآيات
    const out = { w, lead: hasBasmala ? 19 : 0, total: w.reduce((a, b) => a + b, 0) + (hasBasmala ? 19 : 0), su };
    weightCache.set(surah, out);
    return out;
  }

  function currentAyah() {
    const au = window.RAFIQ_API?.state?.audio;
    if (!au || !au.active) return null;
    const quran = window.RAFIQ_API.quran;
    const su = quran?.[au.surah - 1];
    if (!su) return null;
    if (au.source !== 'mp3quran') {
      const v = su.verses[au.verseIndex];
      return v ? { surah: au.surah, ayah: Number(v.a) } : null;
    }
    const wt = weights(au.surah);
    if (!wt || !audio.duration || !isFinite(audio.duration)) return null;
    const pos = (audio.currentTime / audio.duration) * wt.total - wt.lead;
    if (pos <= 0) return { surah: au.surah, ayah: Number(su.verses[0].a) };
    let acc = 0;
    for (let i = 0; i < wt.w.length; i++) {
      acc += wt.w[i];
      if (pos <= acc) return { surah: au.surah, ayah: Number(su.verses[i].a) };
    }
    return { surah: au.surah, ayah: Number(su.verses[su.verses.length - 1].a) };
  }

  function clear() {
    document.querySelectorAll('.mushaf-ayah.reciting').forEach(el => el.classList.remove('reciting'));
    last = { surah: 0, ayah: 0 };
  }

  function apply(force) {
    const cur = currentAyah();
    if (!cur) { clear(); return; }
    const el = document.getElementById('mushaf-ayah-' + cur.ayah);
    // المصحف المعروض الآن قد يكون سورة أخرى
    const shownSurah = Number(document.querySelector('#mushafSurahMeta')?.textContent?.split('·')[0]);
    if (!el || (shownSurah && shownSurah !== cur.surah)) { document.querySelectorAll('.mushaf-ayah.reciting').forEach(x => x.classList.remove('reciting')); return; }
    const changed = force || cur.surah !== last.surah || cur.ayah !== last.ayah;
    if (!changed && el.classList.contains('reciting')) return;
    document.querySelectorAll('.mushaf-ayah.reciting').forEach(x => x.classList.remove('reciting'));
    el.classList.add('reciting');
    if (changed && !audio.paused && document.body.dataset.view === 'quran') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    last = cur;
  }

  ['timeupdate', 'play', 'loadedmetadata', 'seeked'].forEach(ev => audio.addEventListener(ev, () => apply(false)));
  audio.addEventListener('emptied', clear);

  // إعادة التطبيق عند إعادة رسم المصحف (تغيير السورة)
  const watch = () => {
    const box = document.getElementById('mushafVerses');
    if (!box) return false;
    new MutationObserver(() => apply(true)).observe(box, { childList: true });
    return true;
  };
  if (!watch()) document.addEventListener('DOMContentLoaded', watch);
})();
