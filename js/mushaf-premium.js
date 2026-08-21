(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const toast=msg=>typeof window.rafiqToast==='function'?window.rafiqToast(msg):null;
  const storageKey='rafiq-mushaf-state-v3';
  const state=(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{return{}}})();
  let quran=[];
  let surahNo=Number(state.surah||1)||1;
  let selectedAyah=Number(state.ayah||0)||0;
  let studyTab='overview';
  let selectedChar=null;
  const QP='https://api.quranpedia.net/v1';
  const QP_WEB='https://quranpedia.net';
  const WAHIDI_BOOK=242;
  const cacheDbName='rafiq-quran-cache-v2';
  const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(cacheDbName,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('content'))db.createObjectStore('content')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  async function cacheGet(key){try{const db=await openDb();return await new Promise((res,rej)=>{const t=db.transaction('content','readonly');const g=t.objectStore('content').get(key);g.onsuccess=()=>res(g.result??null);g.onerror=()=>rej(g.error)})}catch{return null}}
  async function cachePut(key,value){try{const db=await openDb();await new Promise((res,rej)=>{const t=db.transaction('content','readwrite');const p=t.objectStore('content').put(value,key);p.onsuccess=()=>res();p.onerror=()=>rej(p.error)})}catch{}}
  function savePosition(){try{localStorage.setItem(storageKey,JSON.stringify({surah:surahNo,ayah:selectedAyah}))}catch{}}
  function currentSurah(){return quran.find(s=>Number(s.s)===surahNo)||quran[0]}
  function setStatus(msg,show){const el=$('#mushafLoading');if(el){el.textContent=msg||'';el.hidden=!show}}
  const QF_TAJWEED='https://api.quran.com/api/v4/quran/verses/uthmani_tajweed';
  const AQC_TAJWEED='https://api.alquran.cloud/v1/ayah';
  const TAJWEED_RULES={
    ham_wasl:['همزة الوصل','تُثبت في الابتداء وتسقط في الوصل.'],
    silent:['حرف ساكن / علامة صامتة','علامة أداء صامتة بحسب ضبط المصحف.'],
    laam_shamsiyah:['لام شمسية','اللام الشمسية المدغمة في الحرف الذي بعدها.'],
    madda_normal:['مد طبيعي / عادي','مقداره الأصلي حركتان عند توفر شروط المد الطبيعي.'],
    madda_permissible:['مد جائز','المد الذي تتغير فيه مقدار الحركة بحسب نوعه ووجه القراءة المعتبر.'],
    madda_obligatory:['مد واجب','مد لازم الاتباع بحسب موضع الهمز في الكلمة.'],
    madda_necessary:['مد لازم','يمد ست حركات في الموضع الذي صنّف بهذه العلامة.'],
    qalqalah:['قلقلة','اضطراب صوت الحرف من حروف قطب جد عند السكون وفق موضعه.'],
    ghunnah:['غنة','غنة ملازمة لموضع الحكم كما في التجويد المعلَّم في المصدر.'],
    idgham_ghunnah:['إدغام بغنة','إدغام النون الساكنة أو التنوين فيما يندرج تحت هذا الحكم مع الغنة.'],
    idgham_wo_ghunnah:['إدغام بغير غنة','إدغام النون الساكنة أو التنوين فيما يندرج تحت الحكم بلا غنة.'],
    idgham_no_ghunnah:['إدغام بغير غنة','إدغام النون الساكنة أو التنوين فيما يندرج تحت الحكم بلا غنة.'],
    ikhfa:['إخفاء','النطق بين الإظهار والإدغام مع الغنة في موضع الحكم.'],
    ikhfa_shafawi:['إخفاء شفوي','إخفاء الميم الساكنة عند الباء مع الغنة.'],
    iqlab:['إقلاب','قلب النون الساكنة أو التنوين ميمًا مخفاة عند الباء مع الغنة.'],
    idgham_shafawi:['إدغام شفوي','إدغام الميم الساكنة في الميم مع الغنة.'],
    idgham_mutajanisayn:['إدغام متجانسين','إدغام حرفين متجانسين في الموضع الذي عُلِّم في المصدر.'],
    idgham_mutaqaribayn:['إدغام متقاربين','إدغام حرفين متقاربين في الموضع الذي عُلِّم في المصدر.']
  };
  const tajInfo=(cls)=>TAJWEED_RULES[cls]||['حكم تجويدي','حكم ملوّن مصدره نص التجويد المعلَّم من المصدر المرجعي.'];
  const openSource=(s,a,type)=>`${QP_WEB}/embed?surah=${Number(s)}&ayah=${Number(a)}&type=${encodeURIComponent(type)}`;
  function sourceLinks(s,a){return `<div class="source-badges"><a href="${openSource(s,a,'tafsir')}" target="_blank" rel="noopener noreferrer">📖 المصدر في Quranpedia</a><a href="${QP_WEB}/book/242" target="_blank" rel="noopener noreferrer">📚 أسباب النزول للواحدي · Quranpedia</a></div>`}
  async function fetchWithTimeout(url,ms=10000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{cache:'no-store',signal:c.signal})}finally{clearTimeout(t)}}
  function sanitizeTajweedHtml(raw){
    const doc=new DOMParser().parseFromString(String(raw||''),'text/html');
    doc.querySelectorAll('script,style,img,iframe,video,audio,object,embed,canvas,picture,.end').forEach(x=>x.remove());
    doc.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(a=>{if(!['class'].includes(a.name.toLowerCase()))el.removeAttribute(a.name)});
      if(el.tagName.toLowerCase()==='tajweed'){
        const cls=(el.getAttribute('class')||'').trim().split(/\s+/)[0];
        el.setAttribute('class',cls.replace(/[^a-z0-9_]/gi,''));
      }
    });
    return doc.body.innerHTML.trim();
  }
  async function getAuthoritativeTajweed(s,a){
    const key=`tajweed-auth:${s}:${a}`;
    const cached=await cacheGet(key);
    const verseKey=encodeURIComponent(`${s}:${a}`);
    if(navigator.onLine){
      try{
        const r=await fetchWithTimeout(`${QF_TAJWEED}?verse_key=${verseKey}`);
        if(r.ok){const j=await r.json();const raw=j?.verses?.[0]?.text_uthmani_tajweed;if(raw){const html=sanitizeTajweedHtml(raw);if(html){await cachePut(key,{html,source:'Quran Foundation / Quran.com',at:Date.now()});return {html,source:'Quran Foundation / Quran.com'}}}}
      }catch{}
      try{
        const r=await fetchWithTimeout(`${AQC_TAJWEED}/${s}:${a}/ar.tajweed`);
        if(r.ok){const j=await r.json();const raw=j?.data?.text||j?.data?.ayah?.text;if(raw){const html=sanitizeTajweedHtml(raw);if(html){await cachePut(key,{html,source:'Al Quran Cloud',at:Date.now()});return {html,source:'Al Quran Cloud'}}}}
      }catch{}
    }
    return cached||null;
  }
  function normalizeClassFromElement(el){return (el.getAttribute('class')||'').trim().split(/\s+/)[0]||''}
  function renderAuthoritativeTajweed(box,data,v){
    box.innerHTML=`<div class="mushaf-note">🎙️ التجويد هنا لا يُستنتج بقواعد تقريبية؛ يُعرض من نص تجويد مُعلَّم من مصدر خارجي موثوق، مع بديل موثوق ثانٍ عند الحاجة.</div><div class="ayah-tajweed-text">${data.html}</div><div class="ayah-taj-source">المصدر: ${esc(data.source)}</div><div id="tajInspector" class="taj-inspector"><b>اضغط على الحكم الملوّن</b><p>سيظهر اسم الحكم وشرح موجز من خريطة الأحكام المرتبطة بوسم المصدر.</p></div>`;
    const els=box.querySelectorAll('tajweed[class]');
    els.forEach(el=>el.addEventListener('click',()=>{els.forEach(x=>x.classList.remove('selected'));el.classList.add('selected');const cls=normalizeClassFromElement(el),info=tajInfo(cls);const ins=$('#tajInspector');if(ins)ins.innerHTML=`<b>${esc(info[0])}</b><p>${esc(info[1])}</p><small>الوسم المصدر: ${esc(cls)}</small>`;}));
  }
  function renderIndex(){const box=$('#mushafSurahList');if(!box)return;const query=($('#mushafSearch')?.value||'').trim();const list=quran.filter(s=>!query||String(s.s)===query||String(s.name).includes(query));box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count} آيات</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';box.querySelectorAll('[data-sura]').forEach(btn=>btn.onclick=()=>{surahNo=Number(btn.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)})}
  function renderSurah(scroll=false){const s=currentSurah();if(!s)return;$('#mushafSurahTitle').textContent=s.name;$('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;const verseBox=$('#mushafVerses');verseBox.innerHTML=s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a} · رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button type="button" class="action info" data-study="${v.a}">📖 دراسة الآية</button><button type="button" class="action" data-play="${v.a}">🔊 استماع</button><button type="button" class="action" data-mark="${v.a}">${Number(v.a)===selectedAyah?'📌 محددة':'📍 تحديد'}</button></div></article>`).join('');verseBox.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));verseBox.querySelectorAll('.mushaf-ayah-text').forEach(el=>{el.onclick=()=>openStudy(s.s,Number(el.closest('.mushaf-ayah').dataset.ayah));el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}}});verseBox.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{selectedAyah=Number(b.dataset.mark);savePosition();renderSurah();toast(`تم تحديد ${s.name} · الآية ${selectedAyah}`)});verseBox.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));$('#mushafPrev').disabled=s.s<=1;$('#mushafNext').disabled=s.s>=114;if(scroll)window.scrollTo({top:0,behavior:'smooth'})}
  function renderStudyShell(s,v){const panel=$('#ayahStudyPanel');if(!panel)return;panel.hidden=false;panel.innerHTML=`<div class="ayah-study-head"><div><div class="ayah-study-kicker">أدوات الآية</div><h3>📖 ${esc(s.name)} · الآية ${v.a}</h3><p>${esc(v.text)}</p></div><div class="ayah-study-head-actions"><button type="button" class="action info" id="studyListenBtn">🔊 استماع للتلاوة</button><button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button></div></div><div class="ayah-study-tabs" role="tablist"><button type="button" class="ayah-study-tab active" data-tab="overview">نظرة عامة</button><button type="button" class="ayah-study-tab" data-tab="tafsir">📖 التفسير</button><button type="button" class="ayah-study-tab" data-tab="meanings">🔎 معاني الكلمات</button><button type="button" class="ayah-study-tab" data-tab="tajweed">🎙️ التجويد</button><button type="button" class="ayah-study-tab" data-tab="asbab">🕊️ سبب النزول</button></div><div id="ayahStudyInner"></div>`;$('#closeMushafStudy').onclick=()=>{panel.hidden=true;selectedAyah=0;savePosition();renderSurah()};$('#studyListenBtn').onclick=()=>playAyah(s.s,v.a);panel.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panel.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x===b));renderStudyBody(s,v)});renderStudyBody(s,v);panel.scrollIntoView({behavior:'smooth',block:'start'})}
  function loading(box){box.innerHTML='<div class="mushaf-note">جارٍ جلب المادة العلمية… إذا انقطع الإنترنت سيُعرض آخر محتوى محفوظ لهذه الآية.</div><div class="study-skeleton"><i></i><i></i><i></i></div>'}
  async function qpFragment(s,a,type){const key=`qpf:${type}:${s}:${a}`;const cached=await cacheGet(key);try{if(navigator.onLine){const u=`${QP_WEB}/embed?surah=${s}&ayah=${a}&type=${type}&fragment=1`;const r=await fetch(u,{cache:'no-store'});if(r.ok){const html=await r.text();await cachePut(key,{html,at:Date.now()});return html}}}catch{}return cached?.html||null}
  async function qpTafsir(s,a){const key=`qpt:${s}:${a}`;const cached=await cacheGet(key);try{if(navigator.onLine){const books=await (await fetch(`${QP}/surah/tafsirs/${s}`,{cache:'no-store'})).json();const preferred=(Array.isArray(books)?books:[]).find(x=>/الميسر|السعدي|ابن كثير|المختصر/i.test(String(x.name||'')))||books?.[0];if(preferred?.id){const r=await fetch(`${QP}/ayah/${s}/${a}/book/${preferred.id}`,{cache:'no-store'});if(r.ok){const j=await r.json();const text=(j.content||[]).map(x=>x.text).filter(Boolean).join('\n\n');if(text){await cachePut(key,{text,book:preferred.name,at:Date.now()});return {text,book:preferred.name}}}}}}catch{}return cached||null}
  async function renderStudyBody(s,v){
    const box=$('#ayahStudyInner');if(!box)return;
    if(studyTab==='tajweed'){await renderTajweed(box,v);return}
    loading(box);
    if(studyTab==='overview'){box.innerHTML=`<div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير</h4><p>يُجلب مباشرة من Quranpedia داخل واجهة رفيق القرآن.</p></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>تُجلب مباشرة من مادة معاني الكلمات في Quranpedia داخل الواجهة.</p></section><section class="ayah-detail wahidi-mini"><h4>🕊️ سبب النزول</h4><p>تُعرض مادة أسباب النزول من Quranpedia، مع إحالة واضحة إلى كتب الباب.</p></section><section class="ayah-detail"><h4>🎙️ التجويد</h4><p>يُعرض من نص تجويد معلَّم مصدره Quran Foundation، مع Al Quran Cloud كبديل موثوق؛ لا يتم اختراع حكم محلي عند تعذر المصدر.</p></section></div>${sourceLinks(s.s,v.a)}`;return}
    const type=studyTab==='tafsir'?'tafsir':studyTab==='meanings'?'meanings':'asbab';
    if(type==='tafsir'){const data=await qpTafsir(s.s,v.a);if(data?.text){box.innerHTML=`<section class="ayah-detail"><div class="source-kicker">📖 ${esc(data.book||'تفسير Quranpedia')}</div><h4>التفسير</h4><div class="source-content">${esc(data.text).replace(/\n/g,'<br><br>')}</div></section>${sourceLinks(s.s,v.a)}`;return}}
    const html=await qpFragment(s.s,v.a,type);
    if(html){
      const safe=sanitizeSourceFragment(html);
      box.innerHTML=`<section class="ayah-detail source-fragment-wrap"><div class="source-kicker">${type==='meanings'?'🔎 معاني الكلمات':'🕊️ أسباب النزول'}</div><div class="source-fragment">${safe}</div></section>${type==='asbab'?`<div class="wahidi-actions"><a class="wahidi-primary" href="${openSource(s.s,v.a,'asbab')}" target="_blank" rel="noopener noreferrer">📜 فتح المادة في Quranpedia</a><a class="wahidi-secondary" href="${QP_WEB}/book/242" target="_blank" rel="noopener noreferrer">📚 أسباب النزول للواحدي</a></div>`:sourceLinks(s.s,v.a)}`;
      return;
    }
    box.innerHTML=`<section class="ayah-detail"><h4>${type==='meanings'?'🔎 معاني الكلمات':'🕊️ سبب النزول'}</h4><p>تعذر جلب المادة الآن. لم نعرض نصًا تقديريًا من داخل التطبيق حتى لا ننسب إلى القرآن ما ليس مصدره.</p></section>${sourceLinks(s.s,v.a)}`;
  }
  function sanitizeSourceFragment(raw){
    const doc=new DOMParser().parseFromString(String(raw||''),'text/html');
    doc.querySelectorAll('script,style,img,iframe,video,audio,object,embed,canvas,picture').forEach(x=>x.remove());
    doc.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{const n=a.name.toLowerCase();if(n.startsWith('on')||['src','srcset','style'].includes(n))el.removeAttribute(a.name)});});
    return doc.body.innerHTML.trim()||'<p>لا توجد مادة نصية متاحة الآن.</p>';
  }
  async function renderTajweed(box,v){
    loading(box);
    const data=await getAuthoritativeTajweed(surahNo,v.a);
    if(data?.html){renderAuthoritativeTajweed(box,data,v);return}
    box.innerHTML=`<section class="ayah-detail"><h4>🎙️ التجويد</h4><p>لا توجد الآن بيانات تجويد موثوقة قابلة للجلب من المصدرين المعتمدين. لذلك لن نعرض تحليلًا تقديريًا قد يخطئ في حكم من أحكام القرآن.</p><div class="source-badges"><a href="https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?verse_key=${encodeURIComponent(`${surahNo}:${v.a}`)}" target="_blank" rel="noopener noreferrer">فتح المصدر: Quran Foundation</a><a href="https://alquran.cloud/tajweed-guide" target="_blank" rel="noopener noreferrer">دليل التجويد: Al Quran Cloud</a></div></section>`;
  }
  function openStudy(s,a){const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';selectedChar=null;savePosition();renderIndex();renderSurah();renderStudyShell(su,v)}
  function playAyah(s,a){const api=window.RAFIQ_API,rList=window.RAFIQ_RECITERS||[],pref=api?.state?.prefs?.reciter||api?.state?.audio?.reciter,r=rList.find(x=>x.folder===pref)||rList[0];const audio=$('#quranAudio');if(!r||!audio)return toast('اختر قارئًا من صفحة التلاوات أولًا.');const url=r.source==='mp3quran'?`${r.server}${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;audio.src=url;audio.currentTime=0;audio.play().then(()=>toast(`بدأت تلاوة ${currentSurah()?.name||''} · الآية ${a}`)).catch(()=>toast('التلاوة تحتاج اتصالًا أو ملفًا محملًا مسبقًا.'))}
  function init(){const root=$('#view-quran');if(!root)return;const start=()=>{const data=window.RAFIQ_API?.quran||[];if(!Array.isArray(data)||data.length<114){setStatus('⏳ جاري تجهيز بيانات المصحف…',true);return}quran=data;surahNo=Math.max(1,Math.min(114,surahNo));setStatus('',false);renderIndex();renderSurah()};$('#mushafSearch')?.addEventListener('input',renderIndex);$('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));document.addEventListener('rafiq-data-ready',start,{once:true});window.addEventListener('rafiq-quran-ready',start,{once:true});if(window.RAFIQ_API?.quran?.length)start()}
  init();
})();
