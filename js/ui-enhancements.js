/* =====================================================
   رفيق القرآن – UI Enhancements JS
   Theme · FontSize · Search · CopyLink · Export/Import
   RandomAyah · ProgressDashboard · ViewTransitions
   ===================================================== */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const store=(k,v)=>{ try{ if(v===undefined)return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k,JSON.stringify(v)); }catch{} };

  /* ── 1. THEME TOGGLE (المظهر الليلي الفاخر الموحد) ────── */
  function applyTheme(theme){
    document.body.dataset.theme = 'dark';
    try { localStorage.removeItem('rq-theme'); } catch {}
  }
  function initTheme(){
    document.body.classList.remove('light');
    document.body.dataset.theme = 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#071a14');
    try { localStorage.removeItem('rq-theme'); localStorage.removeItem('theme'); } catch {}
  }

  /* ── 2. FONT-SIZE SLIDER ─────────────────────────── */
  function initFontSize(){
    const slider = $('#fontSizeSlider');
    const label  = $('#fontSizeLabel');
    if(!slider) return;
    const saved = store('rq-font-size') || 32;
    slider.value = saved;
    document.documentElement.style.setProperty('--ayah-font-size', saved+'px');
    if(label) label.textContent = saved+'px';
    slider.addEventListener('input', ()=>{
      const v = Number(slider.value);
      document.documentElement.style.setProperty('--ayah-font-size', v+'px');
      store('rq-font-size', v);
      if(label) label.textContent = v+'px';
    });
  }

  /* ── 3. AYAH SEARCH ──────────────────────────────── */
  function initAyahSearch(){
    const input = $('#ayahSearchInput');
    if(!input) return;
    input.addEventListener('input', ()=>{
      const q = input.value.trim();
      const ayahs = $$('.mushaf-ayah');
      if(!q){ ayahs.forEach(a=>{ a.classList.remove('search-hidden','search-match'); const t=a.querySelector('.mushaf-ayah-text'); if(t) t.innerHTML=t.textContent; }); return; }
      ayahs.forEach(el=>{
        const textEl = el.querySelector('.mushaf-ayah-text');
        if(!textEl) return;
        const raw = textEl.textContent;
        if(raw.includes(q)){
          el.classList.remove('search-hidden');
          el.classList.add('search-match');
          textEl.innerHTML = raw.replace(new RegExp(q,'g'), m=>`<mark>${m}</mark>`);
        } else {
          el.classList.add('search-hidden');
          el.classList.remove('search-match');
        }
      });
    });
  }

  /* ── 4. COPY‑LINK (per ayah via delegation) ─────── */
  function copyAyahLink(surahNo, ayahNo){
    const url = location.origin + location.pathname + `?s=${surahNo}&a=${ayahNo}`;
    navigator.clipboard.writeText(url)
      .then(()=> window.rafiqToast?.('تم نسخ رابط الآية ✅'))
      .catch(()=> window.rafiqToast?.('تعذر النسخ'));
  }
  // Delegation: listens on the mushaf verses container
  document.addEventListener('click', e=>{
    const btn = e.target.closest('[data-copylink]');
    if(!btn) return;
    const ayah = btn.dataset.copylink;
    // try to get surah number from state
    const state = (()=>{ try{ return JSON.parse(localStorage.getItem('rafiq-mushaf-state-v4')||'{}') }catch{return{}} })();
    copyAyahLink(state.surah||1, ayah);
  });

  /* ── 5. EXPORT / IMPORT PLAN ─────────────────────── */
  function exportPlan(){
    try{
      const keys = ['rafiq-plan-v3','rafiq-mem-v7','rafiq-prefs-v3','rafiq-mushaf-state-v4'];
      const data = {};
      keys.forEach(k=>{ const v=localStorage.getItem(k); if(v) data[k]=JSON.parse(v); });
      const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rafiq-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      window.rafiqToast?.('تم تصدير البيانات ✅');
    }catch{ window.rafiqToast?.('تعذر التصدير'); }
  }
  function importPlan(){
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = ()=>{
      const file = input.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = e=>{
        try{
          const data = JSON.parse(e.target.result);
          Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));
          window.rafiqToast?.('تم استيراد البيانات، ستُطبَّق عند التحديث ✅');
        }catch{ window.rafiqToast?.('الملف غير صالح'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  $('#exportPlanBtn')?.addEventListener('click', exportPlan);
  $('#importPlanBtn')?.addEventListener('click', importPlan);

  /* ── 6. RANDOM AYAH ──────────────────────────────── */
  async function goRandomAyah(){
    const quran = window.RAFIQ_API?.quran || window.RAFIQ_QURAN || [];
    if(!quran.length) return window.rafiqToast?.('بيانات المصحف لم تُحمَّل بعد');
    const su = quran[Math.floor(Math.random()*quran.length)];
    const v  = su.verses[Math.floor(Math.random()*su.verses.length)];
    if(typeof window.openAyahStudy === 'function') window.openAyahStudy(su.s, v.a);
    else window.rafiqToast?.(`${su.name} · الآية ${v.a}`);
  }
  $('#randomAyahBtn')?.addEventListener('click', goRandomAyah);

  /* ── 7. PROGRESS DASHBOARD ───────────────────────── */
  function renderProgressDashboard(){
    const box = $('#progressDashboard');
    if(!box) return;
    // pull stats from localStorage
    let mem={}, plan={};
    try{ mem=JSON.parse(localStorage.getItem('rafiq-mem-v7')||'{}') }catch{}
    try{ plan=JSON.parse(localStorage.getItem('rafiq-plan-v3')||'{}') }catch{}
    const learned  = Object.values(mem.surahs||{}).filter(Boolean).length;
    const streak   = mem.streak || 0;
    const sessions = mem.sessions || 0;
    const total    = 114;
    const pct      = Math.round((learned/total)*100);
    const r = 54, circ = 2*Math.PI*r;
    const offset = circ - (pct/100)*circ;
    box.innerHTML = `
      <h3>📊 تقدمك في الحفظ</h3>
      <div class="prog-stat-row">
        <div class="prog-stat"><b>${learned}</b><small>سورة محفوظة</small></div>
        <div class="prog-stat"><b>${total-learned}</b><small>سورة متبقية</small></div>
        <div class="prog-stat"><b>${streak}</b><small>يوم متتالي</small></div>
        <div class="prog-stat"><b>${sessions}</b><small>جلسات مكتملة</small></div>
      </div>
      <div class="prog-ring-wrap">
        <svg width="130" height="130" class="prog-ring">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#38df9f"/>
              <stop offset="100%" stop-color="#d4af37"/>
            </linearGradient>
          </defs>
          <circle class="prog-ring-track" cx="65" cy="65" r="${r}"/>
          <circle class="prog-ring-fill"  cx="65" cy="65" r="${r}"
            stroke-dasharray="${circ}"
            stroke-dashoffset="${offset}"/>
          <text x="65" y="60" text-anchor="middle" fill="#f6faf7" font-size="22" font-weight="800" font-family="Tajawal">${pct}%</text>
          <text x="65" y="78" text-anchor="middle" fill="#8aaa98" font-size="11" font-family="Tajawal">من المصحف</text>
        </svg>
      </div>`;
  }

  /* ── 8. VIEW TRANSITIONS ─────────────────────────── */
  function initViewTransitions(){
    // ensure initial active view fades in
    $$('.view.active').forEach(v=>{ v.style.opacity=0; requestAnimationFrame(()=>{ v.style.opacity=''; }); });
    // watch for view switches via MutationObserver
    const observer = new MutationObserver(mutations=>{
      mutations.forEach(m=>{
        if(m.type==='attributes' && m.attributeName==='class'){
          const el = m.target;
          if(el.classList.contains('active') && el.classList.contains('view')){
            el.style.opacity=0; el.style.transform='translateY(8px)';
            requestAnimationFrame(()=>{ el.style.opacity=''; el.style.transform=''; });
          }
        }
      });
    });
    $$('.view').forEach(v=>observer.observe(v,{attributes:true}));
  }

  /* ── 9. INJECT COPY‑LINK BUTTON INTO AYAH CARDS ──── */
  // We hook into the custom event that mushaf-premium fires after render
  function patchRenderSurah(){
    const box = document.querySelector('#mushafVerses');
    if(!box) return;
    const patchCards = ()=>{
      box.querySelectorAll('.mushaf-ayah-actions').forEach(actions=>{
        if(actions.querySelector('[data-copylink]')) return; // already patched
        const ayahNo = actions.closest('.mushaf-ayah')?.dataset?.ayah;
        if(!ayahNo) return;
        const btn = document.createElement('button');
        btn.type='button';
        btn.className='ayah-action-btn';
        btn.dataset.copylink = ayahNo;
        btn.title = 'نسخ رابط الآية';
        btn.innerHTML='<span class="ayah-ico" data-ico="link"></span> رابط';
        actions.appendChild(btn);
      });
    };
    // patch whenever DOM inside #mushafVerses changes
    new MutationObserver(patchCards).observe(box, {childList:true, subtree:false});
    patchCards();
  }

  /* ── 10. NOTIFICATION BANNER HELPER ─────────────── */
  window.rqShowBanner = function(msg, duration=5000){
    let banner = $('#rqNotifBanner');
    if(!banner){
      banner = document.createElement('div');
      banner.id = 'rqNotifBanner';
      document.querySelector('.main')?.prepend(banner);
    }
    banner.textContent = msg;
    banner.classList.add('visible');
    if(duration) setTimeout(()=>banner.classList.remove('visible'), duration);
  };

  /* ── 11. مجرة النور القرآني (Mini Glowing Galaxy Orb) ── */
  function updateGalaxyOrb(){
    const orb = $('#topbarGalaxyOrb');
    if(!orb) return;
    const appState = (()=>{ try{ return JSON.parse(localStorage.getItem('rafiq-state-v4')||'{}') }catch{ return {} } })();
    const hifz = appState.hifz || store('rafiq-hifz') || [];
    const count = Array.isArray(hifz) ? hifz.length : 0;
    const badge = $('#galaxyOrbBadge');
    if(badge) badge.textContent = `${count} ✦`;
  }

  function triggerGalaxyGlow(type, message){
    const orb = $('#topbarGalaxyOrb');
    if(!orb) return;
    orb.classList.remove('glow-adhkar', 'glow-hifz', 'glow-ward');
    void orb.offsetWidth;
    orb.classList.add(type === 'adhkar' ? 'glow-adhkar' : type === 'hifz' ? 'glow-hifz' : 'glow-ward');
    setTimeout(() => orb.classList.remove('glow-adhkar', 'glow-hifz', 'glow-ward'), 2400);

    if (message) {
      window.rafiqToast?.(message);
    }
  }

  function initGalaxyOrb(){
    const orb = $('#topbarGalaxyOrb');
    if(!orb) return;
    updateGalaxyOrb();

    orb.addEventListener('click', () => {
      if (typeof window.RAFIQ_GO === 'function') {
        window.RAFIQ_GO('galaxy');
      } else {
        const galaxyBtn = document.querySelector('[data-view="galaxy"]');
        if (galaxyBtn) galaxyBtn.click();
      }
    });

    window.addEventListener('rafiq-glow', (e) => {
      triggerGalaxyGlow(e.detail?.type || 'hifz', e.detail?.msg);
      updateGalaxyOrb();
    });

    document.addEventListener('rafiq-hifz-updated', updateGalaxyOrb);
  }

  /* ── BOOT ────────────────────────────────────────── */
  function boot(){
    initTheme();
    initFontSize();
    initAyahSearch();
    initViewTransitions();
    renderProgressDashboard();
    patchRenderSurah();
    initGalaxyOrb();
    // re-render dashboard whenever data updates
    document.addEventListener('rafiq-data-ready', renderProgressDashboard);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
