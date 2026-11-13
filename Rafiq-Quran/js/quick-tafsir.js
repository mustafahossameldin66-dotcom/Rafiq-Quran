/* =====================================================
   رفيق القرآن — نافذة التفسير السريع المنبثقة
   Quick Tafsir & Meanings Bottom Sheet
   ===================================================== */
(function(){
  'use strict';

  let currentAudio = null;

  function cleanIslamicText(t){
    if(!t)return '';
    return String(t)
      .replace(/<br\s*\/?>/gi,'\n')
      .replace(/<span[^>]*class=["'][^"']*book-ayah[^"']*["'][^>]*>\s*\(?([\s\S]*?)\)?\s*<\/span>/gi,'﴿ $1 ﴾')
      .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi,'$1')
      .replace(/<[^>]+>/g,'')
      .replace(/\[\d+\]/g,'')
      .replace(/&quot;/g,'"')
      .replace(/&amp;/g,'&')
      .replace(/&lt;/g,'<')
      .replace(/&gt;/g,'>')
      .replace(/[ \t]+/g,' ')
      .replace(/\n\s*\n+/g,'\n\n')
      .trim();
  }

  async function openQuickTafsir(surahNo, ayahNo){
    surahNo = Number(surahNo);
    ayahNo = Number(ayahNo);

    // Find ayah text in local Quran
    const quran = window.RAFIQ_API?.quran || window.RAFIQ_QURAN || [];
    const surah = quran.find(s => Number(s.s) === surahNo);
    const verse = surah?.verses?.find(v => Number(v.a) === ayahNo);
    const ayahText = verse ? verse.text : '';
    const surahName = surah ? surah.name : `سورة ${surahNo}`;

    // Create Bottom Sheet DOM
    const overlay = document.createElement('div');
    overlay.className = 'quick-tafsir-overlay';
    overlay.id = 'quickTafsirModal';

    overlay.innerHTML = `
      <div class="quick-tafsir-sheet" role="dialog" aria-modal="true" aria-labelledby="quickTafsirTitle">
        <div class="quick-tafsir-handle" title="سحب أو إغلاق"></div>
        <div class="quick-tafsir-header">
          <h3 class="quick-tafsir-title" id="quickTafsirTitle">تفسير سورة ${surahName} · الآية ${ayahNo}</h3>
          <button class="quick-tafsir-close" type="button" aria-label="إغلاق">✕</button>
        </div>
        <div class="quick-tafsir-body">
          <div class="quick-tafsir-ayah-box">
            ﴿ ${ayahText || 'جارٍ تحميل نص الآية…'} ﴾
          </div>

          <div class="quick-tafsir-section" id="qtTafsirBox">
            <h4>📖 التفسير الميسر</h4>
            <p id="qtTafsirText" style="color:#c9decb">جارٍ جلب التفسير الميسر…</p>
          </div>

          <div class="quick-tafsir-section" id="qtMeaningsBox">
            <h4>💡 معاني غريب الكلمات</h4>
            <div id="qtMeaningsText" style="color:#b5d5c5">جارٍ جلب معاني الكلمات…</div>
          </div>

          <div class="quick-tafsir-section" id="qtAsbabBox" hidden>
            <h4>📜 سبب النزول (الواحدي)</h4>
            <p id="qtAsbabText" style="color:#c9decb"></p>
          </div>

          <div class="quick-tafsir-actions">
            <button class="btn primary" id="qtPlayBtn" type="button">▶️ استمع للآية</button>
            <button class="btn" id="qtCopyBtn" type="button">📋 نسخ التفسير</button>
            <button class="btn" id="qtStudyFullBtn" type="button">🔍 دراسة مفصلة</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = () => {
      overlay.classList.remove('open');
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      setTimeout(() => overlay.remove(), 260);
    };

    overlay.querySelector('.quick-tafsir-close').onclick = close;
    overlay.querySelector('.quick-tafsir-handle').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Fetch Content asynchronously
    const CONTENT = window.RAFIQ_CONTENT;
    if (CONTENT?.getBookContent) {
      // 1) Tafsir (Book 2012 / 32)
      CONTENT.getBookContent(surahNo, ayahNo, 2012).then(res => {
        const text = cleanIslamicText(res?.text) || 'التفسير متاح عند الاتصال أو تنزيل الحزمة العلمية.';
        const el = overlay.querySelector('#qtTafsirText');
        if (el) el.textContent = text;
      }).catch(() => {
        const el = overlay.querySelector('#qtTafsirText');
        if (el) el.textContent = 'يتطلب اتصالاً بالإنترنت أو تنزيل حزمة التفسير.';
      });

      // 2) Word meanings (Book 2013)
      CONTENT.getBookContent(surahNo, ayahNo, 2013).then(res => {
        const text = cleanIslamicText(res?.text);
        const box = overlay.querySelector('#qtMeaningsBox');
        const el = overlay.querySelector('#qtMeaningsText');
        if (!text || text.trim() === '') {
          if (box) box.hidden = true;
        } else {
          if (el) el.innerHTML = text.replace(/\n/g, '<br/>');
        }
      }).catch(() => {});

      // 3) Asbab al-Nuzul (Book 2919)
      CONTENT.getBookContent(surahNo, ayahNo, 2919).then(res => {
        const text = cleanIslamicText(res?.text);
        const box = overlay.querySelector('#qtAsbabBox');
        const el = overlay.querySelector('#qtAsbabText');
        const heading = box?.querySelector('h4');
        if (text && text.trim() !== '') {
          if (box) box.hidden = false;
          if (heading) heading.innerHTML = '🕊️ سبب النزول (الواحدي)';
          if (el) el.innerHTML = text.replace(/\n/g, '<br/>');
        } else {
          if (box) {
            box.hidden = false;
            if (heading) heading.innerHTML = '🕊️ سبب النزول — توجيه علمي';
            if (el) el.innerHTML = '<span style="color:#b2d8c0;font-size:13.5px;line-height:1.7;display:block">نزلت هذه الآية الكريمة <strong>ابتداءً</strong> لهداية الخلق وتشريع الأحكام، ولم يُنقل لها سبب نزول خاص بحادثة عينية في كتب الأسباب المسندة (كالواحدي والسيوطي).</span>';
          }
        }
      }).catch(() => {});
    }

    // Play Audio
    overlay.querySelector('#qtPlayBtn').onclick = () => {
      const list = window.RAFIQ_RECITERS || [];
      const pref = window.RAFIQ_API?.state?.prefs?.reciter || window.RAFIQ_API?.state?.audio?.reciter;
      const r = list.find(x => x.folder === pref) || list[0];
      const audioUrl = `https://everyayah.com/data/${r?.folder || 'Husary_128kbps'}/${String(surahNo).padStart(3,'0')}${String(ayahNo).padStart(3,'0')}.mp3`;
      if (currentAudio) currentAudio.pause();
      currentAudio = new Audio(audioUrl);
      currentAudio.play().then(() => {
        window.rafiqToast?.(`تلاوة بصوت ${r?.name || 'الشيخ الحصري'}`);
      }).catch(() => window.rafiqToast?.('تعذر تشغيل الصوت دون اتصال'));
    };

    // Copy Tafsir
    overlay.querySelector('#qtCopyBtn').onclick = () => {
      const tafsir = overlay.querySelector('#qtTafsirText')?.textContent || '';
      const text = `﴿ ${ayahText} ﴾ [${surahName}: ${ayahNo}]\n\nالتفسير الميسر:\n${tafsir}\n\n— عبر تطبيق رفيق القرآن`;
      navigator.clipboard.writeText(text)
        .then(() => window.rafiqToast?.('تم نسخ الآية وتفسيرها بنجاح ✅'))
        .catch(() => window.rafiqToast?.('تعذر النسخ'));
    };

    // Full Ayah Study
    overlay.querySelector('#qtStudyFullBtn').onclick = () => {
      close();
      if (typeof window.openAyahStudy === 'function') {
        window.openAyahStudy(surahNo, ayahNo);
      }
    };
  }

  // Hook into Mushaf Ayah action bars
  function patchMushafTafsirButtons(){
    const versesBox = document.getElementById('mushafVerses');
    if (!versesBox) return;

    const patchCards = () => {
      versesBox.querySelectorAll('.mushaf-ayah').forEach(ayahEl => {
        const actions = ayahEl.querySelector('.mushaf-ayah-actions');
        if (!actions || actions.querySelector('.quick-tafsir-trigger-btn')) return;

        const ayahNo = Number(ayahEl.dataset.ayah);
        const currentSurahBtn = document.querySelector('.mushaf-surah-btn.active');
        const sNo = Number(currentSurahBtn?.dataset?.sura || 1);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ayah-action-btn quick-tafsir-trigger-btn';
        btn.innerHTML = '<span class="ayah-ico" data-ico="tafsir"></span> تفسير';
        btn.title = 'تفسير سريع ومعاني الكلمات';
        btn.onclick = (e) => {
          e.stopPropagation();
          openQuickTafsir(sNo, ayahNo);
        };
        // Insert right after the first button
        actions.insertBefore(btn, actions.children[1] || null);
      });
    };

    new MutationObserver(patchCards).observe(versesBox, { childList: true, subtree: false });
    patchCards();
  }

  window.openQuickTafsir = openQuickTafsir;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchMushafTafsirButtons);
  else patchMushafTafsirButtons();
})();
