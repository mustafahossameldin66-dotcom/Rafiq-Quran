(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const api=window.RAFIQ_API;
  if(!api){console.error('[Rafiq] Study module: API unavailable');return;}
  const modal=$('#rafiqStudyModal'), body=$('#rafiqStudyModalBody'), closeBtn=$('#rafiqStudyModalClose');
  const qState={surah:1,ayah:1,tab:'summary'};
  const topicMap={التفسير:'tafsir',التجويد:'tajweed','غريب القرآن':'words','أسباب النزول':'asbab'};
  const esc=x=>{const d=document.createElement('div');d.textContent=String(x??'');return d.innerHTML};
  const quran=()=>api.quran||[];
  const state=()=>api.state||{};
  const verse=()=>{const s=quran()[qState.surah-1];return s?.verses?.find(v=>v.a===qState.ayah)||s?.verses?.[qState.ayah-1]};
  const cacheKey=(type,s,a)=>`rafiq-study-${type}-${s}-${a}`;
  const cacheGet=(type,s,a)=>{try{return localStorage.getItem(cacheKey(type,s,a))||''}catch{return ''}};
  const cacheSet=(type,s,a,v)=>{try{localStorage.setItem(cacheKey(type,s,a),v)}catch{}};
  const wordMeanings={'2:286':'يكلّف: يحمّل التكليف — إصر: عهد/تكليف ثقيل — طاقة: قدرة — مولانا: ناصرنا وولينا','39:53':'أسرفوا: جاوزوا الحد — تقنطوا: تيأسوا — رحمة: فضل وإحسان','3:200':'اصبروا: الزموا الصبر — صابروا: غالبوا أعداءكم بالصبر — رابطوا: اثبتوا ولزموا الثغور — تفلحون: تفوزون وتنجحون','11:90':'استغفروا: اطلبوا المغفرة — توبوا: ارجعوا إلى الله — رحيم: كثير الرحمة — ودود: محب لعباده الصالحين'};
  const asbab={'80:1':'ورد سبب النزول في قصة ابن أم مكتوم رضي الله عنه في شأن صدر سورة عبس.','2:286':'خاتمة سورة البقرة ودعاء جامع.','39:53':'وردت روايات في سبب النزول، وتفاصيلها تُراجع في كتاب أسباب النزول للواحدي والمصادر المحققة.','3:200':'وردت في السورة روايات تتعلق بسياق الآية، ويُراجع نص الواحدي للحكم الدقيق.'};
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
  function haraka(m){if(m.includes('َ'))return'فتحة — صوت قصير «ـَ»';if(m.includes('ُ'))return'ضمة — صوت قصير «ـُ»';if(m.includes('ِ'))return'كسرة — صوت قصير «ـِ»';if(m.includes('ْ'))return'سكون — لا حركة بعد الحرف';if(m.includes('ّ'))return'شدة — الحرف يُنطق بقوة؛';if(m.includes('ٰ'))return'ألف خنجرية — صوت ألف طويل';if(m.includes('ً'))return'تنوين فتح';if(m.includes('ٌ'))return'تنوين ضم';if(m.includes('ٍ'))return'تنوين كسر';return'لا حركة مكتوبة على هذا الحرف'}
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
  async function fetchText(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  async function getTafsir(s,a){let v=cacheGet('tafseer',s,a);if(v)return v;try{const j=await fetchText(`https://quranenc.com/api/v1/translation/aya/arabic_moyassar/${s}/${a}`);v=j?.result?.translation||j?.data?.translation||j?.translation||'';if(v)cacheSet('tafseer',s,a,v)}catch{}return v||'التفسير الميسر يحتاج اتصالًا لأول تحميل لهذه الآية؛ بعد التحميل يمكن الاحتفاظ به محليًا.'}
  async function getWordsMeaning(s,a){const local=wordMeanings[`${s}:${a}`];if(local)return local;let v=cacheGet('words',s,a);if(v)return v;try{const j=await fetchText(`https://quranenc.com/api/v1/translation/aya/arabic_seraj/${s}/${a}`);v=j?.result?.translation||j?.data?.translation||j?.translation||'';if(v)cacheSet('words',s,a,v)}catch{}return v||'معاني الكلمات تحتاج اتصالًا لأول تحميل لهذه الآية؛ بعد التحميل يمكن الاحتفاظ بها محليًا.'}
  function currentData(){const s=quran()[qState.surah-1],v=s?.verses?.find(x=>x.a===qState.ayah)||s?.verses?.[qState.ayah-1];return{s,v}}
  function renderOverview(s,v,taf,words){
    const t=splitGraphemes(v.text), all=new Set();const letterHtml=t.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rs=tajweedFor(t,i);rs.forEach(r=>all.add(r));return`<button type="button" class="ayah-taj-letter" data-index="${i}" title="اضغط للتفصيل">${esc(g.raw)}</button>`}).join('');
    return `<div class="mushaf-note">📌 دراسة الآية هنا مرتبطة بالمصحف نفسه: النص، التفسير، معاني الكلمات، التجويد، وسبب النزول عند توفر نقل موثق.</div><div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(taf)}</p></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>${esc(words)}</p></section><section class="ayah-detail"><h4>🕊️ أسباب النزول</h4><p>${esc(asbab[`${qState.surah}:${qState.ayah}`]||'لا توجد رواية خاصة محفوظة محليًا لهذه الآية في النسخة الحالية. لا نختلق سبب نزول؛ يُرجع إلى المصادر المتخصصة عند الحاجة.')}</p></section><section class="ayah-detail"><h4>🏷️ معلومات السورة</h4><p>سورة ${esc(s.name)} — ${esc(s.type||'')} — عدد آياتها ${s.count}.</p></section></div><div class="study-panel" style="margin-top:12px"><h3 style="color:var(--gold)">🎙️ التجويد الحرفي</h3><div class="ayah-taj-verse">${letterHtml}</div><div id="tajInspector" class="taj-inspector-panel"><h4>👂 شرح الحرف والنطق</h4><div class="muted">اضغط على أي حرف لترى الحركة والنطق والحكم الذي رصده التحليل.</div></div></div>${openSourceLinks(qState.surah,qState.ayah)}<div class="study-rule-grid" style="margin-top:12px">${[...all].map(r=>`<div class="taj-rule-card"><b>${esc(r)}</b><p>${esc(tajRules[r]||'شرح مبسط متاح لهذا الحكم.')}</p></div>`).join('')}</div>`;
  }
  function renderTajweed(s,v){const t=splitGraphemes(v.text),all=new Set();const h=t.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rs=tajweedFor(t,i);rs.forEach(r=>all.add(r));return`<span class="ayah-taj-letter" data-index="${i}" title="اضغط للتفصيل">${esc(g.raw)}</span>`}).join('');return `<div class="mushaf-note">🎙️ ابدأ من الحرف، ثم الكلمة، ثم الوصل. اضغط على الحرف لترى الحركة وطريقة النطق والحكم.</div><div class="ayah-taj-verse">${h}</div><div id="tajInspector" class="taj-inspector-panel"><h4>👂 شرح الحرف والنطق</h4><div class="muted">اختر حرفًا.</div></div><div class="study-rule-grid" style="margin-top:12px">${[...all].map(r=>`<div class="taj-rule-card"><b>${esc(r)}</b><p>${esc(tajRules[r]||'شرح مبسط متاح لهذا الحكم.')}</p></div>`).join('')||'<div class="muted">لا يظهر حكم آلي إضافي في هذا الموضع.</div>'}</div>`;}
  function renderWords(s,v,words){const split=(v.text||'').replace(/[ۖۗۚۙۛۜ۝﴿﴾]/g,'').split(/\s+/).filter(Boolean);return `<div class="mushaf-note">🔎 المصدر المعجمي العربي هو «معاني الكلمات» من السراج عند توفره. يمكنك الضغط على أي كلمة.</div><div class="word-list">${split.map((w,i)=>`<button class="word-chip" type="button" data-word-index="${i}">${esc(w)}</button>`).join('')}</div><div id="wordDetail" class="ayah-detail" style="margin-top:12px"><h4>اختر كلمة</h4><p>${esc(words)}</p></div>${openSourceLinks(qState.surah,qState.ayah)}`}
  function renderAsbab(){return `<section class="ayah-detail"><h4>🕊️ أسباب النزول</h4><p>${esc(asbab[`${qState.surah}:${qState.ayah}`]||'لا توجد رواية خاصة محفوظة محليًا لهذه الآية في النسخة الحالية. لا نختلق سبب نزول؛ يُرجع إلى كتب أسباب النزول والمصادر المحققة عند الحاجة.')}</p></section><div class="mushaf-note" style="margin-top:12px">⚠️ سبب النزول مسألة توثيقية؛ لا نثبت رواية خاصة بلا نقل معتبر.</div>`}
  async function render(){const {s,v}=currentData();if(!s||!v)return;setTabs();body.innerHTML='<div class="study-info-card"><p>جارٍ تجهيز دراسة الآية…</p></div>';const [taf,words]=await Promise.all([getTafsir(qState.surah,qState.ayah),getWordsMeaning(qState.surah,qState.ayah)]);let inner='';if(qState.tab==='tafsir')inner=`<section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(taf)}</p></section>${openSourceLinks(qState.surah,qState.ayah)}`;else if(qState.tab==='words')inner=renderWords(s,v,words);else if(qState.tab==='asbab')inner=renderAsbab();else if(qState.tab==='tajweed')inner=renderTajweed(s,v);else inner=renderOverview(s,v,taf,words);body.innerHTML=inner;bindStudyClicks(s,v);}
  function bindStudyClicks(s,v){
    $$('#rafiqStudyModalBody [data-index]').forEach(el=>el.onclick=()=>{const t=splitGraphemes(v.text),i=+el.dataset.index,g=t[i];if(!g)return;const rules=tajweedFor(t,i);const box=$('#tajInspector');if(!box)return;box.innerHTML=`<h4>👂 حرف «${esc(g.raw)}»</h4><div class="big">${esc(g.raw)}</div><div class="simple"><b>الحركة:</b> ${esc(haraka(g.m))}</div><div class="simple"><b>كيف تنطقه؟</b> ${esc(simplePron(g,rules))}</div><div class="simple"><b>الحكم:</b> ${esc(rules.join('، ')||'لا يظهر حكم إضافي واضح من التحليل الآلي')}</div>${rules.length?`<div class="connection"><b>شرح مبسط:</b><br>${esc(rules.map(r=>tajRules[r]||r).join(' '))}</div>`:''}`;$$('#rafiqStudyModalBody [data-index]').forEach(x=>x.classList.remove('active'));el.classList.add('active')});
    $$('#rafiqStudyModalBody [data-word-index]').forEach(el=>el.onclick=()=>{const idx=+el.dataset.wordIndex;const words=(v.text||'').replace(/[ۖۗۚۙۛۜ۝﴿﴾]/g,'').split(/\s+/).filter(Boolean);const wd=$('#wordDetail');if(wd)wd.innerHTML=`<h4>${esc(words[idx]||'')}</h4><p>اضغط «التفسير» أو «معاني الكلمات» من التبويب لرؤية المادة المتاحة للآية.</p><div class="source-badges"><a target="_blank" rel="noopener" href="https://corpus.quran.com/wordbyword.jsp?chapter=${qState.surah}&verse=${qState.ayah}">🧩 التحليل كلمة بكلمة</a></div>`});
  }
  window.openAyahStudy=async function(surah,ayah,tab='summary'){qState.surah=+surah||1;qState.ayah=+ayah||1;qState.tab=topicMap[tab]||tab||'summary';const {s,v}=currentData();if(!s||!v)return;$('#rafiqStudyModalTitle').textContent=`📚 دراسة ${s.name||'الآية'} · ${qState.ayah}`;$('#rafiqStudyModalSub').textContent=v.text||'';modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');document.body.classList.add('study-modal-open');await render()};
  document.querySelectorAll('#rafiqStudyModal .study-tab').forEach(b=>b.addEventListener('click',()=>{qState.tab=topicMap[b.dataset.studyView]||b.dataset.studyView||'summary';render()}));
})();
