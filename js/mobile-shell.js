(() => {
  'use strict';
  const root=document.documentElement;
  const body=document.body;
  const sheet=document.getElementById('mobileMoreSheet');
  const openBtn=document.getElementById('mobileMoreBtn');
  const closeBtn=document.getElementById('mobileMoreClose');
  const setScrollLocked=(locked)=>{
    if(locked){ body.classList.add('mobile-more-open'); return; }
    body.classList.remove('mobile-more-open','reader-lock');
    root.classList.remove('mobile-more-open','reader-lock');
    root.style.removeProperty('overflow-y');
    body.style.removeProperty('overflow-y');
  };
  const close=()=>{
    if(!sheet)return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden','true');
    openBtn?.setAttribute('aria-expanded','false');
    setScrollLocked(false);
  };
  const open=()=>{
    if(!sheet)return;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden','false');
    openBtn?.setAttribute('aria-expanded','true');
    setScrollLocked(true);
    closeBtn?.focus({preventScroll:true});
  };
  if(sheet&&openBtn){
    sheet.setAttribute('aria-hidden','true');
    openBtn.addEventListener('click',open);
    closeBtn?.addEventListener('click',close);
    sheet.querySelector('.mobile-more-backdrop')?.addEventListener('click',close);
    sheet.querySelectorAll('[data-mobile-view]').forEach(btn=>btn.addEventListener('click',()=>{
      const target=document.querySelector(`#sideNav [data-view=\"${CSS.escape(btn.dataset.mobileView)}\"]`);
      target?.click();
      close();
    }));
    document.getElementById('mobileMethodBtn')?.addEventListener('click',()=>{
      document.getElementById('methodBtn')?.click();
      close();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet.classList.contains('is-open'))close();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
    window.addEventListener('pageshow',()=>setScrollLocked(false));
  }
  // Mobile shell owns the document scroll contract. Nested surfaces may scroll themselves.
  root.style.overflowY='auto';
  body.style.overflowY='auto';
})();
