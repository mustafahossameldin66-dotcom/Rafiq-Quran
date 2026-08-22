(function(){
  'use strict';
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const toast=msg=>window.rafiqToast?.(msg);
  const stateKey='rafiq-mushaf-state-v4';
  const state=(()=>{try{return JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{return{}}})();
  const CONTENT=window.RAFIQ_CONTENT;
  let quran=[];
  let surahNo=Number(state.surah||1)||1, selectedAyah=Number(state.ayah||0)||0, studyTab='overview';
  const QP_WEB='https://quranpedia.net';
  const TAFSIR_BOOK=2012,MEANINGS_BOOK=2013,ASBAB_BOOK=2919;
  const TAFSIR_QP_BOOK_ID=32;
  const TAJWEED_RULES={
    ham_wasl:['همزة الوصل','تُثبت في الابتداء وتسقط في الوصل.'],
    silent:['علامة صامتة','علامة أداء صامتة بحسب ضبط المصحف.'],
    laam_shamsiyah:['لام شمسية','اللام الشمسية المدغمة في الحرف الذي بعدها.'],
    madda_normal:['مد طبيعي','مدّ بمقدار حركتين في الموضع المعلَّم.'],
    madda_permissible:['مد جائز','مدّ جائز بحسب موضع الهمز والانفصال في القراءة المعتبرة.'],
    madda_obligatory:['مد واجب','مدّ واجب بحسب الموضع المعلَّم.'],
    madda_necessary:['مد لازم','مدّ لازم بالقدر المقرر في الموضع المعلَّم.'],
    qalqalah:['قلقلة','اضطراب صوت الحرف الساكن من حروف قطب جد في الموضع المعلَّم.'],
    ghunnah:['غنة','صوت غُنّي ملازم للحكم المعلَّم.'],
    idgham_ghunnah:['إدغام بغنة','إدغام النون الساكنة أو التنوين مع الغنة في الموضع المعلَّم.'],
    idgham_wo_ghunnah:['إدغام بغير غنة','إدغام النون الساكنة أو التنوين بلا غنة في الموضع المعلَّم.'],
    idgham_no_ghunnah:['إدغام بغير غنة','إدغام النون الساكنة أو التنوين بلا غنة في الموضع المعلَّم.'],
    ikhfa:['إخفاء','النطق بين الإظهار والإدغام مع الغنة في الموضع المعلَّم.'],
    ikhfa_shafawi:['إخفاء شفوي','إخفاء الميم الساكنة عند الباء مع الغنة.'],
    iqlab:['إقلاب','قلب النون الساكنة أو التنوين ميمًا مخفاة عند الباء مع الغنة.'],
    idgham_shafawi:['إدغام شفوي','إدغام الميم الساكنة في الميم مع الغنة.'],
    idgham_mutajanisayn:['إدغام متجانسين','إدغام الحرفين المتجانسين في الموضع المعلَّم.'],
    idgham_mutaqaribayn:['إدغام متقاربين','إدغام الحرفين المتقاربين في الموضع المعلَّم.']
  };
  const tajInfo=cls=>TAJWEED_RULES[cls]||['حكم تجويدي','حكم ملوّن وارد من نص التجويد المعلَّم في المصدر المرجعي.'];
  function savePosition(){try{localStorage.setItem(stateKey,JSON.stringify({surah:surahNo,ayah:selectedAyah}))}catch{}}
  function currentSurah(){return quran.find(s=>Number(s.s)===surahNo)||quran[0]}
  function setStatus(msg,show){const el=$('#mushafLoading');if(el){el.textContent=msg||'';el.hidden=!show}}
  function openSource(s,a,type,book){const u=new URL(`${QP_WEB}/embed`);u.searchParams.set('surah',s);u.searchParams.set('ayah',a);u.searchParams.set('type',type);u.searchParams.set('book',book===TAFSIR_BOOK?TAFSIR_QP_BOOK_ID:book);u.searchParams.set('theme','dark');u.searchParams.set('bg','transparent');u.searchParams.set('lock','1');u.searchParams.set('ayah_text','1');return u.toString()}
  function sourceLinks(s,a){return `<div class="source-badges"><a href="${openSource(s,a,'tafsir',TAFSIR_BOOK)}" target="_blank" rel="noopener noreferrer">فتح المصدر · Quranpedia</a><a href="${QP_WEB}/book/32" target="_blank" rel="noopener noreferrer">كتاب التفسير الميسر</a><a href="${QP_WEB}/book/2919" target="_blank" rel="noopener noreferrer">كتاب أسباب النزول للواحدي</a></div>`}
  async function getAuthoritativeTajweed(s,a){try{return await CONTENT?.getTajweed?.(s,a)||null}catch{return null}}
  function prefetchStudy(s,a){Promise.allSettled([CONTENT?.getBookContent?.(s,a,TAFSIR_BOOK),CONTENT?.getBookContent?.(s,a,MEANINGS_BOOK),CONTENT?.getBookContent?.(s,a,ASBAB_BOOK),getAuthoritativeTajweed(s,a)])}
  function normalizeClass(el){return (el.getAttribute('class')||'').trim().split(/\s+/)[0]||''}
  const ARABIC_MARKS=/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,PAUSE_MARKS=/[ۖۗۘۙۚۛۜ۝۞]/g;
  function baseLetters(t){return String(t||'').normalize('NFC').replace(ARABIC_MARKS,'').replace(/ٱ/g,'ا')}
  function stripPause(t){return String(t||'').replace(PAUSE_MARKS,'').replace(/\s+/g,' ').trim()}
  function firstBase(word){const chars=[...String(word||'')];for(let i=0;i<chars.length;i++){ARABIC_MARKS.lastIndex=0;if(!ARABIC_MARKS.test(chars[i]))return i}return 0}
  function lastBase(word){const chars=[...String(word||'')];for(let i=chars.length-1;i>=0;i--){ARABIC_MARKS.lastIndex=0;if(!ARABIC_MARKS.test(chars[i]))return i}return chars.length-1}
  function addShadda(word){const c=[...String(word||'')],i=firstBase(word);if(!c[i])return word;if(c[i+1]==='ّ')return word;c.splice(i+1,0,'ّ');return c.join('')}
  function prepareLeft(word){const c=[...String(word||'')],i=lastBase(word);if(i<0)return null;if(c[i]==='ن'){const marks=c.slice(i+1).join('');if(marks===''||marks.includes('ْ')){c.splice(i,1);return c.join('')}}const marks=c.slice(i+1).join('');if(/[ًٌٍ]/.test(marks)){const vowel=marks.includes('ً')?'َ':marks.includes('ٌ')?'ُ':'ِ';return c.slice(0,i+1).join('')+vowel}return null}
  function parseRules(html,words){const doc=new DOMParser().parseFromString(String(html||''),'text/html'),arr=[];const visit=(node,rule='')=>{if(node.nodeType===Node.TEXT_NODE){node.nodeValue.split(/\s+/).filter(Boolean).forEach(part=>arr.push({text:part,rule}));return}const own=node.nodeType===Node.ELEMENT_NODE&&node.tagName.toLowerCase()==='tajweed'?normalizeClass(node):rule;node.childNodes.forEach(ch=>visit(ch,own))};visit(doc.body);const map=new Map();if(arr.length===words.length)arr.forEach((x,i)=>map.set(i,x.rule||''));return map}
  function buildConnectedPronunciation(text,html){
    const words=stripPause(text).split(/\s+/).filter(Boolean),rules=parseRules(html,words),out=[],joins=[];
    for(let i=0;i<words.length;i++){
      let merged=false;if(i<words.length-1){const rule=rules.get(i+1)||'',explicit=/^idgham_(ghunnah|wo_ghunnah|no_ghunnah)|idgham_mutajanisayn|idgham_mutaqaribayn$/.test(rule);if(explicit){const left=prepareLeft(words[i]);const right=words[i+1];if(left){const result=left+addShadda(right);out.push(result);joins.push({from:words[i],to:right,result,rule:/wo_ghunnah|no_ghunnah/.test(rule)?'إدغام بغير غنة':'إدغام بغنة'});i++;merged=true}}}if(!merged)out.push(words[i])}
    return {text:out.join(' '),joins};
  }
  function renderTajweed(box,data,v){
    const connected=buildConnectedPronunciation(v.text,data.html),joins=connected.joins.map(j=>`<li><b>${esc(j.from)} + ${esc(j.to)}</b><span>→</span><strong>${esc(j.result)}</strong><small>${esc(j.rule)}</small></li>`).join('');
    box.innerHTML=`<div class="mushaf-note">التجويد المعروض هنا مأخوذ من نص تجويد مُعلَّم من مصدر مرجعي. لا نُنشئ حكمًا بالتخمين.</div><section class="tajweed-dagger-card"><b>ألف خنجرية (ٰ)</b><p>علامة صغيرة تُكتب فوق بعض الحروف في الرسم العثماني، وتمثل ألفًا غير مكتوبة في أصل الكلمة وتُقرأ ألفًا في موضعها. وجودها لا يعني إضافة حرف جديد إلى نص المصحف.</p><div class="tajweed-dagger-example">مثال العلامة: هَٰذَا</div></section><section class="connected-pronunciation"><div class="connected-pronunciation-head"><h4>◌️ النطق عند الوصل</h4><span>تمثيل تعليمي فقط عند وجود إدغام معلَّم صراحةً في المصدر</span></div><div class="connected-pronunciation-text">${esc(connected.text)}</div>${joins?`<ul class="connected-joins">${joins}</ul>`:'<p class="connected-empty">لا توجد مواضع وصل كتابي مدمجة معلَّمة صراحةً في هذه الآية.</p>'}<div class="connected-disclaimer">التمثيل الكتابي لا يغني عن السماع من قارئ متقن، ولا يغيّر نص الآية الأصلي.</div></section><div class="ayah-tajweed-text">${data.html}</div><div class="ayah-taj-source">المصدر: ${esc(data.source)}</div><div id="tajInspector" class="taj-inspector"><b>اضغط على الحكم الملوّن</b><p>سيظهر اسم الحكم وشرحه المختصر.</p></div>`;
    const els=box.querySelectorAll('tajweed[class]');els.forEach(el=>{const cls=normalizeClass(el);if(el.textContent.includes('ٰ')){el.setAttribute('title','ألف خنجرية (ٰ) — اضغط لعرض الشرح');el.setAttribute('aria-label','ألف خنجرية');}el.onclick=()=>{els.forEach(x=>x.classList.remove('selected'));el.classList.add('selected');const info=(el.textContent.includes('ٰ')?['ألف خنجرية (ٰ)','علامة من علامات الرسم العثماني تُقرأ ألفًا في موضعها. وهي ليست حرفًا زائدًا يُضاف إلى نص المصحف.']:tajInfo(cls)),ins=$('#tajInspector');if(ins)ins.innerHTML=`<b>${esc(info[0])}</b><p>${esc(info[1])}</p><small>الوسم المصدر: ${esc(cls)}</small>`}});
  }
  function renderIndex(){const box=$('#mushafSurahList');if(!box)return;const q=($('#mushafSearch')?.value||'').trim();const list=quran.filter(s=>!q||String(s.s)===q||String(s.name).includes(q));box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count} آيات</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';box.querySelectorAll('[data-sura]').forEach(b=>b.onclick=()=>{surahNo=Number(b.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)})}
  function renderSurah(scroll=false){const s=currentSurah();if(!s)return;$('#mushafSurahTitle').textContent=s.name;$('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;const box=$('#mushafVerses');box.innerHTML=s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a} · رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button type="button" class="action info" data-study="${v.a}">◈ دراسة الآية</button><button type="button" class="action" data-play="${v.a}">♫ استماع</button><button type="button" class="action" data-mark="${v.a}">${Number(v.a)===selectedAyah?'⌖ محددة':'⌖ تحديد'}</button></div></article>`).join('');box.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));box.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));box.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{selectedAyah=Number(b.dataset.mark);savePosition();renderSurah();toast(`تم تحديد ${s.name} · الآية ${selectedAyah}`)});if(scroll)document.querySelector('#mushafTop')?.scrollIntoView({behavior:'smooth',block:'start'})}
  function renderStudyShell(s,v){const panel=$('#ayahStudyPanel');if(!panel)return;panel.hidden=false;panel.innerHTML=`<div class="ayah-study-head"><div><div class="ayah-study-kicker">أدوات الآية</div><h3>◈ ${esc(s.name)} · الآية ${v.a}</h3><p>${esc(v.text)}</p></div><div class="ayah-study-head-actions"><button type="button" class="action info" id="studyListenBtn">♫ استماع</button><button type="button" class="action" id="studyOfflineBtn">↓ تجهيز الدراسة أوفلاين</button><button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button></div></div><div class="ayah-study-tabs" role="tablist"><button type="button" class="ayah-study-tab active" data-tab="overview">نظرة عامة</button><button type="button" class="ayah-study-tab" data-tab="tafsir">◈ التفسير</button><button type="button" class="ayah-study-tab" data-tab="meanings">⌕ معاني الكلمات</button><button type="button" class="ayah-study-tab" data-tab="tajweed">♫ التجويد</button><button type="button" class="ayah-study-tab" data-tab="asbab">◇️ سبب النزول</button></div><div id="ayahStudyInner"></div>`;$('#closeMushafStudy').onclick=()=>{panel.hidden=true;selectedAyah=0;savePosition();renderSurah()};$('#studyListenBtn').onclick=()=>playAyah(s.s,v.a);$('#studyOfflineBtn').onclick=()=>prepareStudyOffline(s.s,v.a);panel.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panel.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x===b));renderStudyBody(s,v)});renderStudyBody(s,v);panel.scrollIntoView({behavior:'smooth',block:'start'})}
  async function prepareStudyOffline(s,a){
    if(!CONTENT)return toast('إدارة المحتوى غير متاحة');
    const btn=$('#studyOfflineBtn');
    if(!navigator.onLine){
      const status=await CONTENT.offlineStatus?.();
      const ready=Boolean(status?.study?.['2012']&&status?.study?.['2013']&&status?.study?.['2919']&&status?.tajweed);
      if(btn)btn.textContent=ready?'✓ الدراسة جاهزة أوفلاين':'⚠️ تحتاج تجهيزًا عند توفر الإنترنت';
      return toast(ready?'المصحف والدراسة جاهزان دون اتصال ✓':'ارجع للاتصال بالإنترنت مرة واحدة لتجهيز المواد العلمية');
    }
    if(btn){btn.disabled=true;btn.textContent='… تجهيز المحتوى العلمي…'}
    try{
      const result=await CONTENT.ensureOfflineCore?.({force:false});
      const ready=Boolean(result?.ready);
      if(btn)btn.textContent=ready?'✓ الدراسة جاهزة أوفلاين':'⚠️ اكتمل تجهيز المتاح';
      toast(ready?'تم تجهيز الدراسة كاملة للعمل دون اتصال ✓':'تم حفظ المواد التي توفرت؛ أعد المحاولة لإكمال التجهيز');
    }catch{if(btn)btn.textContent='⚠️ تعذر التجهيز';toast('تعذر تجهيز المحتوى الآن؛ ستظل الدراسة تعمل أونلاين عند الحاجة')}finally{if(btn)btn.disabled=false}
  }
  function loading(box,msg='جارٍ جلب المادة العلمية…'){box.innerHTML=`<div class="mushaf-note">${esc(msg)}</div><div class="study-skeleton"><i></i><i></i><i></i></div>`}
  async function renderBook(box,s,a,book,title){loading(box);const data=await CONTENT?.getBookContent(s,a,book);if(!data){box.innerHTML=`<section class="ayah-detail"><h4>${esc(title)}</h4><p>المادة غير متاحة الآن. عند الاتصال بالإنترنت سيحاول رفيق القرآن جلبها وحفظها، وإذا تم تجهيز حزمة الدراسة مسبقًا فستعمل أيضًا دون اتصال.</p><div class="source-badges"><a href="${openSource(s,a,book===ASBAB_BOOK?'asbab':book===MEANINGS_BOOK?'meanings':'tafsir',book)}" target="_blank" rel="noopener noreferrer">فتح المصدر في Quranpedia</a></div></section>`;return}box.innerHTML=`<section class="ayah-detail quranpedia-direct-card"><div class="source-kicker">${esc(title)}</div><div class="source-content">${esc(data.text).replace(/\n\n/g,'</p><p>') ? `<p>${esc(data.text).replace(/\n\n/g,'</p><p>')}</p>`:''}</div><div class="quranpedia-source-note">المصدر: Quranpedia · ${esc(data.book?.name||CONTENT.BOOKS?.[book]?.name||'الموسوعة القرآنية')}</div>${sourceLinks(s,a)}</section>`}
  async function renderStudyBody(s,v){const box=$('#ayahStudyInner');if(!box)return;if(studyTab==='tajweed'){loading(box);const data=await getAuthoritativeTajweed(s.s,v.a);if(data?.html)renderTajweed(box,data,v);else box.innerHTML='<section class="ayah-detail"><h4>♫ التجويد</h4><p>لم تتوفر الآن بيانات التجويد المعلَّمة من المصدرين المرجعيين. لن نعرض تحليلًا تقديريًا مكانها.</p><div class="source-badges"><a href="https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?verse_key='+encodeURIComponent(`${s.s}:${v.a}`)+'" target="_blank" rel="noopener noreferrer">Quran Foundation</a><a href="https://alquran.cloud/tajweed-guide" target="_blank" rel="noopener noreferrer">Al Quran Cloud</a></div></section>';return}if(studyTab==='overview'){box.innerHTML=`<div class="ayah-detail-grid"><section class="ayah-detail"><h4>◈ التفسير</h4><p>التفسير الميسر من Quranpedia.</p></section><section class="ayah-detail"><h4>⌕ معاني الكلمات</h4><p>معاني الكلمات من كتاب السراج في بيان غريب القرآن.</p></section><section class="ayah-detail"><h4>◇️ سبب النزول</h4><p>أسباب النزول من كتاب الواحدي عند وجود رواية مرتبطة بالآية.</p></section><section class="ayah-detail"><h4>♫ التجويد</h4><p>نص تجويد معلَّم من المصدر المرجعي، من دون تخمين للحكم.</p></section></div>${sourceLinks(s.s,v.a)}`;return}const book=studyTab==='tafsir'?TAFSIR_BOOK:studyTab==='meanings'?MEANINGS_BOOK:ASBAB_BOOK;const title=studyTab==='tafsir'?'◈ التفسير الميسر':studyTab==='meanings'?'⌕ معاني الكلمات':'◇️ أسباب النزول — الواحدي';return renderBook(box,s.s,v.a,book,title)}
  async function openStudy(s,a){const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';savePosition();renderIndex();renderSurah();prefetchStudy(s,a);renderStudyShell(su,v)}
  window.openAyahStudy=openStudy;
  async function playAyah(s,a){const list=window.RAFIQ_RECITERS||[],pref=window.RAFIQ_API?.state?.prefs?.reciter||window.RAFIQ_API?.state?.audio?.reciter,r=list.find(x=>x.folder===pref)||list[0],audio=$('#quranAudio');if(!r||!audio)return toast('اختر قارئًا من صفحة التلاوات أولًا.');const url=r.source==='mp3quran'?`${r.server}${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;const playable=await CONTENT?.getPlayableAudio(url)||url;audio.src=playable;audio.currentTime=0;audio.play().then(()=>toast(`بدأت تلاوة الآية ${a}`)).catch(()=>toast('التلاوة تحتاج اتصالًا أو تنزيلًا مسبقًا.'))}
  function init(){if(!$('#view-quran'))return;const start=()=>{const data=window.RAFIQ_API?.quran||[];if(data.length<114){setStatus('… جاري تجهيز بيانات المصحف…',true);return}quran=data;setStatus('',false);renderIndex();renderSurah()};$('#mushafSearch')?.addEventListener('input',renderIndex);$('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});$('#mushafTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));window.addEventListener('rafiq-quran-ready',start,{once:true});document.addEventListener('rafiq-data-ready',start,{once:true});if(window.RAFIQ_API?.quran?.length)start()}
  init();
})();
