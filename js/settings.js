(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const grid=$('#offlineStatusGrid');
  const last=$('#offlineLastUpdate');
  function mark(label,ok){return `<span class="offline-status-pill ${ok?'ok':'pending'}">${ok?'✓':'○'} ${label}</span>`}
  // Real state instead of a hard-coded false: count what the recitation cache actually holds.
  async function savedRecitations(){try{const c=await caches.open('rafiq-audio-v1');return (await c.keys()).length}catch{return 0}}
  async function refresh(){
    if(!grid)return;
    try{
      const cm=window.RAFIQ_CONTENT;
      const st=await cm?.offlineStatus?.();
      const audioCount=await savedRecitations();
      const study=st?.study||{};
      grid.innerHTML=[
        mark('القرآن الأساسي',!!st?.quran),
        mark('التفسير',!!study['2012']),
        mark('معاني الكلمات',!!study['2013']),
        mark('أسباب النزول',!!study['2919']),
        mark('التجويد',!!st?.tajweed),
        mark(audioCount?`التلاوات (${audioCount})`:'التلاوات',audioCount>0)
      ].join('');
      if(last)last.textContent=`آخر فحص: ${new Intl.DateTimeFormat('ar-EG',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(new Date())}`;
    }catch{
      grid.innerHTML='<span class="offline-status-pill pending">تعذر فحص الحالة الآن</span>';
    }
  }
  async function prepare(){
    const btn=$('#prepareOfflineCore');
    if(!navigator.onLine){refresh();window.rafiqToast?.('اتصل بالإنترنت مرة واحدة لتجهيز المواد العلمية كاملة.');return;}
    if(btn){btn.disabled=true;btn.textContent='⏳ تجهيز المواد العلمية…';}
    try{
      const result=await window.rafiqPrepareOfflineCore?.();
      await refresh();
      window.rafiqToast?.(result?.ready?'تم تجهيز رفيق للعمل أوفلاين ✅':'تم تجهيز ما أمكن؛ راجع الحالة لإكمال أي جزء ناقص.');
    }catch{
      window.rafiqToast?.('تعذر التجهيز الآن؛ سيظل المحتوى المتاح محليًا يعمل بشكل طبيعي.');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='⚡ تجهيز المواد العلمية أوفلاين';}
    }
  }
  $('#prepareOfflineCore')?.addEventListener('click',prepare);
  $('#refreshOfflineStatus')?.addEventListener('click',refresh);
  document.addEventListener('rafiq-data-ready',refresh,{once:false});
  addEventListener('online',refresh);
  setTimeout(refresh,1200);
})();
