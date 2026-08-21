(function(){
  const boot=()=>{

  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const api=window.RAFIQ_API;
  if(!api){console.error('[Rafiq] Study module: API unavailable');return;}
  const modal=$('#rafiqStudyModal'), body=$('#rafiqStudyModalBody'), closeBtn=$('#rafiqStudyModalClose');
  const qState={surah:1,ayah:1,tab:'summary'};
  const topicMap={التفسير:'tafsir',التجويد:'tajweed','غريب القرآن':'words','أسباب النزول':'asbab'};
  const esc=x=>{const d=document.createElement('div');d.textContent=String(x??'');return d.innerHTML};
  const quran=()=>api.quran||[];
  const verse=()=>{const s=quran()[qState.surah-1];return s?.verses?.find(v=>v.a===qState.ayah)||s?.verses?.[qState.ayah-1]};
  const cacheKey=(type,s,a)=>`rafiq-study-${type}-${s}-${a}-v2`;
  const cacheGet=(type,s,a)=>{try{return localStorage.getItem(cacheKey(type,s,a))||''}catch{return ''}};
  const cacheSet=(type,s,a,v)=>{try{localStorage.setItem(cacheKey(type,s,a),v)}catch{}};

  const wordMeanings={
    '2:286':'يكلّف: يحمّل التكليف — إصر: عهد/تكليف ثقيل — طاقة: قدرة — مولانا: ناصرنا وولينا',
    '39:53':'أسرفوا: جاوزوا الحد — تقنطوا: تيأسوا — رحمة: فضل وإحسان',
    '3:200':'اصبروا: الزموا الصبر — صابروا: غالبوا أعداءكم بالصبر — رابطوا: اثبتوا ولزموا الثغور — تفلحون: تفوزون وتنجحون',
    '11:90':'استغفروا: اطلبوا المغفرة — توبوا: ارجعوا إلى الله — رحيم: كثير الرحمة — ودود: محب لعباده الصالحين'
  };
  const asbab={
    '80:1':{
      title:'قصة عبس وتولّى',
      text:'جاء ابن أم مكتوم رضي الله عنه — وكان أعمى — إلى رسول الله ﷺ يطلب أن يُرشَد، وكان النبي ﷺ مشغولًا بدعوة رجل من عظماء قريش، فأقبل على ذلك الرجل يرجو إسلامه. فحصل من النبي ﷺ إعراض عن ابن أم مكتوم وعبوس، فنزل صدر سورة عبس عتابًا وتوجيهًا إلى أن ميزان الإقبال على طالب الحق ليس مكانته الاجتماعية، وأن من جاء يطلب التزكية والهداية أولى بالعناية.',
      ref:'المصدر: سنن الترمذي 3331، باب تفسير سورة عبس؛ وقال الترمذي: حديث حسن غريب.'
    },
    '2:286':{title:'خاتمة سورة البقرة',text:'وردت روايات تتعلق بخاتمة سورة البقرة ودعائها، وأبرز ما يظهر في الباب أن الآية جاءت في ختام مقطع التكليف والدعاء، مع رفع الحرج عن الأمة، ثم خُتمت بدعاء جامع: ربنا لا تؤاخذنا إن نسينا أو أخطأنا…',ref:'يُراجع في كتب أسباب النزول والتفسير وعلوم القرآن.'},
    '39:53':{title:'رحمة الله بالمذنبين',text:'وردت في سياق هذه الآيات روايات في سبب النزول، والمقصود من العرض داخل التطبيق التفريق بين الرواية الواردة وبين دلالة الآية العامة في فتح باب التوبة وعدم القنوط من رحمة الله.',ref:'تُراجع الروايات في كتب أسباب النزول والتفسير المحققة.'},
    '3:200':{title:'سياق الأمر بالصبر والمرابطة',text:'تأتي الآية في سياق توجيهات الإيمان والصبر والمصابرة والمرابطة والتقوى، وتُراجع الروايات الخاصة بالسبب عند الحاجة من المصادر المختصة؛ لا نخلط بين سياق السورة وبين سبب نزول خاص.',ref:'يُراجع سبب النزول في المصادر المختصة عند الحاجة.'}
  };
  const tajRules={
    'الإظهار الحلقي':'النون الساكنة أو التنوين يأتي بعدهما أحد حروف الحلق الستة: ء هـ ع ح غ خ. اقرأ النون/التنوين واضحًا ولا تدمجه في الحرف التالي.',
    'الإدغام بغنة':'إذا جاءت النون الساكنة أو التنوين قبل ي أو ن أو م أو و يدخل الصوت في الحرف التالي مع غنة.',
    'الإدغام بغير غنة':'إذا جاءت النون الساكنة أو التنوين قبل ل أو ر يدخل الصوت في الحرف التالي من غير غنة مستقلة.',
    'الإقلاب':'إذا جاءت النون الساكنة أو التنوين قبل ب تتحول في النطق إلى ميم مخفاة مع غنة قبل الباء.',
    'الإخفاء الحقيقي':'النون الساكنة أو التنوين قبل أحد حروف الإخفاء: بين الإظهار والإدغام مع غنة.',
    'الإخفاء الشفوي':'ميم ساكنة بعدها باء: تُخفى الميم مع غنة.',
    'الإدغام الشفوي':'ميم ساكنة بعدها ميم: تدغم الأولى في الثانية مع غنة.',
    'الإظهار الشفوي':'ميم ساكنة بعدها غير الباء والميم: تُظهر الميم بوضوح.',
    'غنة النون المشددة':'النون المشددة فيها غنة ثابتة بمقدار حركتين.',
    'غنة الميم المشددة':'الميم المشددة فيها غنة ثابتة بمقدار حركتين.',
    'القلقلة':'حروف قطب جد إذا كانت ساكنة يظهر للحرف ارتداد خفيف مسموع دون إضافة حركة جديدة.',
    'تفخيم حروف الاستعلاء':'حروف خص ضغط قظ لها أصل التفخيم وتختلف درجته بحسب السياق.',
    'ترقيق الراء':'للراء أحوال متعددة؛ هنا تُفهم مع الحركة وما قبلها.',
    'تفخيم الراء':'للراء أحوال متعددة؛ هنا تُفهم مع الحركة وما قبلها.',
    'المد الطبيعي':'حرف المد إذا لم يأت بعده همز أو سكون يوجب مدًا فرعيًا، والأصل في الموضع المشهور حركتان.',
    'مد اللين':'واو أو ياء ساكنة قبلها فتح، ويظهر حكمهما خصوصًا عند الوقف.',
    'همزة الوصل':'تُنطق عند البدء وتسقط عند وصل الكلمة بما قبلها في مواضعها.',
    'همزة القطع':'تُنطق في الوصل والابتداء ولا تسقط بسبب وصل الكلام.',
    'الألف الخنجرية':'ألف صغيرة في رسم المصحف، يُقرأ صوتها كما سُمعت من المصحف والقارئ.',
    'علامات الوقف':'علامات تساعدك على فهم موضع الوقف والوصل، ولا ينبغي أخذ الرمز منفردًا عن سياق الآية.'
  };
  const heavy=new Set('خصضغطقظ'.split('')), qalq=new Set('قطبجد'.split(''));
  function splitGraphemes(text){const out=[];let cur=null;for(const ch of String(text||'')){if(/[ء-يٱ]/.test(ch)){cur={b:ch,m:[],raw:ch};out.push(cur)}else if(/[ًٌٍَُِّْٰ]/.test(ch)&&cur){cur.m.push(ch);cur.raw+=ch}else if(/\s/.test(ch))out.push({space:true,raw:ch});else out.push({punct:true,raw:ch})}return out}
  function prevG(t,i){for(let j=i-1;j>=0;j--)if(!t[j].space&&!t[j].punct)return j;return -1}
  function nextG(t,i){for(let j=i+1;j<t.length;j++)if(!t[j].space&&!t[j].punct)return j;return -1}
  function haraka(m){if(m.includes('َ'))return'فتحة — صوت قصير «ـَ»';if(m.includes('ُ'))return'ضمة — صوت قصير «ـُ»';if(m.includes('ِ'))return'كسرة — صوت قصير «ـِ»';if(m.includes('ْ'))return'سكون — لا حركة بعد الحرف';if(m.includes('ّ'))return'شدة — الحرف يُنطق بقوة';if(m.includes('ٰ'))return'ألف خنجرية — صوت ألف طويل';if(m.includes('ً'))return'تنوين فتح';if(m.includes('ٌ'))return'تنوين ضم';if(m.includes('ٍ'))return'تنوين كسر';return'لا حركة مكتوبة على هذا الحرف'}
  function tajweedFor(t,i){const g=t[i],rules=[];if(!g||g.space||g.punct)return rules;const p=prevG(t,i),n=nextG(t,i),nb=n>=0?t[n].b:'';const add=x=>{if(!rules.includes(x))rules.push(x)};
    if(g.b==='ن'&&(g.m.includes('ْ')||g.m.some(x=>['ً','ٌ','ٍ'].includes(x)))){if('ءأإٱهـعحغخ'.includes(nb))add('الإظهار الحلقي');else if('ينمو'.includes(nb))add('الإدغام بغنة');else if('لر'.includes(nb))add('الإدغام بغير غنة');else if(nb==='ب')add('الإقلاب');else if('تثجدذزسشصضطظفقك'.includes(nb))add('الإخفاء الحقيقي')}
    if(g.b==='م'&&g.m.includes('ْ')){if(nb==='ب')add('الإخفاء الشفوي');else if(nb==='م')add('الإدغام الشفوي');else add('الإظهار الشفوي')}
    if(g.b==='ن'&&g.m.includes('ّ'))add('غنة النون المشددة'); if(g.b==='م'&&g.m.includes('ّ'))add('غنة الميم المشددة'); if(qalq.has(g.b)&&g.m.includes('ْ'))add('القلقلة'); if(heavy.has(g.b))add('تفخيم حروف الاستعلاء'); if(g.b==='ر'){if(g.m.includes('ِ'))add('ترقيق الراء');else if(g.m.includes('َ')||g.m.includes('ُ'))add('تفخيم الراء')}; if(g.b==='ٱ')add('همزة الوصل'); if('أإؤئ'.includes(g.b))add('همزة القطع'); if(g.m.includes('ٰ'))add('الألف الخنجرية'); if(g.b==='و'||g.b==='ي'){if(g.m.includes('ْ')&&p>=0&&t[p].m.includes('َ'))add('مد اللين');if(g.b==='و'&&p>=0&&t[p].m.includes('ُ'))add('المد الطبيعي');if(g.b==='ي'&&p>=0&&t[p].m.includes('ِ'))add('المد الطبيعي')} if(g.b==='ا'&&p>=0&&t[p].m.includes('َ'))add('المد الطبيعي'); return rules;}
  function simplePron(g,rules){let out=`انطق «${g.b}» مع ${haraka(g.m)}.`;if(g.m.includes('ّ'))out+=' الشدة تعني بنية قوية للحرف ولا تفصلها كصوتين مستقلين.';if(rules.some(r=>r.includes('غنة')))out+=' هنا يوجد صوت غنة من الخيشوم.';if(rules.includes('القلقلة'))out+=' أظهر ارتداد الحرف الساكن من غير إضافة حركة جديدة.';if(rules.some(r=>r.includes('مد')))out+=' اجعل المد بالمقدار الخاص بالحكم وتعلّمه بالسماع.';return out;}
  function closeModal(){modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');document.body.classList.remove('study-modal-open')}
  window.closeRafiqStudyModal=closeModal;
  closeBtn?.addEventListener('click',closeModal); modal?.addEventListener('click',e=>{if(e.target===modal)closeModal()}); document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal?.classList.contains('open'))closeModal()});
  const openSourceLinks=(s,a)=>`<div class="source-badges"><a href="https://quranenc.com/ar/browse/arabic_moyassar/${s}/${a}" target="_blank" rel="noopener">📖 التفسير الميسر — QuranEnc</a><a href="https://quranenc.com/ar/browse/arabic_seraj/${s}/${a}" target="_blank" rel="noopener">🔎 معاني الكلمات — السراج</a><a href="https://corpus.quran.com/wordbyword.jsp?chapter=${s}&verse=${a}" target="_blank" rel="noopener">🧩 التحليل اللغوي — Quranic Corpus</a></div>`;
  function setTabs(){document.querySelectorAll('#rafiqStudyModal .study-tab').forEach(b=>b.classList.toggle('active',b.dataset.studyView===qState.tab))}
  async function fetchJSON(url,timeout=9000){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
  function extractTranslation(j){
    if(!j)return '';
    const pick=o=>o?.translation||o?.result?.translation||o?.data?.translation||o?.data?.translation_text||'';
    if(Array.isArray(j))return j.map(x=>pick(x)).filter(Boolean).join('\n');
    if(j.result&&Array.isArray(j.result))return j.result.map(x=>pick(x)).filter(Boolean).join('\n');
    if(j.data&&Array.isArray(j.data))return j.data.map(x=>pick(x)).filter(Boolean).join('\n');
    return pick(j);
  }
  async function getTafsir(s,a){
    let v=cacheGet('tafseer',s,a); if(v)return v;
    try{
      const j=await fetchJSON(`https://quranenc.com/api/v1/translation/aya/arabic_moyassar/${s}/${a}`);
      v=extractTranslation(j);
    }catch{}
    if(!v){
      try{
        const j=await fetchJSON(`https://quranenc.com/api/v1/translation/sura/arabic_moyassar/${s}`);
        const rows=Array.isArray(j)?j:(Array.isArray(j?.result)?j.result:(Array.isArray(j?.data)?j.data:[]));
        const row=rows.find(x=>Number(x.aya)==Number(a)); v=row?.translation||'';
      }catch{}
    }
    if(v){cacheSet('tafseer',s,a,v);return v}
    return 'التفسير الميسر يحتاج اتصالًا لأول تحميل لهذه الآية. اضغط «فتح التفسير الميسر» لقراءته مباشرة من QuranEnc.';
  }
  async function getWordsMeaning(s,a){
    const local=wordMeanings[`${s}:${a}`]; if(local)return local;
    let v=cacheGet('words',s,a); if(v)return v;
    try{v=extractTranslation(await fetchJSON(`https://quranenc.com/api/v1/translation/aya/arabic_seraj/${s}/${a}`))}catch{}
    if(!v){try{const j=await fetchJSON(`https://quranenc.com/api/v1/translation/sura/arabic_seraj/${s}`);const rows=Array.isArray(j)?j:(Array.isArray(j?.result)?j.result:(Array.isArray(j?.data)?j.data:[]));v=rows.find(x=>Number(x.aya)==Number(a))?.translation||''}catch{}}
    if(v){cacheSet('words',s,a,v);return v}
    return 'معاني الكلمات تحتاج اتصالًا لأول تحميل لهذه الآية. يمكنك فتح مصدر السراج من الزر أسفل البطاقة.';
  }
  function currentData(){const s=quran()[qState.surah-1],v=s?.verses?.find(x=>x.a===qState.ayah)||s?.verses?.[qState.ayah-1];return{s,v}}
  function renderOverview(s,v,taf,words){
    const as=asbab[`${qState.surah}:${qState.ayah}`];
    const t=splitGraphemes(v.text), all=new Set();const letterHtml=t.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rs=tajweedFor(t,i);rs.forEach(r=>all.add(r));return`<button type="button" class="ayah-taj-letter" data-index="${i}" title="اضغط للتفصيل">${esc(g.raw)}</button>`}).join('');
    return `<div class="mushaf-note">📌 دراسة الآية هنا مرتبطة بالمصحف نفسه: النص، التفسير، معاني الكلمات، التجويد، وسبب النزول عند توفر نقل موثق.</div><div class="study-verse-hero"><div class="arabic">${esc(v.text)}</div><div class="ref">سورة ${esc(s.name)} · الآية ${qState.ayah}</div></div><div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(taf)}</p><div class="source-badges"><a href="https://quranenc.com/ar/browse/arabic_moyassar/${qState.surah}/${qState.ayah}" target="_blank" rel="noopener">↗ فتح التفسير الميسر مباشرة</a></div></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>${esc(words)}</p></section><section class="ayah-detail"><h4>🕊️ أسباب النزول</h4><p>${esc(as?.text||'لا توجد رواية خاصة محفوظة محليًا لهذه الآية في النسخة الحالية. لا نختلق سبب نزول؛ يرجع عند الحاجة إلى المصدر المتخصص.')}</p>${as?.ref?`<small class="muted">${esc(as.ref)}</small>`:''}</section><section class="ayah-detail"><h4>🏷️ معلومات السورة</h4><p>سورة ${esc(s.name)} — ${esc(s.type)} — عدد آياتها ${s.count}.</p></section></div><div style="margin-top:12px"><h4 style="color:#f0d77a">🎙️ التجويد</h4><div class="tajweed-verse">${letterHtml}</div></div>${openSourceLinks(qState.surah,qState.ayah)}`;
  }
  function renderTajweed(s,v){const t=splitGraphemes(v.text),all=new Set();let h='';t.forEach((g,i)=>{if(g.space||g.punct){h+=esc(g.raw);return}const rs=tajweedFor(t,i);rs.forEach(r=>all.add(r));h+=`<button type="button" class="taj-letter" data-index="${i}" style="border:0;background:none;color:inherit;font:inherit">${esc(g.raw)}</button>`});return `<section class="study-panel"><h3 style="color:var(--gold)">🎙️ تعلّم التجويد خطوة بخطوة</h3><p class="muted">اضغط على الحرف لتعرف الحركة وطريقة النطق والحكم الذي رصده التحليل الآلي. التطبيق إرشادي ولا يغني عن التلقي من قارئ متقن.</p><div class="taj-character-verse">${h}</div><div id="tajInspector" class="taj-inspector"><h4>👂 شرح الحرف</h4><p class="muted">اضغط على أي حرف.</p></div><div class="study-rule-grid">${[...all].map(r=>`<div class="study-rule"><div class="study-rule-name">${esc(r)}</div><div class="study-rule-text">${esc(tajRules[r]||'شرح مبسط لهذا الحكم.')}</div></div>`).join('')||'<div class="muted">لم يظهر حكم آلي إضافي.</div>'}</div></section>`}
  function renderWords(s,v,words){const arr=(v.text||'').replace(/[ۖۗۚۙۛۜ۝﴿﴾]/g,'').split(/\s+/).filter(Boolean);return `<section class="study-panel"><h3 style="color:var(--gold)">🔎 الكلمات</h3><p class="muted">اضغط على كلمة لعرض موضعها والتحليل اللغوي.</p><div class="word-grid">${arr.map((w,i)=>`<button type="button" class="word-chip" data-word-index="${i}">${esc(w)}</button>`).join('')}</div><div id="wordDetail" class="study-info-card" style="margin-top:12px"><h4>المعاني</h4><p>${esc(words)}</p></div>${openSourceLinks(qState.surah,qState.ayah)}</section>`}
  function renderAsbab(){const item=asbab[`${qState.surah}:${qState.ayah}`];return `<section class="study-info-card"><h4>📜 سبب النزول</h4><p>${esc(item?.text||'لا يثبت عندنا سبب خاص بهذه الآية من البيانات المحلية المتاحة. هذا لا يعني عدم وجود روايات في المصادر المتخصصة؛ يمكنك فتح المصدر الأصلي والبحث بموضع الآية.')}</p>${item?.ref?`<small class="muted">${esc(item.ref)}</small>`:''}<div class="section-actions" style="margin-top:12px"><a class="action" href="https://quranenc.com/ar/browse/arabic_moyassar/${qState.surah}/${qState.ayah}" target="_blank" rel="noopener">📖 التفسير الميسر</a><a class="action" href="https://quranenc.com/ar/browse/arabic_seraj/${qState.surah}/${qState.ayah}" target="_blank" rel="noopener">🔎 معاني الكلمات</a></div></section>`}
  async function render(){const {s,v}=currentData();if(!s||!v)return;setTabs();body.innerHTML='<div class="study-info-card"><p>جارٍ تجهيز دراسة الآية…</p></div>';const [taf,words]=await Promise.all([getTafsir(qState.surah,qState.ayah),getWordsMeaning(qState.surah,qState.ayah)]);let inner='';if(qState.tab==='tafsir')inner=`<section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(taf)}</p><div class="source-badges"><a href="https://quranenc.com/ar/browse/arabic_moyassar/${qState.surah}/${qState.ayah}" target="_blank" rel="noopener">↗ فتح التفسير الميسر مباشرة</a></div></section>`;else if(qState.tab==='words')inner=renderWords(s,v,words);else if(qState.tab==='asbab')inner=renderAsbab();else if(qState.tab==='tajweed')inner=renderTajweed(s,v);else inner=renderOverview(s,v,taf,words);body.innerHTML=inner;bindStudyClicks(s,v);}
  function bindStudyClicks(s,v){
    $$('#rafiqStudyModalBody [data-index]').forEach(el=>el.onclick=()=>{const t=splitGraphemes(v.text),i=+el.dataset.index,g=t[i];if(!g)return;const rules=tajweedFor(t,i),box=$('#tajInspector');if(!box)return;box.innerHTML=`<h4>👂 حرف «${esc(g.raw)}»</h4><div class="big">${esc(g.raw)}</div><div class="simple"><b>الحركة:</b> ${esc(haraka(g.m))}</div><div class="simple"><b>كيف تنطقه؟</b> ${esc(simplePron(g,rules))}</div><div class="simple"><b>الحكم:</b> ${esc(rules.join('، ')||'لا يظهر حكم إضافي واضح من التحليل الآلي')}</div>${rules.length?`<div class="connection"><b>شرح مبسط:</b><br>${esc(rules.map(r=>tajRules[r]||r).join(' '))}</div>`:''}`;$$('#rafiqStudyModalBody [data-index]').forEach(x=>x.classList.remove('active'));el.classList.add('active')});
    $$('#rafiqStudyModalBody [data-word-index]').forEach(el=>el.onclick=()=>{const idx=+el.dataset.wordIndex;const words=(v.text||'').replace(/[ۖۗۚۙۛۜ۝﴿﴾]/g,'').split(/\s+/).filter(Boolean);const wd=$('#wordDetail');if(wd)wd.innerHTML=`<h4>${esc(words[idx]||'')}</h4><p>ادرس الكلمة في سياق الآية ثم افتح التحليل اللغوي كلمة بكلمة.</p><div class="source-badges"><a target="_blank" rel="noopener" href="https://corpus.quran.com/wordbyword.jsp?chapter=${qState.surah}&verse=${qState.ayah}">🧩 التحليل كلمة بكلمة</a></div>`});
  }
  window.openAyahStudy=async function(surah,ayah,tab='summary'){qState.surah=+surah||1;qState.ayah=+ayah||1;qState.tab=topicMap[tab]||tab||'summary';const {s,v}=currentData();if(!s||!v)return;$('#rafiqStudyModalTitle').textContent=`📚 دراسة ${s.name||'الآية'} · ${qState.ayah}`;$('#rafiqStudyModalSub').textContent=v.text||'';modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');document.body.classList.add('study-modal-open');await render()};
  document.querySelectorAll('#rafiqStudyModal .study-tab').forEach(b=>b.addEventListener('click',()=>{qState.tab=topicMap[b.dataset.studyView]||b.dataset.studyView||'summary';render()}));

  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
