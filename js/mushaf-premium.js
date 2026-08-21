(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const toast=msg=>typeof window.rafiqToast==='function'?window.rafiqToast(msg):null;
  const storageKey='rafiq-mushaf-state-v3';
  const state=(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{return{}}})();
  let quran=Array.isArray(window.RAFIQ_QURAN_DATA)?window.RAFIQ_QURAN_DATA:[];
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
  function openSource(s,a,type){return `${QP_WEB}/embed?surah=${Number(s)}&ayah=${Number(a)}&type=${encodeURIComponent(type)}&theme=dark`}
  function sourceLinks(s,a){return `<div class="source-badges"><a href="${openSource(s,a,'tafsir')}" target="_blank" rel="noopener noreferrer">📖 فتح المصدر في Quranpedia</a><a href="${QP_WEB}/book/${WAHIDI_BOOK}" target="_blank" rel="noopener noreferrer">📚 أسباب النزول للواحدي</a></div>`}
  function cleanText(v){return String(v??'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}
  async function qpJson(url){try{if(!navigator.onLine)return null;const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}
  async function searchBook(query,pick){const key=`qpbook:${query}`;const cached=await cacheGet(key);if(cached?.book)return cached.book;const data=await qpJson(`${QP}/search/${encodeURIComponent(query)}/books`);const items=Array.isArray(data?.items)?data.items:(Array.isArray(data?.books?.items)?data.books.items:[]);if(!items.length)return null;const books=items.map(x=>x.book_info||x.book||x).filter(Boolean);const book=books.sort((a,b)=>pick(b)-pick(a))[0]||null;if(book)await cachePut(key,{book,at:Date.now()});return book}
  async function bookContent(s,a,bookId){const key=`qpcontent:${bookId}:${s}:${a}`;const cached=await cacheGet(key);if(cached?.text)return cached;const data=await qpJson(`${QP}/ayah/${s}/${a}/book/${bookId}`);if(!data)return null;const chunks=Array.isArray(data?.content)?data.content.map(x=>cleanText(x?.text)).filter(Boolean):[];if(!chunks.length)return null;const result={text:chunks.join('\n\n'),book:data.book?.name||data.book?.short_name||`كتاب ${bookId}`,bookId};await cachePut(key,result);return result}
  async function qpTafsir(s,a){const book=await searchBook('تفسير الميسر',x=>{const n=normalizeArabicName(x.name||x.short_name);return(n.includes('الميسر')?100:0)+(n.includes('مختصر')?40:0)+(n.includes('السعدي')?20:0)});if(book?.id){const hit=await bookContent(s,a,book.id);if(hit)return hit}const fallback=await searchBook('تفسير',x=>{const n=normalizeArabicName(x.name||x.short_name);return(n.includes('المختصر')?100:0)+(n.includes('السعدي')?70:0)+(n.includes('ابن كثير')?50:0)});return fallback?.id?bookContent(s,a,fallback.id):null}
  async function qpMeanings(s,a){const book=await searchBook('معاني الكلمات',x=>{const n=normalizeArabicName(x.name||x.short_name);return(n.includes('معاني')?100:0)+(n.includes('كلمات')?60:0)+(n.includes('غريب')?30:0)});if(book?.id){const hit=await bookContent(s,a,book.id);if(hit)return hit}const fallback=await searchBook('غريب القرآن',x=>{const n=normalizeArabicName(x.name||x.short_name);return(n.includes('غريب')?100:0)+(n.includes('كلمات')?50:0)});return fallback?.id?bookContent(s,a,fallback.id):null}
  async function qpAsbab(s,a){const direct=await bookContent(s,a,WAHIDI_BOOK);if(direct)return{...direct,book:'أسباب النزول — الواحدي'};const alt=await bookContent(s,a,2352);if(alt)return{...alt,book:'أسباب النزول (الواحدي) — تحقيق الحميدان'};const opts=await qpJson(`${QP}/ayah/${s}/${a}/options`);return{none:true,hasAsbab:Array.isArray(opts?.options)&&opts.options.includes('asbab')}}
  async function renderStudyBody(s,v){const box=$('#ayahStudyInner');if(!box)return;if(studyTab==='tajweed'){renderTajweed(box,v);return}if(studyTab==='overview'){box.innerHTML=`<div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير</h4><p>تفسير الآية من Quranpedia، ويُحفظ بعد أول جلب.</p></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>معاني الكلمات المرتبطة بالآية من الكتب المتاحة في Quranpedia.</p></section><section class="ayah-detail wahidi-mini"><h4>🕊️ سبب النزول</h4><p>يُبحث أولًا في <b>أسباب النزول للواحدي</b> ولا تُنسب رواية إلى الآية من غير مصدر.</p></section><section class="ayah-detail"><h4>🎙️ التجويد</h4><p>تحليل تعليمي محلي يعمل دون اتصال.</p></section></div>${sourceLinks(s.s,v.a)}`;return}loading(box);let data=null;if(studyTab==='tafsir')data=await qpTafsir(s.s,v.a);if(studyTab==='meanings')data=await qpMeanings(s.s,v.a);if(studyTab==='asbab'){const as=await qpAsbab(s.s,v.a);if(as?.text){box.innerHTML=`<section class="ayah-detail source-content-card"><div class="source-kicker">🕊️ سبب النزول</div><h4>${esc(as.book)}</h4><div class="source-content">${esc(as.text).replace(/\n/g,'<br><br>')}</div></section><div class="wahidi-actions"><a class="wahidi-primary" href="${QP_WEB}/book/${WAHIDI_BOOK}" target="_blank" rel="noopener noreferrer">📚 فتح كتاب الواحدي</a><a class="wahidi-secondary" href="${openSource(s.s,v.a,'asbab')}" target="_blank" rel="noopener noreferrer">🔎 مواد أسباب النزول في Quranpedia</a></div>`;return}box.innerHTML=`<section class="ayah-detail"><div class="source-kicker">🕊️ سبب النزول</div><h4>${as?.hasAsbab?'لم يظهر نص خاص بالآية في نسخة الواحدي المتاحة.':'لا يوجد سبب نزول خاص متاح لهذه الآية في المادة التي تم جلبها.'}</h4><p>${as?.hasAsbab?'يمكنك فتح مواد أسباب النزول في Quranpedia للمقارنة بين المصادر.':'ليس كل آيات القرآن نزلت على سبب خاص.'}</p></section><div class="wahidi-actions"><a class="wahidi-primary" href="${QP_WEB}/book/${WAHIDI_BOOK}" target="_blank" rel="noopener noreferrer">📚 كتاب أسباب النزول للواحدي</a></div>`;return}if(data?.text){box.innerHTML=`<section class="ayah-detail source-content-card"><div class="source-kicker">${studyTab==='meanings'?'🔎 معاني الكلمات':'📖 التفسير'}</div><h4>${esc(data.book||'Quranpedia')}</h4><div class="source-content">${esc(data.text).replace(/\n/g,'<br><br>')}</div></section>${sourceLinks(s.s,v.a)}`;return}box.innerHTML=`<section class="ayah-detail"><h4>${studyTab==='meanings'?'🔎 معاني الكلمات':'📖 التفسير'}</h4><p>تعذر جلب المادة الآن. عند توفر الإنترنت ستتم مزامنتها تلقائيًا، وأي مادة سبق فتحها ستظل محفوظة على جهازك.</p></section>${sourceLinks(s.s,v.a)}`}
  function renderTajweed(box,v){const t=graphemes(v.text),all=new Set();const html=t.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rules=tajFor(t,i);rules.forEach(x=>all.add(x));return`<span class="ayah-taj-letter" data-gidx="${i}">${esc(g.raw)}</span>`}).join('');box.innerHTML=`<div class="mushaf-note">🎙️ تحليل تعليمي محلي. اضغط أي حرف لترى الحركة والحكم وطريقة النطق.</div><div class="taj-legend"><span>🟢 غنة وإدغام</span><span>🟡 قلقلة</span><span>🔵 مد/همز</span></div><div class="ayah-taj-verse">${html}</div><div id="tajInspector" class="taj-inspector"><b>اختر حرفًا</b><p>ستظهر هنا الحركة والحكم وطريقة النطق.</p></div><div class="grid2" style="margin-top:12px">${Array.from(all).map(r=>`<section class="ayah-detail"><h4>${esc(r)}</h4><p>${esc(TAJ_RULES[r]||'شرح مبسط لهذا الحكم.')}</p></section>`).join('')||'<section class="ayah-detail"><p>لا يظهر حكم إضافي واضح في التحليل الآلي.</p></section>'}</div>`;box.querySelectorAll('.ayah-taj-letter').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.gidx),g=t[i],rules=tajFor(t,i);box.querySelectorAll('.ayah-taj-letter').forEach(x=>x.classList.toggle('selected',Number(x.dataset.gidx)===i));const ins=$('#tajInspector');if(ins)ins.innerHTML=`<b>الحرف: ${esc(g.raw)}</b><p>الحركة: ${esc(haraka(g.m))}</p><p>الحكم: ${esc(rules.join('، ')||'لا حكم إضافي ظاهر آليًا')}</p><p>الأداء: ${esc(g.b)} مع الحركة المذكورة، مع مراعاة الحكم في الوصل.</p>`})}
  function openStudy(s,a){const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';selectedChar=null;savePosition();renderIndex();renderSurah();renderStudyShell(su,v)}
  function playAyah(s,a){const api=window.RAFIQ_API,rList=window.RAFIQ_RECITERS||[],pref=api?.state?.prefs?.reciter||api?.state?.audio?.reciter,r=rList.find(x=>x.folder===pref)||rList[0];const audio=$('#quranAudio');if(!r||!audio)return toast('اختر قارئًا من صفحة التلاوات أولًا.');if(typeof window.RAFIQ_API?.playAyah==='function'){window.RAFIQ_API.playAyah(s,a);return;} const url=r.source==='mp3quran'?`${String(r.server).replace(/\/+$/,'')}/${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;audio.src=url;audio.currentTime=0;audio.play().then(()=>toast(`بدأت تلاوة ${currentSurah()?.name||''} · الآية ${a}`)).catch(()=>toast('التلاوة تحتاج اتصالًا أو ملفًا محملًا مسبقًا.'))}
  function init(){
    const root=$('#view-quran');if(!root)return;
    let started=false;
    const start=()=>{
      const data=(window.RAFIQ_QURAN_DATA?.length===114?window.RAFIQ_QURAN_DATA:(window.RAFIQ_API?.quran||[]));
      if(!Array.isArray(data)||data.length!==114){setStatus('⏳ جاري تجهيز بيانات المصحف…',true);return false}
      if(started)return true; started=true;
      quran=data;surahNo=Math.max(1,Math.min(114,surahNo));setStatus('',false);renderIndex();renderSurah();return true;
    };
    $('#mushafSearch')?.addEventListener('input',renderIndex);
    $('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});
    $('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});
    $('#mushafTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    document.addEventListener('rafiq-data-ready',start,{once:true});
    window.addEventListener('rafiq-quran-ready',start,{once:true});
    window.addEventListener('load',()=>start());
    start();
    [60,250,800,1600].forEach(ms=>setTimeout(start,ms));
  }
  init();
})();
