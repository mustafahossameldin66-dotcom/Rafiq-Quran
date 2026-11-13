/* ═══════════════════════════════════════════════════════════════════════════════
   AYAH-ACTIONS-UI — ترتيب أزرار كل آية
   • 3 أزرار أساسية ظاهرة: استماع · تفسير · مشاركة
   • الباقي (دراسة · حفظ الموضع · تسميع · فاصلة · رابط) جوه قائمة «⋯» منسدلة
   • الأزرار نفسها بتتنقل (مش بتتنسخ) فكل الـ handlers الأصلية شغالة زي ما هي
   • أكتر من ملف بيضيف أزرار بعد الرسم، فالترتيب بيتعاد بهدوء كل ما يتضاف زرار جديد
   ═══════════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const PRIMARY = ['[data-play]', '.quick-tafsir-trigger-btn', '[data-share]'];
  const primarySel = PRIMARY.join(',');
  let open = null; // { toggle, menu }

  const closeMenu = () => {
    if (!open) return;
    open.menu.hidden = true;
    open.menu.classList.remove('up');
    open.menu.style.transform = '';
    open.toggle.setAttribute('aria-expanded', 'false');
    open.card?.classList.remove('menu-open');
    open = null;
  };

  // The menu is absolutely positioned inside its card (the card gets raised above its neighbours
  // while open). We only nudge it: flip upward near the bottom edge, shift sideways to stay on screen.
  const place = (toggle, menu) => {
    menu.hidden = false;
    menu.classList.remove('up');
    menu.style.transform = '';
    let r = menu.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8 && toggle.getBoundingClientRect().top - r.height - 8 >= 8) {
      menu.classList.add('up');
      r = menu.getBoundingClientRect();
    }
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    if (dx) menu.style.transform = `translateX(${Math.round(dx)}px)`;
  };

  const buildMore = () => {
    const wrap = document.createElement('div');
    wrap.className = 'ayah-more';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ayah-action-btn ayah-more-toggle';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'المزيد من الخيارات');
    toggle.title = 'المزيد';
    toggle.innerHTML = '<span class="ayah-ico" data-ico="more"></span>';
    const menu = document.createElement('div');
    menu.className = 'ayah-more-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (open && open.toggle === toggle) { closeMenu(); return; }
      closeMenu();
      const card = toggle.closest('.mushaf-ayah');
      card?.classList.add('menu-open');
      place(toggle, menu);
      toggle.setAttribute('aria-expanded', 'true');
      open = { toggle, menu, card };
    });
    menu.addEventListener('click', () => setTimeout(closeMenu, 0));  // after the item's own action ran
    wrap.append(toggle, menu);
    return { wrap, menu };
  };

  // Idempotent: safe to run again whenever another script adds a button late.
  const layout = (actions) => {
    const all = [...actions.querySelectorAll('button.ayah-action-btn')]
      .filter((b) => !b.classList.contains('ayah-more-toggle'));
    if (!all.length) return;
    const stray = all.some((b) =>
      (b.parentElement === actions && !b.classList.contains('ayah-primary')) ||
      (b.matches(primarySel) && !b.classList.contains('ayah-primary')));
    if (actions.dataset.organized === '1' && !stray) return;

    const primary = PRIMARY.map((sel) => all.find((b) => b.matches(sel))).filter(Boolean);
    if (!primary.length) return;                         // renderer hasn't finished yet
    const secondary = all.filter((b) => !primary.includes(b));

    actions.querySelector('.ayah-more')?.remove();
    const frag = document.createDocumentFragment();
    primary.forEach((b) => {
      b.classList.add('ayah-primary');
      b.classList.remove('ayah-menu-item');
      b.classList.toggle('is-lead', b.matches('[data-play]'));
      frag.appendChild(b);
    });
    if (secondary.length) {
      const { wrap, menu } = buildMore();
      secondary.forEach((b) => {
        b.classList.add('ayah-menu-item');
        b.classList.remove('ayah-primary', 'is-lead');
        b.setAttribute('role', 'menuitem');
        menu.appendChild(b);
      });
      frag.appendChild(wrap);
    }
    actions.appendChild(frag);
    actions.dataset.organized = '1';
  };

  let timer = 0;
  const organizeAll = (box) => {
    clearTimeout(timer);
    timer = setTimeout(() => box.querySelectorAll('.mushaf-ayah-actions').forEach(layout), 40);
  };

  const init = () => {
    const box = document.getElementById('mushafVerses');
    if (!box) return false;
    new MutationObserver(() => organizeAll(box)).observe(box, { childList: true, subtree: true });
    organizeAll(box);
    return true;
  };

  document.addEventListener('click', (e) => {
    if (open && !open.menu.contains(e.target) && !open.toggle.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', closeMenu, { passive: true });
  window.addEventListener('scroll', closeMenu, { passive: true, capture: true });

  let tries = 0;
  const boot = () => { if (!init() && ++tries < 40) setTimeout(boot, 150); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
