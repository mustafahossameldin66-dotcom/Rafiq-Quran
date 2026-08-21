(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const toast=(msg)=>{if(typeof window.rafiqToast==='function')window.rafiqToast(msg);else{const t=$('#toast');if(t){t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}}};
  const storageKey='rafiq-mushaf-state-v1';
  const readState=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{return{}}};
  const writeState=s=>{try{localStorage.setItem(storageKey,JSON.stringify(s))}catch{}};
  const st=readState();
  let quran=[];
  let surahNo=Number(st.surah||1)||1;
  let selectedAyah=Number(st.ayah||0)||0;
  let studyTab='overview';
  let selectedChar=null;

  const ASBAB={
    '2:286':'وردت في خاتمة سورة البقرة دعوة جامعة ورفع الحرج عن المؤمنين. لا تُثبت رواية خاصة لهذه الآية إلا بمصدر معتبر.',
    '39:53':'وردت روايات في سياق نزولها وتختلف تفاصيلها؛ يُرجع إلى مصادر أسباب النزول والتخريج عند الحاجة.',
    '3:200':'السياق ختامي في السورة، وفي الآية توجيهات جامعة بالصبر والمصابرة والمرابطة والتقوى.'
  };
  const QURANPEDIA_SLUGS={
    1:'al-fatihah',2:'al-baqarah',3:'aal-i-imran',4:'an-nisa',5:'al-maidah',6:'al-anam',7:'al-araf',8:'al-anfal',9:'at-tawbah',10:'yunus',11:'hud',12:'yusuf',13:'ar-rad',14:'ibrahim',15:'al-hijr',16:'an-nahl',17:'al-isra',18:'al-kahf',19:'maryam',20:'ta-ha',21:'al-anbya',22:'al-hajj',23:'al-muminun',24:'an-nur',25:'al-furqan',26:'ash-shuara',27:'an-naml',28:'al-qasas',29:'al-ankabut',30:'ar-rum',31:'luqman',32:'as-sajdah',33:'al-ahzab',34:'saba',35:'fatir',36:'ya-sin',37:'as-saffat',38:'sad',39:'az-zumar',40:'ghafir',41:'fussilat',42:'ash-shura',43:'az-zukhruf',44:'ad-dukhan',45:'al-jathiyah',46:'al-ahqaf',47:'muhammad',48:'al-fath',49:'al-hujurat',50:'qaf',51:'adh-dhariyat',52:'at-tur',53:'an-najm',54:'al-qamar',55:'ar-rahman',56:'al-waqiah',57:'al-hadid',58:'al-mujadilah',59:'al-hashr',60:'al-mumtahanah',61:'as-saff',62:'al-jumuah',63:'al-munafiqun',64:'at-taghabun',65:'at-talaq',66:'at-tahrim',67:'al-mulk',68:'al-qalam',69:'al-haqqah',70:'al-maarij',71:'nuh',72:'al-jinn',73:'al-muzzammil',74:'al-muddaththir',75:'al-qiyamah',76:'al-insan',77:'al-mursalat',78:'an-naba',79:'an-naziat',80:'abasa',81:'at-takwir',82:'al-infitar',83:'al-mutaffifin',84:'al-inshiqaq',85:'al-buruj',86:'at-tariq',87:'al-ala',88:'al-ghashiyah',89:'al-fajr',90:'al-balad',91:'ash-shams',92:'al-layl',93:'ad-duha',94:'ash-sharh',95:'at-tin',96:'al-alaq',97:'al-qadr',98:'al-bayyinah',99:'az-zalzalah',100:'al-adiyat',101:'al-qariah',102:'at-takathur',103:'al-asr',104:'al-humazah',105:'al-fil',106:'quraysh',107:'al-maun',108:'al-kawthar',109:'al-kafirun',110:'an-nasr',111:'al-masad',112:'al-ikhlas',113:'al-falaq',114:'an-nas'
  };
  const wahidiUrl=(s,a)=>`https://quranpedia.net/tafsir/${QURANPEDIA_SLUGS[Number(s)]||''}/${Number(a)}`;
  const wahidiBookUrl='https://quranpedia.net/book/242';
  const wahidiProxy=(s,a)=>`https://r.jina.ai/http://quranpedia.net/tafsir/${QURANPEDIA_SLUGS[Number(s)]||''}/${Number(a)}`;
  const wahidiCacheKey=(s,a)=>`rafiq-wahidi-${s}-${a}`;
  async function fetchWahidi(s,a){
    const key=wahidiCacheKey(s,a);
    try{const cached=localStorage.getItem(key);if(cached)return cached}catch{}
    try{
      const r=await fetch(wahidiProxy(s,a),{cache:'force-cache'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const md=await r.text();
      let text=md;
      const markers=['## سبب نزول الآية','## سبب نزول','### سبب نزول الآية','### سبب نزول'];
      let start=-1;for(const m of markers){const i=md.indexOf(m);if(i>=0){start=i+m.length;break;}}
      if(start>=0){let end=md.length;for(const m of ['## تفسير','## سورة','## الآية','### تفسير','### سورة']){const i=md.indexOf(m,start);if(i>start)end=Math.min(end,i)}text=md.slice(start,end).trim();}
      text=text.replace(/\n{3,}/g,'\n\n').replace(/\[\d+\]/g,'').trim();
      if(text.length>80){try{localStorage.setItem(key,text)}catch{}return text;}
    }catch{}
    return '';
  }
  const TAJ_RULES={
    'الإظهار الحلقي':'النون الساكنة أو التنوين قبل ء هـ ع ح غ خ: تُقرأ النون أو التنوين بوضوح.',
    'الإدغام بغنة':'النون الساكنة أو التنوين قبل ي ن م و: يدخل صوت النون في الحرف التالي مع غنة.',
    'الإدغام بغير غنة':'النون الساكنة أو التنوين قبل ل أو ر: إدغام من غير غنة مستقلة.',
    'الإقلاب':'النون الساكنة أو التنوين قبل الباء: تُقلب ميمًا مخفاة مع غنة.',
    'الإخفاء الحقيقي':'النون الساكنة أو التنوين قبل أحد حروف الإخفاء: صوت بين الإظهار والإدغام مع غنة.',
    'الإخفاء الشفوي':'ميم ساكنة بعدها باء: إخفاء مع غنة.',
    'الإدغام الشفوي':'ميم ساكنة بعدها ميم: إدغام مع غنة.',
    'الإظهار الشفوي':'ميم ساكنة بعدها غير الباء والميم: إظهار الميم.',
    'غنة النون المشددة':'النون المشددة فيها غنة ثابتة مقدارها حركتان.',
    'غنة الميم المشددة':'الميم المشددة فيها غنة ثابتة مقدارها حركتان.',
    'القلقلة':'حروف ق ط ب ج د إذا كانت ساكنة: يظهر ارتداد لطيف بلا إضافة حركة.',
    'تفخيم حروف الاستعلاء':'حروف خص ضغط قظ لها أصل التفخيم، وتختلف درجته بحسب الحركة والسياق.',
    'المد الطبيعي':'حرف مد لا يليه همز أو سكون موجب للمد الفرعي؛ الأصل مدّه حركتين.',
    'الهمزة':'انتبه لموضع الهمزة ومخرجها ولا تسقطها في السرعة.',
    'همزة الوصل':'تُقرأ عند الابتداء وتسقط في الوصل بحسب الموضع.',
    'همزة القطع':'تثبت في الابتداء والوصل.'
  };
  const heavy=new Set('خصضغطقظ');
  const qalq=new Set('قطبجد');
  function graphemes(text){
    const out=[]; let cur=null;
    for(const ch of String(text||'')){
      if(/[ء-يٱ]/.test(ch)){cur={b:ch,m:[],raw:ch};out.push(cur)}
      else if(/[ًٌٍَُِّْٰٔٱ]/.test(ch)&&cur){cur.m.push(ch);cur.raw+=ch}
      else if(/\s/.test(ch)) out.push({space:true,raw:ch});
      else out.push({punct:true,raw:ch});
    }
    return out;
  }
  function prev(t,i){for(let j=i-1;j>=0;j--)if(!t[j].space&&!t[j].punct)return j;return -1}
  function next(t,i){for(let j=i+1;j<t.length;j++)if(!t[j].space&&!t[j].punct)return j;return -1}
  function haraka(m){
    if(m.includes('َ'))return'فتحة — صوت قصير «ـَ»';
    if(m.includes('ُ'))return'ضمة — صوت قصير «ـُ»';
    if(m.includes('ِ'))return'كسرة — صوت قصير «ـِ»';
    if(m.includes('ْ'))return'سكون — لا حركة بعد الحرف';
    if(m.includes('ّ'))return'شدة — الحرف قوي ومشدّد';
    if(m.includes('ٰ'))return'ألف خنجرية — صوت مد الألف';
    if(m.includes('ً'))return'تنوين فتح';
    if(m.includes('ٌ'))return'تنوين ضم';
    if(m.includes('ٍ'))return'تنوين كسر';
    return'لا حركة مكتوبة على هذا الحرف';
  }
  function tajFor(t,i){
    const g=t[i],r=[]; if(!g||g.space||g.punct)return r; const p=prev(t,i),n=next(t,i),nb=n>=0?t[n].b:''; const add=x=>{if(!r.includes(x))r.push(x)};
    if(g.b==='ن'&&(g.m.includes('ْ')||g.m.some(x=>['ً','ٌ','ٍ'].includes(x)))){
      if('ءأإٱهـعحغخ'.includes(nb))add('الإظهار الحلقي');
      else if('ينمو'.includes(nb))add('الإدغام بغنة');
      else if('لر'.includes(nb))add('الإدغام بغير غنة');
      else if(nb==='ب')add('الإقلاب');
      else if('تثجدذزسشصضطظفقك'.includes(nb))add('الإخفاء الحقيقي');
    }
    if(g.b==='م'&&g.m.includes('ْ')){if(nb==='ب')add('الإخفاء الشفوي');else if(nb==='م')add('الإدغام الشفوي');else add('الإظهار الشفوي')}
    if(g.b==='ن'&&g.m.includes('ّ'))add('غنة النون المشددة');
    if(g.b==='م'&&g.m.includes('ّ'))add('غنة الميم المشددة');
    if(qalq.has(g.b)&&g.m.includes('ْ'))add('القلقلة');
    if(heavy.has(g.b))add('تفخيم حروف الاستعلاء');
    if(g.b==='ٱ')add('همزة الوصل');
    if('أإؤئ'.includes(g.b))add('همزة القطع');
    if(g.m.includes('ٰ'))add('المد الطبيعي');
    if(g.b==='ا'&&p>=0&&t[p].m.includes('َ'))add('المد الطبيعي');
    if(g.b==='و'&&g.m.includes('ْ')&&p>=0&&t[p].m.includes('ُ'))add('المد الطبيعي');
    if(g.b==='ي'&&g.m.includes('ْ')&&p>=0&&t[p].m.includes('ِ'))add('المد الطبيعي');
    return r;
  }
  function currentSurah(){return quran.find(s=>Number(s.s)===surahNo)||quran[0]}
  function sourceLinks(s,a){return `<div class="source-badges"><a href="https://quranenc.com/ar/browse/arabic_moyassar/${s}/${a}" target="_blank" rel="noopener noreferrer">📖 التفسير الميسر</a><a href="https://quranenc.com/ar/browse/arabic_seraj/${s}/${a}" target="_blank" rel="noopener noreferrer">🔎 معاني الكلمات</a><a href="https://corpus.quran.com/wordbyword.jsp?chapter=${s}&verse=${a}" target="_blank" rel="noopener noreferrer">🧩 التحليل اللغوي</a></div>`}
  function setStatus(msg,show){const el=$('#mushafLoading');if(el){el.textContent=msg||'';el.hidden=!show}}
  function savePosition(){writeState({surah:surahNo,ayah:selectedAyah})}
  function renderIndex(){
    const box=$('#mushafSurahList'); if(!box)return;
    const query=($('#mushafSearch')?.value||'').trim();
    const list=quran.filter(s=>!query||String(s.s)===query||String(s.name).includes(query));
    box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count}</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';
    box.querySelectorAll('[data-sura]').forEach(btn=>btn.onclick=()=>{surahNo=Number(btn.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)});
  }
  function renderSurah(scroll=false){
    const s=currentSurah(); if(!s)return;
    $('#mushafSurahTitle').textContent=s.name;
    $('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;
    const verseBox=$('#mushafVerses');
    verseBox.innerHTML=s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a} · رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button type="button" class="action info" data-study="${v.a}">📖 دراسة الآية</button><button type="button" class="action" data-play="${v.a}">🔊 استماع</button><button type="button" class="action" data-mark="${v.a}">${Number(v.a)===selectedAyah?'📌 محدد':'📍 تحديد'}</button></div></article>`).join('');
    verseBox.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));
    verseBox.querySelectorAll('.mushaf-ayah-text').forEach(el=>el.onclick=()=>openStudy(s.s,Number(el.closest('.mushaf-ayah').dataset.ayah))); 
    verseBox.querySelectorAll('.mushaf-ayah-text').forEach(el=>el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStudy(s.s,Number(el.closest('.mushaf-ayah').dataset.ayah))}});
    verseBox.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{selectedAyah=Number(b.dataset.mark);savePosition();renderSurah();toast(`تم تحديد ${s.name} · الآية ${selectedAyah}`)});
    verseBox.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));
    $('#mushafPrev').disabled=s.s<=1; $('#mushafNext').disabled=s.s>=114;
    if(scroll){window.scrollTo({top:0,behavior:'smooth'})}
  }
  async function fetchTafsir(s,a){
    const key=`rq-mushaf-tafsir-${s}-${a}`;
    try{const cached=localStorage.getItem(key);if(cached)return cached}catch{}
    try{
      setStatus('⏳ جاري جلب التفسير…',true);
      const r=await fetch(`https://quranenc.com/api/v1/translation/aya/arabic_moyassar/${s}/${a}`,{cache:'no-store'});
      if(r.ok){const j=await r.json();const t=j?.result?.translation||j?.data?.translation||j?.translation||'';if(t){try{localStorage.setItem(key,t)}catch{};return t}}
    }catch{}
    return 'تعذر جلب التفسير الآن. افتح المصدر الموثق عند توفر الاتصال وسيعمل التطبيق مجددًا عند عودة الشبكة.';
  }
  function renderStudyShell(s,v){
    const panel=$('#ayahStudyPanel');
    panel.hidden=false; panel.innerHTML=`<div class="ayah-study-head"><div><div class="ayah-study-kicker">أدوات الآية</div><h3>📖 ${esc(s.name)} · الآية ${v.a}</h3><p>${esc(v.text)}</p></div><button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button></div><div class="ayah-study-tabs" role="tablist"><button type="button" class="ayah-study-tab active" data-tab="overview">نظرة</button><button type="button" class="ayah-study-tab" data-tab="tafsir">📖 التفسير</button><button type="button" class="ayah-study-tab" data-tab="tajweed">🎙️ التجويد</button><button type="button" class="ayah-study-tab" data-tab="asbab">🕊️ سبب النزول</button></div><div id="ayahStudyInner"></div>`;
    $('#closeMushafStudy').onclick=()=>{panel.hidden=true;selectedAyah=0;savePosition();renderSurah()};
    panel.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{studyTab=b.dataset.tab;panel.querySelectorAll('.ayah-study-tab').forEach(x=>x.classList.toggle('active',x===b));renderStudyBody(s,v)});
    renderStudyBody(s,v);
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderStudyBody(s,v){
    const box=$('#ayahStudyInner'); if(!box)return;
    if(studyTab==='overview'){
      box.innerHTML=`<div class="mushaf-note">اضغط على الحروف في قسم التجويد لتفصيل الحكم بصورة تعليمية. التحليل الآلي مساعد للتعلم ولا يغني عن التلقي من قارئ متقن.</div><div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير</h4><p id="tafPreview">جارٍ جلب التفسير…</p></section><section class="ayah-detail"><h4>🎙️ التجويد</h4><p>عرض الأحكام المكتشفة آليًا مع شرح مبسط داخل تبويب التجويد.</p></section><section class="ayah-detail wahidi-mini"><h4>🕊️ سبب النزول</h4><p id="wahidiPreview">جاري جلب سبب النزول من كتاب الواحدي…</p><a class="wahidi-inline" href="${wahidiUrl(s.s,v.a)}" target="_blank" rel="noopener noreferrer">📜 فتح سبب النزول لهذه الآية</a></section><section class="ayah-detail"><h4>🏷️ معلومات السورة</h4><p>سورة ${esc(s.name)} · ${esc(s.type||'')} · ${s.count} آيات.</p></section></div>${sourceLinks(s.s,v.a)}`;
      fetchTafsir(s.s,v.a).then(t=>{const el=$('#tafPreview');if(el)el.textContent=t});fetchWahidi(s.s,v.a).then(t=>{const el=$('#wahidiPreview');if(el)el.textContent=t||'لم يُعثر في الصفحة الخاصة بهذه الآية على نص سبب نزول صريح من الواحدي. هذا لا يعني انتفاء وجود سياق نزول في كتب أخرى.'});
      return;
    }
    if(studyTab==='tafsir'){
      box.innerHTML=`<section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p id="tafFull">جارٍ جلب التفسير…</p></section><div class="mushaf-note" style="margin-top:12px">المصدر: التفسير الميسر عبر QuranEnc، ويُحفظ بعد جلبه للاستعمال اللاحق.</div>${sourceLinks(s.s,v.a)}`;
      fetchTafsir(s.s,v.a).then(t=>{const el=$('#tafFull');if(el)el.textContent=t});
      return;
    }
    if(studyTab==='tajweed'){
      const t=graphemes(v.text); const all=new Set();
      const html=t.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rules=tajFor(t,i);rules.forEach(x=>all.add(x));return `<span class="ayah-taj-letter ${selectedChar===i?'selected':''}" data-gidx="${i}" title="اضغط للتفصيل">${esc(g.raw)}</span>`}).join('');
      box.innerHTML=`<div class="mushaf-note">🎙️ اقرأ الحرف، ثم الكلمة، ثم صِل الكلمتين. اضغط على أي حرف لترى الحركة والحكم وطريقة الأداء بصورة مبسطة.</div><div class="taj-legend"><span>🟢 غنة وإدغام</span><span>🟡 قلقلة</span><span>🔵 مد/همز</span></div><div class="ayah-taj-verse">${html}</div><div id="tajInspector" class="taj-inspector"><b>اختر حرفًا</b><p>ستظهر هنا الحركة والحكم وطريقة النطق بعد اختيار الحرف.</p></div><div class="grid2" style="margin-top:12px">${Array.from(all).map(r=>`<section class="ayah-detail"><h4>${esc(r)}</h4><p>${esc(TAJ_RULES[r]||'حكم تجويدي يحتاج إلى ضبط موضعه بالسماع والتلقي.')}</p></section>`).join('')||'<section class="ayah-detail"><p>لا يظهر حكم إضافي في هذا التحليل الآلي للآية.</p></section>'}</div>`;
      box.querySelectorAll('.ayah-taj-letter').forEach(el=>el.onclick=()=>{
        selectedChar=Number(el.dataset.gidx); const g=t[selectedChar], rules=tajFor(t,selectedChar); box.querySelectorAll('.ayah-taj-letter').forEach(x=>x.classList.toggle('selected',Number(x.dataset.gidx)===selectedChar));
        const ins=$('#tajInspector'); if(ins)ins.innerHTML=`<b>الحرف: ${esc(g.raw)}</b><p>الحركة: ${esc(haraka(g.m))}</p><p>الحكم: ${esc(rules.join('، ')||'لا حكم إضافي ظاهر آليًا')}</p><p>الأداء: انطق «${esc(g.b)}» مع الحركة المذكورة، ثم التزم بالحكم في الوصل إن وجد. السماع من قارئ متقن هو المرجع العملي.</p>`;
      });
      return;
    }
    const key=`${s.s}:${v.a}`;
    const url=wahidiUrl(s.s,v.a);box.innerHTML=`<section class="ayah-detail wahidi-card"><div class="wahidi-head"><div><span class="wahidi-kicker">📜 مصدر أسباب النزول</span><h4>أسباب النزول — الواحدي</h4></div><span class="wahidi-source-badge">مصدر الواحدي</span></div><p id="wahidiBody">جاري جلب نص سبب النزول لهذه الآية من المصدر…</p><div class="wahidi-actions"><a class="wahidi-primary" href="${url}" target="_blank" rel="noopener noreferrer">📜 فتح سبب النزول لهذه الآية</a><a class="wahidi-secondary" href="${wahidiBookUrl}" target="_blank" rel="noopener noreferrer">📚 فتح كتاب الواحدي</a></div></section><div class="mushaf-note" style="margin-top:12px">يعرض رفيق القرآن النص الموجود في صفحة الآية من «أسباب النزول» للواحدي عند توفره، ولا يختلق سبب نزول إذا لم يرد نص صريح.</div>`;fetchWahidi(s.s,v.a).then(t=>{const el=$('#wahidiBody');if(el)el.textContent=t||'لم يُعثر في صفحة هذه الآية على نص سبب نزول صريح من الواحدي. يمكنك فتح المصدر الأصلي للاطلاع المباشر.'});
  }
  function openStudy(s,a){
    const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));if(!su||!v)return;
    surahNo=Number(s);selectedAyah=Number(a);studyTab='overview';selectedChar=null;savePosition();renderIndex();renderSurah();renderStudyShell(su,v);
  }
  function playAyah(s,a){
    const api=window.RAFIQ_API, reciters=window.RAFIQ_RECITERS||[]; const state=api?.state||{};
    const pref=state.prefs?.reciter||state.audio?.reciter; const r=reciters.find(x=>x.folder===pref)||reciters[0];
    if(!r){toast('اختر قارئًا من صفحة التلاوات أولًا.');return}
    const url=r.source==='mp3quran'?`${r.server}${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;
    const audio=$('#quranAudio'); if(audio){audio.src=url;audio.currentTime=0;audio.play().then(()=>toast(`تلاوة ${quran.find(x=>Number(x.s)===Number(s))?.name||'الآية'} · ${a}`)).catch(()=>toast('تعذر تشغيل التلاوة الآن. تأكد من الاتصال بالإنترنت.'));}
  }
  function init(){
    const root=$('#view-quran'); if(!root)return;
    const api=window.RAFIQ_API;
    const start=()=>{
      const data=window.RAFIQ_API?.quran||[];
      if(!Array.isArray(data)||data.length<114)return setStatus('⏳ جاري تجهيز بيانات المصحف…',true);
      quran=data;
      surahNo=Math.max(1,Math.min(114,surahNo));
      setStatus('',false); renderIndex();renderSurah();
    };
    $('#mushafSearch')?.addEventListener('input',renderIndex);
    $('#mushafPrev')?.addEventListener('click',()=>{if(surahNo>1){surahNo--;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});
    $('#mushafNext')?.addEventListener('click',()=>{if(surahNo<114){surahNo++;selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)}});
    $('#mushafTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    document.addEventListener('rafiq-data-ready',start,{once:true});
    if(api?.quran?.length)start(); else setTimeout(start,500);
  }
  window.RAFIQ_MUSHAF={openStudy,init};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
