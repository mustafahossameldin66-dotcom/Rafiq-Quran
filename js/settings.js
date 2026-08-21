(function(){
 const sel=document.getElementById('settingsReciterSelect'); if(!sel)return;
 const fill=()=>{
   const list=Array.isArray(window.RAFIQ_RECITERS)?window.RAFIQ_RECITERS:[];
   sel.innerHTML='<option value="">اختر القارئ</option>'+list.map(r=>`<option value="${r.folder}">${r.name} · ${r.quality}</option>`).join('');
   const current=window.RAFIQ_API?.state?.prefs?.reciter||'';
   sel.value=current;
 };
 fill();
 sel.addEventListener('change',()=>{
   const ok=window.setRafiqReciter?.(sel.value||null);
   window.rafiqToast?.(ok&&sel.value?'تم تثبيت القارئ المفضل ✅':(ok===false?'القارئ غير متاح':'تمت إزالة التثبيت'));
 });
 window.addEventListener('rafiq-data-ready',fill);
})();
