(() => {
  'use strict';
  const sheet = document.getElementById('mobileMoreSheet');
  const openBtn = document.getElementById('mobileMoreBtn');
  const closeBtn = document.getElementById('mobileMoreClose');
  if (!sheet || !openBtn) return;

  const setOpen = (open) => {
    sheet.classList.toggle('is-open', open);
    sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('mobile-more-open', open);
    if (open) closeBtn?.focus(); else openBtn.focus();
  };

  const goView = (view) => {
    const target = document.querySelector(`#sideNav [data-view="${CSS.escape(view)}"]`);
    target?.click();
    setOpen(false);
  };

  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn?.addEventListener('click', () => setOpen(false));
  sheet.querySelector('.mobile-more-backdrop')?.addEventListener('click', () => setOpen(false));
  sheet.querySelectorAll('[data-mobile-view]').forEach(btn => {
    btn.addEventListener('click', () => goView(btn.dataset.mobileView));
  });

  const method = document.getElementById('mobileMethodBtn');
  method?.addEventListener('click', () => {
    document.getElementById('methodBtn')?.click();
    setOpen(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) setOpen(false);
  });

  document.addEventListener('click', e => {
    const viewBtn = e.target.closest('[data-view]');
    if (!viewBtn || !viewBtn.closest('#sideNav')) return;
    setTimeout(() => {
      if (sheet.classList.contains('is-open')) setOpen(false);
    }, 0);
  });
})();
