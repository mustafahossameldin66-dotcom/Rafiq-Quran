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
  const TAJ_RULES={
    'الإظهار الحلقي':'النون الساكنة أو التنوين قبل ء هـ ع ح غ خ: تُقرأ النون أو التنوين بوضوح.',
    'الإدغام بغنة':'النون الساكنة أو التنوين قبل ي ن م و: إدغام مع غنة.',
    'الإدغام بغير غنة':'النون الساكنة أو التنوين قبل ل أو ر: إدغام بلا غنة مستقلة.',
    'الإقلاب':'النون الساكنة أو التنوين قبل الباء: تُقلب ميمًا مخفاة مع غنة.',
    'الإخفاء الحقيقي':'النون الساكنة أو التنوين قبل حروف الإخفاء: بين الإظهار والإدغام مع غنة.',
    'الإخفاء الشفوي':'ميم ساكنة بعدها باء: إخفاء مع غنة.',
    'الإدغام الشفوي':'ميم ساكنة بعدها ميم: إدغام مع غنة.',
    'الإظهار الشفوي':'ميم ساكنة بعدها غير الباء والميم: إظهار الميم.',
    'غنة النون المشددة':'النون المشددة فيها غنة ثابتة مقدارها حركتان.',
    'غنة الميم المشددة':'الميم المشددة فيها غنة ثابتة مقدارها حركتان.',
    'القلقلة':'حروف قطب جد إذا كانت ساكنة يظهر للحرف ارتداد خفيف بلا إضافة حركة.',
    'تفخيم حروف الاستعلاء':'حروف خص ضغط قظ لها أصل التفخيم، وتختلف درجته حسب السياق.',
    'المد الطبيعي':'حرف المد الذي لا يليه همز أو سكون موجب للمد الفرعي، والأصل فيه حركتان.',
    'همزة الوصل':'تُقرأ عند الابتداء وتسقط في الوصل في مواضعها.',
    'همزة القطع':'تثبت في الابتداء والوصل.'
  };
  const heavy=new Set('خصضغطقظ'), qalq=new Set('قطبجد');
  function graphemes(text){const out=[];let cur=null;for(const ch of String(text||'')){if(/[ء-يٱ]/.test(ch)){cur={b:ch,m:[],raw:ch};out.push(cur)}else if(/[ًٌٍَُِّْٰٔ]/.test(ch)&&cur){cur.m.push(ch);cur.raw+=ch}else if(/\s/.test(ch))out.push({space:true,raw:ch});else out.push({punct:true,raw:ch})}return out}
  const prev=(t,i)=>{for(let j=i-1;j>=0;j--)if(!t[j].space&&!t[j].punct)return j;return -1};
  const next=(t,i)=>{for(let j=i+1;j<t.length;j++)if(!t[j].space&&!t[j].punct)return j;return -1};
  function haraka(m){if(m.includes('َ'))return'فتحة';if(m.includes('ُ'))return'ضمة';if(m.includes('ِ'))return'كسرة';if(m.includes('ْ'))return'سكون';if(m.includes('ّ'))return'شدة';if(m.includes('ٰ'))return'ألف خنجرية';if(m.includes('ً'))return'تنوين فتح';if(m.includes('ٌ'))return'تنوين ضم';if(m.includes('ٍ'))return'تنوين كسر';return'لا حركة مكتوبة'}
  function tajFor(t,i){const g=t[i],r=[];if(!g||g.space||g.punct)return r;const p=prev(t,i),n=next(t,i),nb=n>=0?t[n].b:'';const add=x=>{if(!r.includes(x))r.push(x)};if(g.b==='ن'&&(g.m.includes('ْ')||g.m.some(x=>['ً','ٌ','ٍ'].includes(x)))){if('ءأإٱهـعحغخ'.includes(nb))add('الإظهار الحلقي');else if('ينمو'.includes(nb))add('الإدغام بغنة');else if('لر'.includes(nb))add('الإدغام بغير غنة');else if(nb==='ب')add('الإقلاب');else if('تثجدذزسشصضطظفقك'.includes(nb))add('الإخفاء الحقيقي')}if(g.b==='م'&&g.m.includes('ْ')){if(nb==='ب')add('الإخفاء الشفوي');else if(nb==='م')add('الإدغام الشفوي');else add('الإظهار الشفوي')}if(g.b==='ن'&&g.m.includes('ّ'))add('غنة النون المشددة');if(g.b==='م'&&g.m.includes('ّ'))add('غنة الميم المشددة');if(qalq.has(g.b)&&g.m.includes('ْ'))add('القلقلة');if(heavy.has(g.b))add('تفخيم حروف الاستعلاء');if(g.b==='ٱ')add('همزة الوصل');if('أإؤئ'.includes(g.b))add('همزة القطع');if(g.m.includes('ٰ'))add('المد الطبيعي');if(g.b==='ا'&&p>=0&&t[p].m.includes('َ'))add('المد الطبيعي');if((g.b==='و'||g.b==='ي')&&g.m.includes('ْ')&&p>=0&&/[ُِ]/.test(t[p].m.join('')))add('المد الطبيعي');return r}
  function openSource(s,a,type){return `${QP_WEB}/embed?surah=${Number(s)}&ayah=${Number(a)}&type=${encodeURIComponent(type)}`}
  function sourceLinks(s,a,type='tafsir'){return `<div class="source-badges"><a href="${openSource(s,a,type)}" target="_blank" rel="noopener noreferrer">📖 المصدر في Quranpedia</a>${type==='asbab'?`<a href="${QP_WEB}/book/${WAHIDI_BOOK}" target="_blank" rel="noopener noreferrer">📚 أسباب النزول للواحدي</a>`:''}</div>`}
  function renderIndex(){const box=$('#mushafSurahList');if(!box)return;const query=($('#mushafSearch')?.value||'').trim();const list=quran.filter(s=>!query||String(s.s)===query||String(s.name).includes(query));box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count} آيات</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';box.querySelectorAll('[data-sura]').forEach(btn=>btn.onclick=()=>{surahNo=Number(btn.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)})}
  function renderSurah(scroll=false){const s=currentSurah();if(!s)return;$('#mushafSurahTitle').textContent=s.name;$('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;const verseBox=$('#mushafVerses');verseBox.innerHTML=s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a} · رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button type="button" class="action info" data-study="${v.a}">📖 دراسة الآية</button><button type="button" class="action" data-play="${v.a}">🔊 استماع</button><button type="button" class="action" data-mark="${v.a}">${Number(v.a)===selectedAyah?'📌 محددة':'📍 تحديد'}</button></div></article>`).join('');verseBox.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));verseBox.querySelectorAll('.mushaf-ayah-text').forEach(el=>{el.onclick=()=>openStudy(s.s,Number(el.closest('.mushaf-ayah').dataset.ayah));el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}}});verseBox.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{selectedAyah=Number(b.dataset.mark);savePosition();renderSurah();toast(`تم تحديد ${s.name} · الآية ${selectedAyah}`)});verseBox.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));$('#mushafPrev').disabled=s.s<=1;$('#mushafNext').disabled=s.s>=114;if(scroll)window.scrollTo({top:0,behavior:'smooth'})}
  function renderStudyShell(s,v){const panel=$('#ayahStudyPanel');if(!panel)return;panel.hidden=false;panel.innerHTML=`<div class="ayah-study-head"><div><div class="ayah-study-kicker">أدوات الآية</div><h3>📖 ${esc(s.name)} · الآية ${v.a}</h3><p>${esc(v.text)}</p></div><button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button></div><div class="ayah-study-tabs" role="tablist"><button type="button" class="ayah-study-tab active" data-tab="overview">نظرة عامة</button><button type="button" class="ayah-study-tab" data-tab="tafsir">📖 التفسير</button><button type="button" class="ayah-study-tab" data-tab="meanings">🔎 معاني الكلمات</button><button type="button" class="ayah-study-tab" data-tab="tajweed">🎙️ التجويد</button><button type="button" class="ayah-study-tab" data-tab="asbab">🕊️ سبب النزول</button></div><div id="ayahStudyInner"></div>`;$('#closeMushafStudy').onclick=()=>{panel.hidden=true;selectedAyah=0;savePosition();renderSurah()};panel.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panel.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x===b));renderStudyBody(s,v)});renderStudyBody(s,v);panel.scrollIntoView({behavior:'smooth',block:'start'})}
  function loading(box){box.innerHTML='<div class="mushaf-note">جارٍ جلب المادة العلمية… إذا انقطع الإنترنت سيُعرض آخر محتوى محفوظ لهذه الآية.</div><div class="study-skeleton"><i></i><i></i><i></i></div>'}
  async function qpBooksSearch(term){
    const key=`qpbs:${term}`;const cached=await cacheGet(key);try{if(navigator.onLine){const r=await fetch(`${QP}/search/${encodeURIComponent(term)}/books`,{cache:'no-store'});if(r.ok){const j=await r.json();await cachePut(key,{data:j,at:Date.now()});return j}}}catch{}return cached?.data||null;
  }
  function extractBookRows(data){
    const rows=Array.isArray(data)?data:(Array.isArray(data?.books)?data.books:Array.isArray(data?.results)?data.results:Array.isArray(data?.items)?data.items:[]);
    return rows.map(x=>x?.book_info?{...x.book_info,...x,book_info:undefined}:x).filter(Boolean);
  }
  async function findBook(term,preferredRegex){const rows=extractBookRows(await qpBooksSearch(term));return rows.find(x=>preferredRegex.test(String(x.name||'')))||rows.find(x=>/غريب|أسباب|نزول|الواحدي/i.test(String(x.name||'')))||rows[0]||null}
  async function qpBookContent(s,a,book){if(!book?.id)return null;const key=`qpbook:${book.id}:${s}:${a}`;const cached=await cacheGet(key);try{if(navigator.onLine){const r=await fetch(`${QP}/ayah/${s}/${a}/book/${book.id}`,{cache:'no-store'});if(r.ok){const j=await r.json();await cachePut(key,{data:j,at:Date.now()});return j}}}catch{}return cached?.data||null}
  function extractContent(data){return (Array.isArray(data?.content)?data.content:[]).map(x=>x.text).filter(Boolean).join('\n\n').trim()||null}
  async function qpTafsir(s,a){const key=`qpt:${s}:${a}`;const cached=await cacheGet(key);try{if(navigator.onLine){const books=await (await fetch(`${QP}/surah/tafsirs/${s}`,{cache:'no-store'})).json();const preferred=(Array.isArray(books)?books:[]).find(x=>/الميسر|السعدي|ابن كثير|المختصر/i.test(String(x.name||'')))||books?.[0];const data=await qpBookContent(s,a,preferred);const text=extractContent(data);if(text)return {text,book:data?.book?.name||preferred?.name||'تفسير Quranpedia'}}}catch{}return cached?.text?cached:null}
  async function qpMeanings(s,a){const book=await findBook('غريب القرآن',/السراج في بيان غريب القرآن|غريب القرآن|المفردات/i);return qpBookContent(s,a,book)}
  async function qpAsbab(s,a){const book=await findBook('أسباب النزول',/الواحدي|أسباب النزول/i);return qpBookContent(s,a,book)}
  async function renderStudyBody(s,v){
    const box=$('#ayahStudyInner');if(!box)return;
    if(studyTab==='tajweed'){renderTajweed(box,v);return}
    loading(box);
    if(studyTab==='overview'){
      box.innerHTML=`<div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير</h4><p>تفسير الآية من مكتبة Quranpedia، مع حفظ المحتوى الذي تم فتحه على جهازك.</p></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>معاني الألفاظ من كتب غريب القرآن المتاحة في Quranpedia.</p></section><section class="ayah-detail wahidi-mini"><h4>🕊️ سبب النزول</h4><p>يُبحث في كتب أسباب النزول، مع تفضيل كتاب الواحدي عند توفره.</p></section><section class="ayah-detail"><h4>🎙️ التجويد</h4><p>تحليل تعليمي محلي داخل رفيق، ولا يتوقف بانقطاع الإنترنت.</p></section></div>${sourceLinks(s.s,v.a,'tafsir')}`;return;
    }
    if(studyTab==='tafsir'){
      const data=await qpTafsir(s.s,v.a);if(data?.text){box.innerHTML=`<section class="ayah-detail"><div class="source-kicker">📖 ${esc(data.book||'تفسير Quranpedia')}</div><h4>التفسير</h4><div class="source-content">${esc(data.text).replace(/\n/g,'<br><br>')}</div></section>${sourceLinks(s.s,v.a,'tafsir')}`;return;}
    }
    if(studyTab==='meanings'){
      const data=await qpMeanings(s.s,v.a);const text=extractContent(data);if(text){box.innerHTML=`<section class="ayah-detail"><div class="source-kicker">🔎 ${esc(data?.book?.name||'معاني الكلمات من Quranpedia')}</div><h4>معاني الكلمات</h4><div class="source-content">${esc(text).replace(/\n/g,'<br><br>')}</div></section>${sourceLinks(s.s,v.a,'meanings')}`;return;}
      box.innerHTML=`<section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>لم تُرجع مكتبة Quranpedia مادة لهذه الآية حاليًا. جرّب الاتصال بالإنترنت مرة أخرى، أو افتح المصدر مباشرة.</p></section>${sourceLinks(s.s,v.a,'meanings')}`;return;
    }
    if(studyTab==='asbab'){
      const data=await qpAsbab(s.s,v.a);const text=extractContent(data);if(text){box.innerHTML=`<section class="ayah-detail"><div class="source-kicker">🕊️ ${esc(data?.book?.name||'أسباب النزول')}</div><h4>سبب النزول</h4><div class="source-content">${esc(text).replace(/\n/g,'<br><br>')}</div></section><div class="wahidi-actions"><a class="wahidi-primary" href="${QP_WEB}/book/${WAHIDI_BOOK}" target="_blank" rel="noopener noreferrer">📜 كتاب أسباب النزول للواحدي</a></div>`;return;}
      box.innerHTML=`<section class="ayah-detail"><h4>🕊️ سبب النزول</h4><p>لم يرد سبب نزول خاص في المادة التي أرجعها المصدر لهذه الآية، أو تعذر جلبها الآن. لن نخترع سببًا غير موثق.</p></section><div class="wahidi-actions"><a class="wahidi-primary" href="${QP_WEB}/book/${WAHIDI_BOOK}" target="_blank" rel="noopener noreferrer">📚 فتح كتاب أسباب النزول للواحدي</a></div>`;return;
    }
  }
  function renderTajweed(box,v){
    const surah=Number(v?.s||surahNo||1), ayah=Number(v?.a||1);
    const src=`${QP_WEB}/surah/1/${surah}/tajweed`;
    box.innerHTML=`<section class="ayah-detail quranpedia-panel tajweed-source-panel">
      <div class="source-kicker">🎙️ أحكام التجويد · المصدر الموثوق: Quranpedia</div>
      <div class="mushaf-note">تم إلغاء محلل التجويد التجريبي داخل رفيق. الأحكام المعروضة أدناه هي من <b>مصحف التجويد الملوّن في Quranpedia</b>، حتى لا نعطيك حكمًا آليًا غير دقيق.</div>
      <div class="ayah-detail" style="margin:12px 0"><h4>الآية ${ayah}</h4><p class="source-content" style="font-family:UthmanicHafs,Amiri,serif;font-size:28px;line-height:2.1">${esc(v?.text||'')}</p></div>
      <iframe class="quranpedia-iframe tajweed-quranpedia-frame" src="${src}" title="مصدر أحكام التجويد من Quranpedia لسورة ${surah}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <div class="source-badges"><a href="${src}" target="_blank" rel="noopener noreferrer">↗ فتح مصحف التجويد كاملًا في Quranpedia</a></div>
    </section>`;
  }
  function openStudy(s,a){const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';selectedChar=null;savePosition();renderIndex();renderSurah();renderStudyShell(su,v)}
  async function playAyah(s,a){const api=window.RAFIQ_API;if(!api?.ensureReciterAndPlay){toast('محرك التلاوة لم يجهز بعد.');return}await api.ensureReciterAndPlay(s,a);}
  function init(){const root=$('#view-quran');if(!root)return;const start=()=>{const data=window.RAFIQ_API?.quran||[];if(!Array.isArray(data)||data.length<114){setStatus('⏳ جاري تجهيز بيانات المصحف…',true);return false}quran=data;surahNo=Math.max(1,Math.min(114,surahNo));setStatus('',false);renderIndex();renderSurah();return true};$('#mushafSearch')?.addEventListener('input',renderIndex);$('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});let tries=0;const timer=setInterval(()=>{tries++;if(start()||tries>120)clearInterval(timer)},100);window.addEventListener('rafiq-quran-ready',start);window.addEventListener('rafiq-data-ready',start);start()}
  init();
})();
