/* =====================================================
   رفيق القرآن — متتبع الختمة وتوزيع الورد اليومي
   Quran Khatmah Tracker & Daily Portion Engine
   ===================================================== */
(function(){
  'use strict';

  const STORAGE_KEY = 'rafiq-khatmah-v1';

  function getKhatmah(){
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        active: true,
        startDate: Date.now(),
        targetDays: 30, // Default: ختمة شهر (20 صفحة يومياً)
        currentPage: 1, // من صفحة 1 إلى 604
        dailyPages: 20,
        history: []
      };
    } catch {
      return { active: true, startDate: Date.now(), targetDays: 30, currentPage: 1, dailyPages: 20, history: [] };
    }
  }

  function saveKhatmah(k){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(k)); } catch{}
    document.dispatchEvent(new CustomEvent('rafiq-khatmah-updated', { detail: k }));
  }

  function markProgress(pagesRead){
    const k = getKhatmah();
    pagesRead = Math.max(1, Number(pagesRead) || 1);
    k.currentPage = Math.min(604, k.currentPage + pagesRead);
    k.history = k.history || [];
    k.history.push({ date: new Date().toISOString().slice(0, 10), pages: pagesRead, page: k.currentPage });
    saveKhatmah(k);

    if (k.currentPage >= 604) {
      window.rafiqToast?.('🎉 هنيئًا لك! لقد أتممت ختم القرآن الكريم! جعله الله شفيعًا ونورًا لك.');
      window.dispatchEvent(new CustomEvent('rafiq-glow', { detail: { type: 'hifz', msg: '🌟 أتممت الختمة المباركة وتلألأت كل نجوم مجرتك!' } }));
    } else {
      window.rafiqToast?.(`تم تسجيل قراءة ${pagesRead} صفحة (وصلت إلى صفحة ${k.currentPage}) ✅`);
      window.dispatchEvent(new CustomEvent('rafiq-glow', { detail: { type: 'ward', msg: `زاد نور مجرتك بورد اليوم (صفحة ${k.currentPage}) 📖` } }));
    }
  }

  function setGoal(days){
    const k = getKhatmah();
    days = Math.max(7, Math.min(365, Number(days) || 30));
    k.targetDays = days;
    k.dailyPages = Math.ceil(604 / days);
    saveKhatmah(k);
    window.rafiqToast?.(`تم ضبط الختمة على ${days} يومًا بمعدل ${k.dailyPages} صفحة يوميًا.`);
  }

  function renderKhatmahView(){
    const host = document.getElementById('khatmahViewContent');
    if (!host) return;

    const k = getKhatmah();
    const totalPages = 604;
    const remainingPages = Math.max(0, totalPages - k.currentPage);
    const pct = Math.min(100, Math.round((k.currentPage / totalPages) * 100));
    const daysElapsed = Math.max(1, Math.round((Date.now() - (k.startDate || Date.now())) / (1000 * 60 * 60 * 24)));
    const daysLeft = Math.ceil(remainingPages / (k.dailyPages || 20));

    // Approximate finish date
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysLeft);
    const finishStr = finishDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

    host.innerHTML = `
      <div class="khatmah-summary-grid">
        <div class="khatmah-summary-card">
          <small>الصفحة الحالية</small>
          <strong>${k.currentPage} <span style="font-size:0.9rem;color:#8aaa98">/ 604</span></strong>
        </div>
        <div class="khatmah-summary-card">
          <small>المتبقي للختم</small>
          <strong>${remainingPages} <span style="font-size:0.9rem;color:#8aaa98">صفحة</span></strong>
        </div>
        <div class="khatmah-summary-card">
          <small>المعدل اليومي</small>
          <strong>${k.dailyPages} <span style="font-size:0.9rem;color:#8aaa98">صفحة/يوم</span></strong>
        </div>
        <div class="khatmah-summary-card">
          <small>الأيام المتبقية</small>
          <strong>~ ${daysLeft} <span style="font-size:0.9rem;color:#8aaa98">يومًا</span></strong>
        </div>
      </div>

      <div class="card" style="padding:22px;border-radius:14px;background:rgba(13,38,29,0.7);margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;color:#f7edcf">نسبة الإنجاز في الختمة الحالية</span>
          <span style="font-size:1.3rem;font-weight:800;color:#38df9f">${pct}%</span>
        </div>
        <div class="khatmah-progress-bar-wrap">
          <div class="khatmah-progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:#8aaa98">
          <span>البداية: سورة الفاتحة</span>
          <span>تاريخ الختم المتوقع: <strong style="color:#e5c977">${finishStr}</strong></span>
          <span>الختام: سورة الناس</span>
        </div>
      </div>

      <div class="card" style="padding:20px;border-radius:14px;background:rgba(13,38,29,0.7);margin-bottom:20px">
        <h4 style="margin:0 0 14px;color:#f7edcf;font-size:1.05rem">📖 تسجيل ورد اليوم</h4>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
          <button class="btn primary" id="khatmahReadDailyBtn" type="button" style="padding:10px 18px">
            ✓ قرأت ورد اليوم (${k.dailyPages} صفحة)
          </button>
          <button class="btn" id="khatmahReadCustomBtn" type="button" style="padding:10px 16px">
            + تسجيل عدد مخصص
          </button>
          <button class="btn" id="khatmahOpenMushafBtn" type="button" style="padding:10px 16px" onclick="window.RAFIQ_APP?.go('quran')">
            📖 فتح المصحف لمتابعة الورد
          </button>
        </div>
      </div>

      <div class="card" style="padding:18px;border-radius:14px;background:rgba(13,38,29,0.5)">
        <h4 style="margin:0 0 10px;color:#f7edcf;font-size:0.95rem">⚙️ ضبط مدة الختمة</h4>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn ${k.targetDays===30?'primary':''}" type="button" onclick="window.RAFIQ_KHATMAH?.setGoal(30)">ختمة شهر (30 يومًا · جزء يوميًا)</button>
          <button class="btn ${k.targetDays===60?'primary':''}" type="button" onclick="window.RAFIQ_KHATMAH?.setGoal(60)">ختمة شهرين (60 يومًا · 10 صفحات)</button>
          <button class="btn ${k.targetDays===100?'primary':''}" type="button" onclick="window.RAFIQ_KHATMAH?.setGoal(100)">ختمة 100 يوم (6 صفحات)</button>
        </div>
      </div>
    `;

    host.querySelector('#khatmahReadDailyBtn')?.addEventListener('click', () => {
      markProgress(k.dailyPages || 20);
      renderKhatmahView();
      renderHomeKhatmahWidget();
    });

    host.querySelector('#khatmahReadCustomBtn')?.addEventListener('click', () => {
      const input = prompt('أدخل عدد الصفحات التي قرأتها اليوم:', String(k.dailyPages || 20));
      if (input && Number(input) > 0) {
        markProgress(Number(input));
        renderKhatmahView();
        renderHomeKhatmahWidget();
      }
    });
  }

  // Home Page Khatmah Quick Widget
  function renderHomeKhatmahWidget(){
    const host = document.getElementById('homeKhatmahWidget');
    if (!host) return;

    const k = getKhatmah();
    const totalPages = 604;
    const remainingPages = Math.max(0, totalPages - k.currentPage);
    const pct = Math.min(100, Math.round((k.currentPage / totalPages) * 100));

    host.innerHTML = `
      <div class="card" style="padding:16px 20px;border-radius:14px;background:rgba(13,38,29,0.65);border-right:4px solid #38df9f;margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="color:#f7edcf;display:flex;align-items:center;gap:8px">
            <span>🏁</span> متتبع الختمة
          </strong>
          <span style="font-size:0.88rem;color:#38df9f;font-weight:700">${pct}% مكتمل</span>
        </div>
        <div style="font-size:0.9rem;color:#b5d5c5;margin:4px 0">
          الصفحة الحالية: <b style="color:#e5c977">${k.currentPage}</b> · متبقي للختم: <b>${remainingPages}</b> صفحة
        </div>
        <div class="khatmah-progress-bar-wrap" style="height:8px;margin:8px 0 10px">
          <div class="khatmah-progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn primary" type="button" style="font-size:0.8rem;padding:4px 12px" onclick="window.RAFIQ_KHATMAH?.markProgress(${k.dailyPages || 20})">✓ سجّل ورد اليوم (${k.dailyPages} ص)</button>
          <button class="btn" type="button" style="font-size:0.8rem;padding:4px 10px" onclick="window.RAFIQ_APP?.go('khatmah')">تفاصيل الختمة ←</button>
        </div>
      </div>
    `;
  }

  function init(){
    renderKhatmahView();
    renderHomeKhatmahWidget();
    document.addEventListener('rafiq-khatmah-updated', () => {
      renderKhatmahView();
      renderHomeKhatmahWidget();
    });
    document.addEventListener('rafiq-data-ready', renderHomeKhatmahWidget);
  }

  window.RAFIQ_KHATMAH = {
    get: getKhatmah,
    markProgress,
    setGoal,
    render: renderKhatmahView,
    renderHome: renderHomeKhatmahWidget
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
