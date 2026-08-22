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
  function normalizeClass(el){
    const classes=Array.from(el?.classList||[]).map(x=>String(x).trim()).filter(Boolean);
    const aliases={
      'idgham-with-ghunnah':'idgham_ghunnah',
      'idgham-ghunnah':'idgham_ghunnah',
      'idgham-without-ghunnah':'idgham_wo_ghunnah',
      'idgham-with-no-ghunnah':'idgham_no_ghunnah',
      'idgham-no-ghunnah':'idgham_no_ghunnah',
      'ikhfa-shafawi':'ikhfa_shafawi',
      'idgham-shafawi':'idgham_shafawi',
      'idgham-mutajanisayn':'idgham_mutajanisayn',
      'idgham-mutaqaribayn':'idgham_mutaqaribayn',
      'madda-normal':'madda_normal',
      'madda-permissible':'madda_permissible',
      'madda-obligatory':'madda_obligatory',
      'madda-necessary':'madda_necessary',
      'laam-shamsiyah':'laam_shamsiyah',
      'ham-wasl':'ham_wasl',
      'qalqalah':'qalqalah',
      'ghunnah':'ghunnah',
      'ikhfa':'ikhfa',
      'iqlab':'iqlab',
      'silent':'silent'
    };
    for(const cls of classes){
      if(aliases[cls]) return aliases[cls];
      if(TAJWEED_RULES[cls]) return cls;
      const normalized=cls.replace(/-/g,'_');
      if(TAJWEED_RULES[normalized]) return normalized;
    }
    return classes[0]||'';
  }
  function stripArabicSpacing(v){return String(v||'').replace(/\s+/gu,' ').trim()}
  function buildConnectedPronunciation(original,tajweedHtml){
    const text=stripArabicSpacing(original);
    const html=String(tajweedHtml||'');
    const joins=[];
    const words=text.split(' ');
    const out=[];
    const hasExplicitNoGhunnah=/idgham(?:_|-|\s)[^>]*(?:without|no)[^>]*ghunnah|idgham_?(?:wo|no)_ghunnah/i.test(html);
    const hasExplicitGhunnah=/idgham(?:_|-|\s)[^>]*(?:with|ghunnah)/i.test(html);
    for(let i=0;i<words.length;i++){
      const cur=words[i], next=words[i+1]||'';
      const noGhunnahTarget=/^[لر]/u.test(next);
      const nunEnding=/ن(?:ْ|ّ?ً|ّ?ٍ|ّ?ٌ)?$/u.test(cur);
      if((hasExplicitNoGhunnah||noGhunnahTarget) && noGhunnahTarget && nunEnding){
        const merged=cur.replace(/ن(?:ْ|ّ?ً|ّ?ٍ|ّ?ٌ)?$/u,'')+next;
        out.push(merged);
        joins.push({from:cur,to:next,result:merged,rule:'إدغام بغير غنة: يُدغم صوت النون الساكنة أو التنوين في اللام أو الراء عند الوصل.'});
        i++;
        continue;
      }
      out.push(cur);
    }
    // Preserve only conservative, source-supported joins. We do not invent a phonetic spelling for other rules.
    const joinedText=out.join(' ');
    if(!joins.length || (!hasExplicitNoGhunnah && !hasExplicitGhunnah && !/لَّ|رَّ/u.test(text))) return {text,joins:[]};
    return {text:joinedText,joins};
  }
  async function getAuthoritativeTajweed(s,a){
    try{return await CONTENT?.getTajweed?.(Number(s),Number(a))||null}catch{return null}
  }
  function prefetchStudy(s,a){
    if(!CONTENT)return;
    const jobs=[
      CONTENT.getBookContent?.(Number(s),Number(a),TAFSIR_BOOK),
      CONTENT.getBookContent?.(Number(s),Number(a),MEANINGS_BOOK),
      CONTENT.getBookContent?.(Number(s),Number(a),ASBAB_BOOK),
      getAuthoritativeTajweed(s,a)
    ];
    Promise.allSettled(jobs).catch(()=>{});
  }
  function savePosition(){try{localStorage.setItem(stateKey,JSON.stringify({surah:surahNo,ayah:selectedAyah}))}catch{}}
  function currentSurah(){return quran.find(s=>Number(s.s)===surahNo)||quran[0]}
  function setStatus(msg,show){const el=$('#mushafLoading');if(el){el.textContent=msg||'';el.hidden=!show}}
  function openSource(s,a,type,book){const u=new URL(`${QP_WEB}/embed`);u.searchParams.set('surah',s);u.searchParams.set('ayah',a);u.searchParams.set('type',type);u.searchParams.set('book',book===TAFSIR_BOOK?TAFSIR_QP_BOOK_ID:book);u.searchParams.set('theme','dark');u.searchParams.set('bg','transparent');u.searchParams.set('lock','1');u.searchParams.set('ayah_text','1');return u.toString()}
  function sourceLinks(s,a,book=TAFSIR_BOOK){
    const type=book===ASBAB_BOOK?'asbab':book===MEANINGS_BOOK?'meanings':'tafsir';
    const id=book===TAFSIR_BOOK?TAFSIR_QP_BOOK_ID:book;
    return `<div class="source-badges"><a href="${openSource(s,a,type,book)}" target="_blank" rel="noopener noreferrer">فتح المصدر · Quranpedia</a><a href="${QP_WEB}/book/${id}" target="_blank" rel="noopener noreferrer">صفحة الكتاب</a></div>`;
  }
  function renderTajweed(box,data,v){
    const connected=buildConnectedPronunciation(v.text,data.html);
    const joins=connected.joins.map(j=>`<li><b>${esc(j.from)} + ${esc(j.to)}</b><span>→</span><strong>${esc(j.result)}</strong><small>${esc(j.rule)}</small></li>`).join('');
    const hasKhanjaria=/\u0670/.test(String(v.text||data.html||''));
    const daggerCard=hasKhanjaria?`<section class="tajweed-dagger-card"><b>ألف خنجرية (ٰ)</b><p>هذه العلامة جزء من الرسم العثماني، وتدل على ألف تُقرأ في موضعها. نوضحها هنا تعليميًا فقط ولا نغيّر نص المصحف.</p><div class="tajweed-dagger-example">مثال: هَٰذَا</div></section>`:'';
    box.innerHTML=`<div class="mushaf-note">التجويد هنا مأخوذ من نصٍّ معلَّم من مصدر مرجعي، ونحفظ الآية بعد أول تحميل ناجح لتعمل دون اتصال. <a href="https://alquran.cloud/tajweed-guide" target="_blank" rel="noopener noreferrer">دليل التجويد ومفتاح الألوان</a></div>${daggerCard}<section class="connected-pronunciation"><div class="connected-pronunciation-head"><h4>النطق عند الوصل</h4><span>تمثيل تعليمي فقط عند وجود إدغام معلَّم صراحةً في المصدر</span></div><div class="connected-pronunciation-text">${esc(connected.text)}</div>${joins?`<ul class="connected-joins">${joins}</ul>`:'<p class="connected-empty">لا توجد مواضع وصل كتابي مدمجة معلَّمة صراحةً في هذه الآية.</p>'}<div class="connected-disclaimer">التمثيل الكتابي لا يغيّر نص الآية الأصلي، ولا يغني عن السماع من قارئ متقن.</div></section><div class="ayah-tajweed-text">${data.html}</div><div class="ayah-taj-source">المصدر: ${esc(data.source)}</div><div id="tajInspector" class="taj-inspector"><b>اضغط على الحكم الملوّن</b><p>سيظهر اسم الحكم وشرحه المختصر.</p></div>`;
    const els=box.querySelectorAll('tajweed[class]');
    els.forEach(el=>{
      const cls=normalizeClass(el);
      const isDagger=el.textContent.includes('ٰ');
      if(isDagger){el.setAttribute('title','ألف خنجرية (ٰ) — اضغط لعرض الشرح');el.setAttribute('aria-label','ألف خنجرية');}
      else el.setAttribute('title',tajInfo(cls)[0]);
      el.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopPropagation();
        els.forEach(x=>x.classList.remove('selected'));
        el.classList.add('selected');
        const info=isDagger?['ألف خنجرية (ٰ)','علامة من علامات الرسم العثماني تُقرأ ألفًا في موضعها.']:tajInfo(cls);
        const ins=box.querySelector('#tajInspector');
        if(ins)ins.innerHTML=`<b>${esc(info[0])}</b><p>${esc(info[1])}</p>`;
      });
    });
  }
  function renderIndex(){const box=$('#mushafSurahList');if(!box)return;const q=($('#mushafSearch')?.value||'').trim();const list=quran.filter(s=>!q||String(s.s)===q||String(s.name).includes(q));box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count} آيات</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';box.querySelectorAll('[data-sura]').forEach(b=>b.onclick=()=>{surahNo=Number(b.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)})}
  function renderSurah(scroll=false){const s=currentSurah();if(!s)return;$('#mushafSurahTitle').textContent=s.name;$('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;const box=$('#mushafVerses');box.innerHTML=s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a} · رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button type="button" class="action info" data-study="${v.a}">📖 دراسة الآية</button><button type="button" class="action" data-play="${v.a}">🔊 استماع</button><button type="button" class="action" data-mark="${v.a}">${Number(v.a)===selectedAyah?'📌 محددة':'📍 تحديد'}</button></div></article>`).join('');box.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));box.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));box.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{selectedAyah=Number(b.dataset.mark);savePosition();renderSurah();toast(`تم تحديد ${s.name} · الآية ${selectedAyah}`)});if(scroll)document.querySelector('#mushafTop')?.scrollIntoView({behavior:'smooth',block:'start'})}
  function renderStudyShell(s,v){const panel=$('#ayahStudyPanel');if(!panel)return;panel.hidden=false;panel.innerHTML=`<div class="ayah-study-head"><div><div class="ayah-study-kicker">أدوات الآية</div><h3>📖 ${esc(s.name)} · الآية ${v.a}</h3><p>${esc(v.text)}</p></div><div class="ayah-study-head-actions"><button type="button" class="action info" id="studyListenBtn">🔊 استماع</button><button type="button" class="action" id="studyOfflineBtn">📥 تجهيز الدراسة أوفلاين</button><button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button></div></div><div class="ayah-study-tabs" role="tablist"><button type="button" class="ayah-study-tab active" data-tab="overview">نظرة عامة</button><button type="button" class="ayah-study-tab" data-tab="tafsir">📖 التفسير</button><button type="button" class="ayah-study-tab" data-tab="meanings">🔎 معاني الكلمات</button><button type="button" class="ayah-study-tab" data-tab="tajweed">🎙️ التجويد</button><button type="button" class="ayah-study-tab" data-tab="asbab">🕊️ سبب النزول</button></div><div id="ayahStudyInner"></div>`;$('#closeMushafStudy').onclick=()=>{panel.hidden=true;selectedAyah=0;savePosition();renderSurah()};$('#studyListenBtn').onclick=()=>playAyah(s.s,v.a);$('#studyOfflineBtn').onclick=()=>prepareStudyOffline(s.s,v.a);panel.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panel.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x===b));renderStudyBody(s,v)});renderStudyBody(s,v);panel.scrollIntoView({behavior:'smooth',block:'start'})}
  async function prepareStudyOffline(s,a){
    if(!CONTENT)return toast('إدارة المحتوى غير متاحة');
    const btn=$('#studyOfflineBtn');
    if(!navigator.onLine){
      const status=await CONTENT.offlineStatus?.();
      const ready=Boolean(status?.study?.['2012']&&status?.study?.['2013']&&status?.study?.['2919']&&status?.tajweed);
      if(btn)btn.textContent=ready?'✓ الدراسة جاهزة أوفلاين':'⚠️ تحتاج تجهيزًا عند توفر الإنترنت';
      return toast(ready?'المصحف والدراسة جاهزان دون اتصال ✅':'ارجع للاتصال بالإنترنت مرة واحدة لتجهيز المواد العلمية');
    }
    if(btn){btn.disabled=true;btn.textContent='⏳ تجهيز المحتوى العلمي…'}
    try{
      const result=await CONTENT.ensureOfflineCore?.({force:false});
      const ready=Boolean(result?.ready);
      if(btn)btn.textContent=ready?'✓ الدراسة جاهزة أوفلاين':'⚠️ اكتمل تجهيز المتاح';
      toast(ready?'تم تجهيز الدراسة كاملة للعمل دون اتصال ✅':'تم حفظ المواد التي توفرت؛ أعد المحاولة لإكمال التجهيز');
    }catch{if(btn)btn.textContent='⚠️ تعذر التجهيز';toast('تعذر تجهيز المحتوى الآن؛ ستظل الدراسة تعمل أونلاين عند الحاجة')}finally{if(btn)btn.disabled=false}
  }
  function loading(box,msg='جارٍ جلب المادة العلمية…'){box.innerHTML=`<div class="mushaf-note">${esc(msg)}</div><div class="study-skeleton"><i></i><i></i><i></i></div>`}
  function studyEmbedUrl(s,a,book){
    const type=book===ASBAB_BOOK?'asbab':book===MEANINGS_BOOK?'meanings':'tafsir';
    const id=book===TAFSIR_BOOK?TAFSIR_QP_BOOK_ID:book;
    const u=new URL(`${QP_WEB}/embed`);
    u.searchParams.set('surah',s);u.searchParams.set('ayah',a);u.searchParams.set('type',type);u.searchParams.set('book',id);
    u.searchParams.set('theme','dark');u.searchParams.set('bg','transparent');u.searchParams.set('lock','1');u.searchParams.set('ayah_text','1');
    return u.toString();
  }
  function renderBookFrame(box,s,a,book,title){
    const src=studyEmbedUrl(s,a,book);
    box.innerHTML=`<section class="ayah-detail quranpedia-direct-card"><div class="source-kicker">${esc(title)}</div><iframe class="quranpedia-study-frame" title="${esc(title)}" src="${esc(src)}" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="quranpedia-source-note">المصدر المباشر: Quranpedia</div>${sourceLinks(s,a,book)}</section>`;
  }
  async function renderBook(box,s,a,book,title){
    loading(box);
    const data=await CONTENT?.getBookContent?.(s,a,book);
    if(!data){
      if(navigator.onLine){renderBookFrame(box,s,a,book,title);return;}
      box.innerHTML=`<section class="ayah-detail"><h4>${esc(title)}</h4><p>المادة غير محفوظة على جهازك بعد. جهّز المواد العلمية من الإعدادات مرة واحدة عند توفر الإنترنت.</p>${sourceLinks(s,a,book)}</section>`;
      return;
    }
    const paragraphs=String(data.text||'').split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join('');
    box.innerHTML=`<section class="ayah-detail quranpedia-direct-card"><div class="source-kicker">${esc(title)}</div><div class="source-content">${paragraphs||'<p>لا يوجد نص متاح لهذه الآية في الكتاب.</p>'}</div><div class="quranpedia-source-note">المصدر: Quranpedia · ${esc(data.book?.name||CONTENT.BOOKS?.[book]?.name||'الموسوعة القرآنية')}</div>${sourceLinks(s,a,book)}</section>`;
  }
  async function renderStudyBody(s,v){
    const box=$('#ayahStudyInner');if(!box)return;
    if(studyTab==='tajweed'){
      loading(box,'جارٍ تجهيز التجويد المعلَّم…');
      const data=await getAuthoritativeTajweed(s.s,v.a);
      if(data?.html){renderTajweed(box,data,v);return;}
      box.innerHTML=`<section class="ayah-detail"><h4>التجويد</h4><p>تعذر تحميل النص التجويدي المعلَّم حاليًا. لن نعرض تحليلًا تقديريًا بدل المصدر المرجعي.</p><div class="source-badges"><a href="https://alquran.cloud/tajweed-guide" target="_blank" rel="noopener noreferrer">دليل التجويد من Al Quran Cloud</a></div></section>`;
      return;
    }
    if(studyTab==='overview'){
      loading(box,'جارٍ تجهيز التفسير والمعاني وسبب النزول…');
      const items=await Promise.all([
        CONTENT?.getBookContent?.(s.s,v.a,TAFSIR_BOOK),
        CONTENT?.getBookContent?.(s.s,v.a,MEANINGS_BOOK),
        CONTENT?.getBookContent?.(s.s,v.a,ASBAB_BOOK)
      ]);
      const defs=[[TAFSIR_BOOK,'التفسير الميسر'],[MEANINGS_BOOK,'معاني الكلمات'],[ASBAB_BOOK,'سبب النزول']];
      box.innerHTML=`<div class="ayah-detail-grid">${items.map((data,i)=>{
        const [book,title]=defs[i];
        const text=data?.text?String(data.text).split(/\n{2,}/).filter(Boolean).slice(0,2).map(x=>`<p>${esc(x)}</p>`).join(''):`<p class="study-unavailable">المادة غير متاحة حاليًا لهذه الآية.</p>`;
        return `<section class="ayah-detail"><h4>${esc(title)}</h4><div>${text}</div><button type="button" class="action study-open-tab" data-open-tab="${book===TAFSIR_BOOK?'tafsir':book===MEANINGS_BOOK?'meanings':'asbab'}">فتح القسم كاملًا</button></section>`;
      }).join('')}</div>`;
      box.querySelectorAll('[data-open-tab]').forEach(b=>b.onclick=()=>{studyTab=b.dataset.openTab;box.closest('#ayahStudyPanel')?.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===studyTab));renderStudyBody(s,v)});
      return;
    }
    const book=studyTab==='tafsir'?TAFSIR_BOOK:studyTab==='meanings'?MEANINGS_BOOK:ASBAB_BOOK;
    const title=studyTab==='tafsir'?'التفسير الميسر':studyTab==='meanings'?'معاني الكلمات':'سبب النزول — الواحدي';
    return renderBook(box,s.s,v.a,book,title);
  }
  async function openStudy(s,a){const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';savePosition();renderIndex();renderSurah();prefetchStudy(s,a);renderStudyShell(su,v)}
  window.openAyahStudy=openStudy;
  async function playAyah(s,a){const list=window.RAFIQ_RECITERS||[],pref=window.RAFIQ_API?.state?.prefs?.reciter||window.RAFIQ_API?.state?.audio?.reciter,r=list.find(x=>x.folder===pref)||list[0],audio=$('#quranAudio');if(!r||!audio)return toast('اختر قارئًا من صفحة التلاوات أولًا.');const url=r.source==='mp3quran'?`${r.server}${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;const playable=await CONTENT?.getPlayableAudio(url)||url;audio.src=playable;audio.currentTime=0;audio.play().then(()=>toast(`بدأت تلاوة الآية ${a}`)).catch(()=>toast('التلاوة تحتاج اتصالًا أو تنزيلًا مسبقًا.'))}
  let initialized=false;
  async function start(){
    if(initialized)return;
    let data=window.RAFIQ_API?.quran||[];
    // Standalone fallback: the Mushaf must not depend on another UI module having fired first.
    if(data.length<114){
      try{
        const r=await fetch('./quran-uthmani.json',{cache:'force-cache'});
        if(r.ok){const local=await r.json();if(Array.isArray(local)&&local.length===114)data=local;}
      }catch{}
    }
    if(!Array.isArray(data)||data.length<114){setStatus('⏳ جاري تجهيز بيانات المصحف…',true);return;}
    initialized=true;
    quran=data;
    setStatus('',false);
    renderIndex();
    renderSurah();
  }
  function init(){
    if(!$('#view-quran'))return;
    $('#mushafSearch')?.addEventListener('input',renderIndex);
    $('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});
    $('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});
    $('#mushafTop')?.addEventListener('click',e=>{if(e.target.closest('button,input'))return;window.scrollTo({top:0,behavior:'smooth'});});
    window.addEventListener('rafiq-quran-ready',()=>start(),{once:true});
    document.addEventListener('rafiq-data-ready',()=>start(),{once:true});
    start();
  }
  init();
})();
