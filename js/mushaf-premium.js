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
  const QP_WEB='https://quranpedia.net';
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
  function renderIndex(){const box=$('#mushafSurahList');if(!box)return;const query=($('#mushafSearch')?.value||'').trim();const list=quran.filter(s=>!query||String(s.s)===query||String(s.name).includes(query));box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count} آيات</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';box.querySelectorAll('[data-sura]').forEach(btn=>btn.onclick=()=>{surahNo=Number(btn.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)})}
  function renderSurah(scroll=false){const s=currentSurah();if(!s)return;$('#mushafSurahTitle').textContent=s.name;$('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;const verseBox=$('#mushafVerses');verseBox.innerHTML=s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a} · رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button type="button" class="action info" data-study="${v.a}">📖 دراسة الآية</button><button type="button" class="action" data-play="${v.a}">🔊 استماع</button><button type="button" class="action" data-mark="${v.a}">${Number(v.a)===selectedAyah?'📌 محددة':'📍 تحديد'}</button></div></article>`).join('');verseBox.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));verseBox.querySelectorAll('.mushaf-ayah-text').forEach(el=>{el.onclick=()=>openStudy(s.s,Number(el.closest('.mushaf-ayah').dataset.ayah));el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}}});verseBox.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{selectedAyah=Number(b.dataset.mark);savePosition();renderSurah();toast(`تم تحديد ${s.name} · الآية ${selectedAyah}`)});verseBox.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));$('#mushafPrev').disabled=s.s<=1;$('#mushafNext').disabled=s.s>=114;if(scroll)window.scrollTo({top:0,behavior:'smooth'})}
  function renderStudyShell(s,v){const panel=$('#ayahStudyPanel');if(!panel)return;panel.hidden=false;panel.innerHTML=`<div class="ayah-study-head"><div><div class="ayah-study-kicker">أدوات الآية</div><h3>📖 ${esc(s.name)} · الآية ${v.a}</h3><p>${esc(v.text)}</p></div><button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button></div><div class="ayah-study-tabs" role="tablist"><button type="button" class="ayah-study-tab active" data-tab="overview">نظرة عامة</button><button type="button" class="ayah-study-tab" data-tab="tafsir">📖 التفسير</button><button type="button" class="ayah-study-tab" data-tab="meanings">🔎 معاني الكلمات</button><button type="button" class="ayah-study-tab" data-tab="tajweed">🎙️ التجويد</button><button type="button" class="ayah-study-tab" data-tab="asbab">🕊️ سبب النزول</button></div><div id="ayahStudyInner"></div>`;$('#closeMushafStudy').onclick=()=>{panel.hidden=true;selectedAyah=0;savePosition();renderSurah()};panel.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panel.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x===b));renderStudyBody(s,v)});renderStudyBody(s,v);panel.scrollIntoView({behavior:'smooth',block:'start'})}
  function loading(box){box.innerHTML='<div class="mushaf-note">جارٍ جلب المادة العلمية… إذا انقطع الإنترنت سيُعرض آخر محتوى محفوظ لهذه الآية.</div><div class="study-skeleton"><i></i><i></i><i></i></div>'}

  function quranpediaEmbed(s,a,type,caption){
    const src=`https://quranpedia.net/embed?surah=${Number(s)}&ayah=${Number(a)}&type=${encodeURIComponent(type)}&theme=dark&lock=1&ayah_text=1`;
    return `<section class="ayah-detail quranpedia-panel"><div class="source-kicker">${caption}</div><iframe class="quranpedia-embed-frame" src="${src}" title="${esc(caption)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen"></iframe><div class="source-badges"><a href="${src}" target="_blank" rel="noopener noreferrer">↗ فتح في Quranpedia</a></div></section>`;
  }

  async function renderStudyBody(s,v){
    const box=$('#ayahStudyInner');
    if(!box)return;
    if(studyTab==='tajweed'){renderTajweed(box,v);return}
    const types={tafsir:['tafsir','📖 التفسير'],meanings:['meanings','🔎 معاني الكلمات'],asbab:['asbab','🕊️ أسباب النزول']};
    if(studyTab==='overview'){
      box.innerHTML=`<div class="ayah-detail-grid">
        <section class="ayah-detail quranpedia-shortcut"><h4>📖 التفسير</h4><p>تفسير الآية من موسوعة Quranpedia.</p><button type="button" class="study-jump" data-tab="tafsir">فتح التفسير</button></section>
        <section class="ayah-detail quranpedia-shortcut"><h4>🔎 معاني الكلمات</h4><p>معاني الكلمات المرتبطة بهذه الآية.</p><button type="button" class="study-jump" data-tab="meanings">فتح المعاني</button></section>
        <section class="ayah-detail quranpedia-shortcut wahidi-mini"><h4>🕊️ سبب النزول</h4><p>سبب النزول المرتبط بالآية، مع الاستفادة من مادة الواحدي عبر Quranpedia.</p><button type="button" class="study-jump" data-tab="asbab">فتح سبب النزول</button></section>
        <section class="ayah-detail"><h4>🎙️ التجويد</h4><p>تحليل تعليمي محلي للآية يعمل بدون اتصال.</p><button type="button" class="study-jump" data-tab="tajweed">فتح التجويد</button></section>
      </div>`;
      box.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panelTabSwitch();renderStudyBody(s,v)});
      return;
    }
    const item=types[studyTab];
    if(!item)return;
    box.innerHTML=`<div class="mushaf-note">📚 المصدر: Quranpedia — تُعرض المادة هنا بواجهة رفيق مع المحتوى الأصلي للموسوعة.</div>${quranpediaEmbed(s.s,v.a,item[0],item[1])}`;
  }

  function panelTabSwitch(){
    const panel=$('#ayahStudyPanel');
    panel?.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===studyTab));
  }
  function renderTajweed(box,v){const t=graphemes(v.text),all=new Set();const html=t.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rules=tajFor(t,i);rules.forEach(x=>all.add(x));return`<span class="ayah-taj-letter" data-gidx="${i}">${esc(g.raw)}</span>`}).join('');box.innerHTML=`<div class="mushaf-note">🎙️ تحليل تعليمي محلي. اضغط أي حرف لترى الحركة والحكم وطريقة النطق.</div><div class="taj-legend"><span>🟢 غنة وإدغام</span><span>🟡 قلقلة</span><span>🔵 مد/همز</span></div><div class="ayah-taj-verse">${html}</div><div id="tajInspector" class="taj-inspector"><b>اختر حرفًا</b><p>ستظهر هنا الحركة والحكم وطريقة النطق.</p></div><div class="grid2" style="margin-top:12px">${Array.from(all).map(r=>`<section class="ayah-detail"><h4>${esc(r)}</h4><p>${esc(TAJ_RULES[r]||'شرح مبسط لهذا الحكم.')}</p></section>`).join('')||'<section class="ayah-detail"><p>لا يظهر حكم إضافي واضح في التحليل الآلي.</p></section>'}</div>`;box.querySelectorAll('.ayah-taj-letter').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.gidx),g=t[i],rules=tajFor(t,i);box.querySelectorAll('.ayah-taj-letter').forEach(x=>x.classList.toggle('selected',Number(x.dataset.gidx)===i));const ins=$('#tajInspector');if(ins)ins.innerHTML=`<b>الحرف: ${esc(g.raw)}</b><p>الحركة: ${esc(haraka(g.m))}</p><p>الحكم: ${esc(rules.join('، ')||'لا حكم إضافي ظاهر آليًا')}</p><p>الأداء: ${esc(g.b)} مع الحركة المذكورة، مع مراعاة الحكم في الوصل.</p>`})}
  function openStudy(s,a){const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';selectedChar=null;savePosition();renderIndex();renderSurah();renderStudyShell(su,v)}
  function playAyah(s,a){const api=window.RAFIQ_API,rList=window.RAFIQ_RECITERS||[],pref=api?.state?.prefs?.reciter||api?.state?.audio?.reciter,r=rList.find(x=>x.folder===pref)||rList[0];const audio=$('#quranAudio');if(!r||!audio)return toast('اختر قارئًا من صفحة التلاوات أولًا.');const url=r.source==='mp3quran'?`${r.server}${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;audio.src=url;audio.currentTime=0;audio.play().then(()=>toast(`بدأت تلاوة ${currentSurah()?.name||''} · الآية ${a}`)).catch(()=>toast('التلاوة تحتاج اتصالًا أو ملفًا محملًا مسبقًا.'))}
  function init(){const root=$('#view-quran');if(!root)return;const start=()=>{const data=window.RAFIQ_API?.quran||[];if(!Array.isArray(data)||data.length<114){setStatus('⏳ جاري تجهيز بيانات المصحف…',true);return}quran=data;surahNo=Math.max(1,Math.min(114,surahNo));setStatus('',false);renderIndex();renderSurah()};$('#mushafSearch')?.addEventListener('input',renderIndex);$('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));document.addEventListener('rafiq-data-ready',start,{once:true});window.addEventListener('rafiq-quran-ready',start,{once:true});if(window.RAFIQ_API?.quran?.length)start()}
  init();
})();
