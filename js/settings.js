(function(){
 const sel=document.getElementById('settingsReciterSelect'); if(!sel)return;
 const list=Array.isArray(window.RAFIQ_RECITERS)?window.RAFIQ_RECITERS:[];
 sel.innerHTML='<option value="">اختر القارئ</option>'+list.map(r=>`<option value="${r.folder}">${r.name} · ${r.quality}</option>`).join('');
 try{const cur=JSON.parse(localStorage.getItem('rafiq-state-v85')||'{}');sel.value=cur?.prefs?.reciter||''}catch{}
 sel.addEventListener('change',()=>{window.setRafiqReciter?.(sel.value||null);window.rafiqToast?.(sel.value?'تم تثبيت القارئ المفضل ✅':'تمت إزالة التثبيت');});
})();
