/* =====================================================
   رفيق القرآن — نظام الفواصل القرآنية (Bookmarks & Ribbons)
   - فاصلة ورد الحفظ (أحمر)
   - فاصلة ورد التلاوة (أخضر)
   - فاصلة التدبر والوقفة (ذهبي)
   ===================================================== */
(function(){
  'use strict';
  const STORAGE_KEY = 'rafiq-bookmarks-v1';

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function normalizeBookmark(value){
    if(!value || typeof value !== 'object') return null;
    const surah = Number(value.surah), ayah = Number(value.ayah);
    if(!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) return null;
    return {
      surah,
      ayah,
      surahName: String(value.surahName || `سورة ${surah}`),
      date: Number.isFinite(Number(value.date)) ? Number(value.date) : Date.now()
    };
  }

  function getBookmarks(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(saved && typeof saved === 'object') return {
        hifz: normalizeBookmark(saved.hifz),
        tilawa: normalizeBookmark(saved.tilawa),
        tadabbur: normalizeBookmark(saved.tadabbur)
      };
      return {
        hifz: { surah: 2, ayah: 1, surahName: 'البقرة', date: Date.now() },
        tilawa: { surah: 1, ayah: 1, surahName: 'الفاتحة', date: Date.now() },
        tadabbur: null
      };
    } catch {
      return { hifz: null, tilawa: null, tadabbur: null };
    }
  }

  function saveBookmarks(bms){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bms)); } catch{}
    document.dispatchEvent(new CustomEvent('rafiq-bookmarks-updated', { detail: bms }));
  }

  function setBookmark(type, surah, ayah, surahName){
    const bms = getBookmarks();
    bms[type] = {
      surah: Number(surah),
      ayah: Number(ayah),
      surahName: surahName || `سورة ${surah}`,
      date: Date.now()
    };
    saveBookmarks(bms);
    const typeLabel = type === 'hifz' ? 'ورد الحفظ' : type === 'tilawa' ? 'ورد التلاوة' : 'التدبر والوقفة';
    window.rafiqToast?.(`تم وضع فاصلة ${typeLabel} عند الآية ${ayah} من ${bms[type].surahName} 📌`);
  }

  function removeBookmark(type){
    const bms = getBookmarks();
    bms[type] = null;
    saveBookmarks(bms);
    window.rafiqToast?.('تمت إزالة الفاصلة');
  }

  // Render Bookmarks widget on the Home page (#homeBookmarksWidget)
  function renderHomeBookmarksWidget(){
    const host = document.getElementById('homeBookmarksWidget');
    if (!host) return;
    const bms = getBookmarks();

    const renderCard = (type, label, icon, cls, data) => {
      if (!data) {
        return `
          <div class="card bookmark-home-card empty" style="border:1px dashed rgba(212,175,55,0.25);padding:14px;border-radius:12px;background:rgba(12,38,28,0.4)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="font-size:1.2rem">${icon}</span>
              <strong style="color:#d1e5db">${label}</strong>
            </div>
            <small style="color:#8aaa98;display:block;margin-bottom:10px">لم تُحدد فاصلة بعد</small>
            <button class="btn" type="button" onclick="window.RAFIQ_APP?.go('quran')" style="font-size:0.8rem;padding:4px 10px">فتح المصحف للتعيين</button>
          </div>
        `;
      }
      return `
        <div class="card bookmark-home-card" style="border-right:4px solid ${cls};padding:14px;border-radius:12px;background:rgba(12,38,28,0.65)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#f7edcf">
              <span>${icon}</span> ${label}
            </span>
            <small style="color:#8aaa98;font-size:0.75rem">${new Date(data.date).toLocaleDateString('ar-EG', {day:'numeric',month:'short'})}</small>
          </div>
          <div style="font-family:'Amiri',serif;font-size:1.15rem;color:#e5c977;margin:6px 0">
            ${esc(data.surahName)} · الآية ${data.ayah}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn primary" type="button" style="font-size:0.8rem;padding:4px 12px" onclick="window.RAFIQ_BOOKMARKS?.jump('${type}')">استئناف القراءة ←</button>
            <button class="text-btn" type="button" style="font-size:0.78rem;color:#8aaa98" onclick="window.RAFIQ_BOOKMARKS?.remove('${type}')">إزالة</button>
          </div>
        </div>
      `;
    };

    host.innerHTML = `
      <div class="section-head" style="margin-top:20px;margin-bottom:12px">
        <div>
          <h3 style="margin:0;font-size:1.15rem;color:#f7edcf;display:flex;align-items:center;gap:8px">
            <span>📌</span> فواصلي القرآنية
          </h3>
          <p style="margin:4px 0 0;font-size:0.85rem;color:#8aaa98">علاماتك المرجعية للعودة السريعة لما وقفت عنده.</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px">
        ${renderCard('tilawa', 'فاصلة الورد والتلاوة', '🟢', '#28a745', bms.tilawa)}
        ${renderCard('hifz', 'فاصلة ورد الحفظ', '🔴', '#dc3545', bms.hifz)}
        ${renderCard('tadabbur', 'فاصلة التدبر والوقفة', '🟡', '#d4af37', bms.tadabbur)}
      </div>
    `;
  }

  function jumpToBookmark(type){
    const bms = getBookmarks();
    const target = bms[type];
    if (!target) return window.rafiqToast?.('لا توجد فاصلة محددة لهذا الورد');
    
    // Switch to Quran view
    if (typeof window.RAFIQ_APP?.go === 'function') {
      window.RAFIQ_APP.go('quran');
    } else {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-quran')?.classList.add('active');
    }

    // Tell Mushaf to jump to this Surah & Ayah
    setTimeout(() => {
      const surahBtn = document.querySelector(`.mushaf-surah-btn[data-sura="${target.surah}"]`);
      if (surahBtn) surahBtn.click();
      setTimeout(() => {
        const ayahEl = document.querySelector(`.mushaf-ayah[data-ayah="${target.ayah}"]`);
        if (ayahEl) {
          ayahEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          ayahEl.style.outline = '2px solid #d4af37';
          ayahEl.style.boxShadow = '0 0 20px rgba(212,175,55,0.4)';
          setTimeout(() => { ayahEl.style.outline = ''; ayahEl.style.boxShadow = ''; }, 3000);
        }
      }, 350);
    }, 150);
  }

  // Hook into Mushaf rendering to display active bookmarks on Ayahs
  function updateMushafIndicators(){
    const bms = getBookmarks();
    // Remove existing indicators
    document.querySelectorAll('.ayah-bookmark-indicator').forEach(el => el.remove());
    
    // Get current surah in mushaf
    const titleEl = document.getElementById('mushafSurahTitle');
    if (!titleEl) return;

    ['tilawa', 'hifz', 'tadabbur'].forEach(type => {
      const bm = bms[type];
      if (!bm) return;
      const ayahCard = document.querySelector(`.mushaf-ayah[data-ayah="${bm.ayah}"]`);
      if (ayahCard) {
        // verify surah number
        const currentSurahBtn = document.querySelector('.mushaf-surah-btn.active');
        const sNo = Number(currentSurahBtn?.dataset?.sura || 1);
        if (sNo === bm.surah) {
          const indicator = document.createElement('div');
          indicator.className = `ayah-bookmark-indicator ${type}`;
          indicator.title = `فاصلة ${type === 'hifz' ? 'الحفظ' : type === 'tilawa' ? 'التلاوة' : 'التدبر'}`;
          ayahCard.appendChild(indicator);
        }
      }
    });
  }

  // Inject bookmark buttons into Ayah action bars
  function patchAyahActionBars(){
    const versesBox = document.getElementById('mushafVerses');
    if (!versesBox) return;

    const patchCards = () => {
      versesBox.querySelectorAll('.mushaf-ayah').forEach(ayahEl => {
        const actions = ayahEl.querySelector('.mushaf-ayah-actions');
        if (!actions || actions.querySelector('.ayah-bookmark-trigger-btn')) return;

        const ayahNo = Number(ayahEl.dataset.ayah);
        const currentSurahBtn = document.querySelector('.mushaf-surah-btn.active');
        const sNo = Number(currentSurahBtn?.dataset?.sura || 1);
        const sName = currentSurahBtn?.querySelector('.mushaf-surah-name')?.textContent || 'السورة';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ayah-action-btn ayah-bookmark-trigger-btn';
        btn.innerHTML = '<span class="ayah-ico" data-ico="bookmark"></span> فاصلة';
        btn.title = 'تثبيت فاصلة ملونة عند هذه الآية (حفظ، تلاوة، تدبر)';
        btn.onclick = (e) => {
          e.stopPropagation();
          openBookmarkSelector(sNo, ayahNo, sName);
        };
        actions.appendChild(btn);
      });
      updateMushafIndicators();
    };

    new MutationObserver(patchCards).observe(versesBox, { childList: true, subtree: false });
    patchCards();
  }

  function openBookmarkSelector(surah, ayah, surahName){
    const modal = document.createElement('div');
    modal.className = 'quick-tafsir-overlay open';
    modal.innerHTML = `
      <div class="quick-tafsir-sheet" style="max-width:440px;padding-bottom:16px">
        <div class="quick-tafsir-handle"></div>
        <div class="quick-tafsir-header">
          <h3 class="quick-tafsir-title">📌 اختر الفاصلة المرجعية</h3>
          <button class="quick-tafsir-close" type="button">✕</button>
        </div>
        <div style="padding:20px;text-align:center">
          <div style="font-family:'Amiri',serif;font-size:1.2rem;color:#e5c977;margin-bottom:16px">
            ${esc(surahName)} · الآية ${ayah}
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="bookmark-ribbon-btn bookmark-ribbon-tilawa" style="padding:10px;font-size:0.95rem;justify-content:center" id="bmSelectTilawa">
              🟢 فاصلة ورد التلاوة والقراءة اليومية
            </button>
            <button class="bookmark-ribbon-btn bookmark-ribbon-hifz" style="padding:10px;font-size:0.95rem;justify-content:center" id="bmSelectHifz">
              🔴 فاصلة ورد الحفظ والمراجعة
            </button>
            <button class="bookmark-ribbon-btn bookmark-ribbon-tadabbur" style="padding:10px;font-size:0.95rem;justify-content:center" id="bmSelectTadabbur">
              🟡 فاصلة التدبر والوقفة مع الآية
            </button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.classList.remove('open'); setTimeout(() => modal.remove(), 250); };
    modal.querySelector('.quick-tafsir-close').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    modal.querySelector('#bmSelectTilawa').onclick = () => { setBookmark('tilawa', surah, ayah, surahName); close(); updateMushafIndicators(); };
    modal.querySelector('#bmSelectHifz').onclick = () => { setBookmark('hifz', surah, ayah, surahName); close(); updateMushafIndicators(); };
    modal.querySelector('#bmSelectTadabbur').onclick = () => { setBookmark('tadabbur', surah, ayah, surahName); close(); updateMushafIndicators(); };

    document.body.appendChild(modal);
  }

  function init(){
    renderHomeBookmarksWidget();
    patchAyahActionBars();
    document.addEventListener('rafiq-bookmarks-updated', () => {
      renderHomeBookmarksWidget();
      updateMushafIndicators();
    });
    document.addEventListener('rafiq-data-ready', renderHomeBookmarksWidget);
  }

  window.RAFIQ_BOOKMARKS = {
    get: getBookmarks,
    set: setBookmark,
    remove: removeBookmark,
    jump: jumpToBookmark,
    renderHome: renderHomeBookmarksWidget
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
