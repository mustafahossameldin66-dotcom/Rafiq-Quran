/* =====================================================
   رفيق القرآن — نظام التحفيزات والتحديات الأسبوعية
   Weekly Challenges & Achievement Badges System
   ===================================================== */
(function () {
  'use strict';

  /* ─── مفاتيح التخزين ────────────────────────────── */
  const STORE_KEY = 'rafiq-challenges-v1';
  const toast = msg => window.rafiqToast?.(msg);

  /* ─── تعريف التحديات الأسبوعية الثابتة ─────────── */
  /*
    كل تحدٍّ له:
      id        – مفتاح فريد
      icon      – أيقونة
      title     – عنوان
      desc      – وصف قصير
      target    – الهدف (عدد)
      unit      – وحدة القياس (للعرض)
      activity  – نوع النشاط المرتبط به في activityLog ('mem', 'read', 'sessions', 'athar', 'adhkar', 'hifz')
      reward    – رسالة المكافأة عند الإكمال
  */
  const WEEKLY_TEMPLATES = [
    {
      id: 'w_sessions',
      icon: '🔆',
      title: 'المواظب',
      desc: 'أكمل ٥ جلسات حفظ هذا الأسبوع',
      target: 5,
      unit: 'جلسة',
      activity: 'sessions',
      reward: 'ما شاء الله! المواظبة من أفضل الأعمال ✨'
    },
    {
      id: 'w_mem',
      icon: '📖',
      title: 'الحافظ',
      desc: 'احفظ ٢٠ آية جديدة هذا الأسبوع',
      target: 20,
      unit: 'آية',
      activity: 'mem',
      reward: 'بارك الله فيك — قلبك يحمل كلام الله 🌿'
    },
    {
      id: 'w_athar',
      icon: '🌙',
      title: 'المتدبّر',
      desc: 'سجّل الأثر اليومي ٥ أيام متتالية',
      target: 5,
      unit: 'يوم',
      activity: 'athar',
      reward: 'التدبر نور في القلب — واصل 💛'
    },
    {
      id: 'w_read',
      icon: '📜',
      title: 'القارئ',
      desc: 'سجّل ١٠ جلسات قراءة هذا الأسبوع',
      target: 10,
      unit: 'جلسة قراءة',
      activity: 'read',
      reward: 'يقرأ ثم يتدبر — ما أجمل هذا! 🌺'
    },
    {
      id: 'w_adhkar',
      icon: '📿',
      title: 'الذاكر',
      desc: 'أتمّ أذكار الصباح أو المساء ٣ مرات',
      target: 3,
      unit: 'مرة',
      activity: 'adhkar',
      reward: 'ذكر الله راحة القلوب — الله يتقبل منك 🌿'
    },
    {
      id: 'w_streak',
      icon: '🔥',
      title: 'المُداوِم',
      desc: 'حافظ على ٧ أيام متتالية بلا انقطاع (الذين هم على صلاتهم دائمون)',
      target: 7,
      unit: 'يوم',
      activity: 'streak',
      reward: 'أحب الأعمال إلى الله أدومها وإن قل ✨'
    }
  ];

  /* ─── شارات الإنجاز الدائمة ──────────────────────── */
  const BADGE_DEFS = [
    { id: 'b_first_session',  icon: '🌱', title: 'الخطوة الأولى',   desc: 'بدأت أول جلسة حفظ',                     trigger: s => (s.sessions || 0) >= 1 },
    { id: 'b_streak_3',       icon: '🔥', title: 'ثلاثة متتالية',    desc: '٣ أيام متتالية بلا انقطاع',             trigger: s => (s.streak || 0) >= 3 },
    { id: 'b_streak_7',       icon: '⭐', title: 'أسبوع كامل',       desc: '٧ أيام متتالية بلا انقطاع',             trigger: s => (s.streak || 0) >= 7 },
    { id: 'b_streak_30',      icon: '👑', title: 'ثلاثون يومًا',     desc: '٣٠ يومًا متتالية — ما شاء الله!',       trigger: s => (s.streak || 0) >= 30 },
    { id: 'b_mem_10',         icon: '📖', title: 'عشر آيات',          desc: 'حفظت ١٠ آيات',                          trigger: s => (s.memorizedAyahs?.length || 0) >= 10 },
    { id: 'b_mem_50',         icon: '🌿', title: 'خمسون آية',         desc: 'حفظت ٥٠ آية',                          trigger: s => (s.memorizedAyahs?.length || 0) >= 50 },
    { id: 'b_mem_100',        icon: '💎', title: 'مئة آية',           desc: 'حفظت ١٠٠ آية',                         trigger: s => (s.memorizedAyahs?.length || 0) >= 100 },
    { id: 'b_surah_complete', icon: '✦',  title: 'سورة كاملة',        desc: 'أكملت حفظ سورة في مجرة الحفظ',          trigger: s => (s.hifz?.length || 0) >= 1 },
    { id: 'b_hifz_5',        icon: '🌙', title: 'خمس سور',           desc: 'حفظت ٥ سور في مجرة الحفظ',              trigger: s => (s.hifz?.length || 0) >= 5 },
    { id: 'b_sessions_10',   icon: '🎯', title: 'عشر جلسات',         desc: 'أكملت ١٠ جلسات حفظ',                    trigger: s => (s.sessions || 0) >= 10 },
    { id: 'b_sessions_50',   icon: '🏆', title: 'خمسون جلسة',        desc: 'أكملت ٥٠ جلسة حفظ — قمة التميز!',      trigger: s => (s.sessions || 0) >= 50 },
    { id: 'b_athar_7',       icon: '🌺', title: 'أسبوع من التدبر',   desc: 'سجّلت الأثر ٧ أيام متتالية',            trigger: s => _countConsecAthar(s) >= 7 }
  ];

  function _countConsecAthar(s) {
    if (!s?.activityLog) return 0;
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      if ((s.activityLog[key]?.athar || 0) > 0) count++; else break;
    }
    return count;
  }

  /* ─── حساب أسبوع التحديات (يبدأ من الاثنين) ──────── */
  function getWeekKey() {
    const d = new Date();
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day); // back to Monday
    const mon = new Date(d); mon.setDate(d.getDate() + diff);
    return mon.toISOString().slice(0, 10);
  }

  /* ─── قراءة/كتابة التخزين المحلي ───────────────── */
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
  }
  function saveStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
  }

  /* ─── تهيئة أسبوع جديد ──────────────────────────── */
  function ensureWeek(store) {
    const wk = getWeekKey();
    if (store.weekKey !== wk) {
      store.weekKey = wk;
      store.progress = {}; // reset weekly progress
      // اختر 3 تحديات عشوائية من القائمة بشكل ثابت للأسبوع
      const seed = wk.replace(/-/g, '') % WEEKLY_TEMPLATES.length;
      store.activeIds = [
        WEEKLY_TEMPLATES[seed % WEEKLY_TEMPLATES.length].id,
        WEEKLY_TEMPLATES[(seed + 2) % WEEKLY_TEMPLATES.length].id,
        WEEKLY_TEMPLATES[(seed + 4) % WEEKLY_TEMPLATES.length].id
      ];
    }
    if (!store.badges) store.badges = [];
    if (!store.progress) store.progress = {};
    if (!store.activeIds) store.activeIds = WEEKLY_TEMPLATES.slice(0, 3).map(t => t.id);
    return store;
  }

  /* ─── حساب تقدم التحدي من سجل النشاط ─────────── */
  function computeProgress(template, rafiqState) {
    const wk = getWeekKey();
    const mon = new Date(wk);
    let total = 0;

    if (template.activity === 'streak') {
      return rafiqState?.streak || 0;
    }
    if (template.activity === 'adhkar') {
      // نعتمد على حدث rafiq-adhkar-done المخزن
      const store = loadStore();
      return store.progress?.[template.id] || 0;
    }
    // للأنشطة المرتبطة بـ activityLog
    const log = rafiqState?.activityLog || {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      if (d > new Date()) break;
      const key = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      const dayData = log[key] || {};
      if (template.activity === 'mem')      total += dayData.mem || 0;
      if (template.activity === 'sessions') total += dayData.sessions || 0;
      if (template.activity === 'athar')    total += dayData.athar > 0 ? 1 : 0;
      if (template.activity === 'read')     total += dayData.read || 0;
    }
    return total;
  }

  /* ─── فحص وإطلاق شارات الإنجاز ─────────────────── */
  function checkBadges(store, rafiqState) {
    if (!rafiqState) return;
    let newBadge = false;
    for (const def of BADGE_DEFS) {
      if (store.badges.includes(def.id)) continue;
      if (def.trigger(rafiqState)) {
        store.badges.push(def.id);
        newBadge = true;
        // اعرض الشارة بشكل بصري
        showBadgeUnlock(def);
      }
    }
    if (newBadge) saveStore(store);
  }

  /* ─── عرض إشعار الشارة ──────────────────────────── */
  function showBadgeUnlock(def) {
    // Toast
    toast(`${def.icon} إنجاز جديد: ${def.title} — ${def.desc}`);
    // إطلاق حدث للـ galaxy orb
    document.dispatchEvent(new CustomEvent('rafiq-glow', { detail: { type: 'hifz' } }));
    // عرض بطاقة الشارة المنبثقة
    setTimeout(() => {
      const existing = document.getElementById('badgeUnlockPopup');
      if (existing) existing.remove();
      const popup = document.createElement('div');
      popup.id = 'badgeUnlockPopup';
      popup.className = 'badge-unlock-popup';
      popup.setAttribute('role', 'status');
      popup.setAttribute('aria-live', 'polite');
      popup.innerHTML = `
        <div class="badge-unlock-inner">
          <div class="badge-unlock-icon">${def.icon}</div>
          <div class="badge-unlock-body">
            <strong>🏅 إنجاز جديد مفتوح!</strong>
            <b>${def.title}</b>
            <span>${def.desc}</span>
          </div>
          <button class="badge-unlock-close" type="button" aria-label="إغلاق">✕</button>
        </div>
      `;
      popup.querySelector('.badge-unlock-close').onclick = () => popup.remove();
      document.body.appendChild(popup);
      setTimeout(() => popup.classList.add('show'), 50);
      setTimeout(() => { popup.classList.remove('show'); setTimeout(() => popup.remove(), 400); }, 5000);
    }, 600);
  }

  /* ─── تحديث progress عند إتمام الأذكار ─────────── */
  document.addEventListener('rafiq-adhkar-done', () => {
    const store = ensureWeek(loadStore());
    const id = 'w_adhkar';
    if (store.activeIds.includes(id)) {
      store.progress[id] = (store.progress[id] || 0) + 1;
      const tmpl = WEEKLY_TEMPLATES.find(t => t.id === id);
      if (tmpl && store.progress[id] >= tmpl.target && !store.progress[id + '_done']) {
        store.progress[id + '_done'] = true;
        toast(`${tmpl.icon} أتممت تحدي "${tmpl.title}" — ${tmpl.reward}`);
        document.dispatchEvent(new CustomEvent('rafiq-glow', { detail: { type: 'adhkar' } }));
      }
      saveStore(store);
      renderWidget();
    }
  });

  /* ─── الرندر الرئيسي لـ Widget ──────────────────── */
  function getRafiqState() {
    try {
      // نجرب نفس مفتاح app.js (rafiq-state-v85 وما يشابهه)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('rafiq-state-v')) {
          const v = JSON.parse(localStorage.getItem(k) || 'null');
          if (v && typeof v === 'object') return v;
        }
      }
    } catch {}
    return null;
  }

  function renderWidget() {
    const container = document.getElementById('challengesWidget');
    if (!container) return;

    const store = ensureWeek(loadStore());
    const rafiqState = getRafiqState();

    // فحص الشارات
    checkBadges(store, rafiqState);

    const activeChallenges = WEEKLY_TEMPLATES.filter(t => store.activeIds.includes(t.id));

    // عدد الشارات المكتسبة
    const badgeCount = store.badges.length;
    const earnedBadges = BADGE_DEFS.filter(d => store.badges.includes(d.id));

    const challengeCards = activeChallenges.map(tmpl => {
      const prog = computeProgress(tmpl, rafiqState);
      const done = prog >= tmpl.target;
      const pct = Math.min(100, Math.round(prog / tmpl.target * 100));
      // mark done in store
      if (done && !store.progress[tmpl.id + '_done']) {
        store.progress[tmpl.id + '_done'] = true;
        saveStore(store);
        toast(`${tmpl.icon} أتممت تحدي "${tmpl.title}" — ${tmpl.reward}`);
        document.dispatchEvent(new CustomEvent('rafiq-glow', { detail: { type: 'hifz' } }));
      }
      return `
        <div class="challenge-card ${done ? 'done' : ''}">
          <div class="challenge-icon">${tmpl.icon}</div>
          <div class="challenge-body">
            <strong class="challenge-title">${tmpl.title}${done ? ' <span class="challenge-check">✓</span>' : ''}</strong>
            <span class="challenge-desc">${tmpl.desc}</span>
            <div class="challenge-track">
              <div class="challenge-bar" style="width:${pct}%"></div>
            </div>
            <span class="challenge-prog">${Math.min(prog, tmpl.target)} / ${tmpl.target} ${tmpl.unit}</span>
          </div>
        </div>`;
    }).join('');

    // آخر 3 شارات مكتسبة
    const badgesHtml = earnedBadges.length
      ? `<div class="badges-row">${earnedBadges.slice(-6).map(d =>
          `<span class="badge-chip" title="${d.title}: ${d.desc}">${d.icon}</span>`
        ).join('')}${badgeCount > 6 ? `<span class="badge-chip more">+${badgeCount - 6}</span>` : ''}</div>`
      : `<div class="badges-empty">أكمل التحديات لفتح الشارات ✦</div>`;

    // حساب أيام الأسبوع المتبقية
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysLeft = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // أيام حتى نهاية الأسبوع (الأحد)

    container.innerHTML = `
      <div class="challenges-header">
        <div>
          <span class="eyebrow">تحديات الأسبوع</span>
          <h3>⚡ تحدياتك هذا الأسبوع</h3>
        </div>
        <span class="challenges-timer">${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} متبقية</span>
      </div>
      <div class="challenges-list">${challengeCards}</div>
      <div class="badges-section">
        <span class="badges-label">🏅 شاراتي (${badgeCount})</span>
        ${badgesHtml}
      </div>
    `;
  }

  /* ─── تهيئة وتسجيل الأحداث ──────────────────────── */
  function init() {
    // استمع للتغيرات في النشاط لإعادة رسم الـ widget
    document.addEventListener('rafiq-activity-change', () => { renderWidget(); });
    document.addEventListener('rafiq-home-refresh', () => { renderWidget(); });
    document.addEventListener('rafiq-hifz-updated', () => { renderWidget(); });
    document.addEventListener('rafiq-data-ready', () => {
      renderWidget();
      // فحص أولي للشارات عند بدء التطبيق
      const store = ensureWeek(loadStore());
      checkBadges(store, getRafiqState());
    });
    // رندر مبدئي
    setTimeout(renderWidget, 800);
  }

  // تصدير للاستخدام الخارجي
  window.RAFIQ_CHALLENGES = { render: renderWidget, getStore: loadStore, getBadges: () => BADGE_DEFS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
