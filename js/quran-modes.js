/* =====================================================
   رفيق القرآن — نظام الأمودة (العادي الفاخر / البساطة والتركيز)
   App Modes: Normal (Majestic & Deep) / Simple (Pure Quran Focus)
   ===================================================== */
(function () {
  'use strict';

  const STORE_KEY = 'rafiq-app-mode';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function applyMode(mode) {
    const validModes = ['normal', 'simple'];
    const finalMode = validModes.includes(mode) ? mode : 'normal';
    document.body.dataset.mode = finalMode;
    try {
      localStorage.setItem(STORE_KEY, finalMode);
    } catch {}

    // تحديث الأزرار
    $$('[data-mode-select]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modeSelect === finalMode);
    });

    // إشعار
    const modeNames = {
      normal: 'المود الفاخر المهيب ✦',
      simple: 'مود البساطة والتركيز 🕌'
    };
    if (window.rafiqToast) {
      window.rafiqToast(`تم تفعيل: ${modeNames[finalMode]}`);
    }
  }

  function initMode() {
    let saved = 'normal';
    try {
      saved = localStorage.getItem(STORE_KEY) || 'normal';
      if (saved === 'kids') saved = 'normal'; // ترقية نظيفة لمن كان لديه مود أطفال
    } catch {}
    document.body.dataset.mode = saved;

    // استماع للأزرار
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-mode-select]');
      if (btn) {
        e.preventDefault();
        applyMode(btn.dataset.modeSelect);
      }
    });
  }

  window.RAFIQ_MODES = {
    apply: applyMode,
    get: () => document.body.dataset.mode || 'normal'
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMode);
  } else {
    initMode();
  }
})();
