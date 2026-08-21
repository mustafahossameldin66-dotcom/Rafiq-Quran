/* Rafiq Study Bridge — the visible study UI lives inside the premium mushaf. */
(function(){
  'use strict';
  const open = (surah, ayah)=>{
    if(window.RAFIQ_MUSHAF?.openStudy){ window.RAFIQ_MUSHAF.openStudy(Number(surah)||1, Number(ayah)||1); return; }
    if(typeof window.rafiqToast==='function') window.rafiqToast('دراسة الآية ستتوفر بعد تجهيز المصحف.');
  };
  window.openAyahStudy=open;
  window.closeRafiqStudyModal=()=>{};
})();
