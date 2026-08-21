(function(){
  const modal=document.getElementById('rafiqStudyModal');
  const body=document.getElementById('rafiqStudyModalBody');
  const closeBtn=document.getElementById('rafiqStudyModalClose');
  const qState={surah:1,ayah:1,tab:'summary',cache:{}};
  const topicMap={التفسير:'tafsir',التجويد:'tajweed','غريب القرآن':'words','أسباب النزول':'asbab'};
  const esc=(x)=>{const d=document.createElement('div');d.textContent=String(x??'');return d.innerHTML;};
  function closeModal(){modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');}
  window.closeRafiqStudyModal=closeModal;
  closeBtn?.addEventListener('click',closeModal);
  modal?.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal?.classList.contains('open'))closeModal()});
  async function apiText(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
  function currentVerse(){const s=quran[qState.surah-1];return s?.verses?.find(v=>v.a===qState.ayah)||s?.verses?.[Math.max(0,qState.ayah-1)];}
  function setTabs(){document.querySelectorAll('#rafiqStudyModal .study-tab').forEach(b=>b.classList.toggle('active',b.dataset.studyView===qState.tab));}
  function wordPronounce(word){try{const u=new SpeechSynthesisUtterance(word);u.lang='ar-SA';u.rate=.72;u.pitch=1;speechSynthesis.cancel();speechSynthesis.speak(u);}catch{}}
  function renderSummary(){
    const v=currentVerse(), s=quran[qState.surah-1];
    body.innerHTML=`<div class="study-verse-hero"><div class="arabic">${esc(v?.text||'—')}</div><div class="ref">${esc(s?.name||'')} · الآية ${qState.ayah}</div></div><div class="study-info-grid"><article class="study-info-card"><h4>🔊 النطق والاستماع</h4><p>يمكن تشغيل الآية كاملة بالقارئ المثبت لديك. وللتدريب على النطق الحرفي، يمكنك استخدام تبويب <b>الكلمات</b> والاستماع للكلمات بصوت الجهاز. هذا التدريب الصوتي تعليمي وليس بديلًا عن التلقي من شيخ.</p><button class="btn primary" type="button" id="studyPlayNow">▶ استمع للآية</button></article><article class="study-info-card"><h4>📖 النص</h4><p>موضع الآية: ${qState.surah}:${qState.ayah}<br/>رقم الآية العالمي: ${v?.global||'—'}</p></article><article class="study-info-card"><h4>🎙️ القارئ المثبت</h4><p id="studyReciterName">${esc((reciters.find(r=>r.folder===(state.prefs?.reciter||state.audio?.reciter))||{}).name||'لم يتم اختيار قارئ بعد')}</p><button class="btn" type="button" id="studyChangeReciter">تغيير القارئ</button></article><article class="study-info-card"><h4>🧠 كيف أدرسها؟</h4><p>اقرأ ببطء، راقب علامات الوقف، ثم استمع للتلاوة وكرر خلف القارئ. بعد ذلك انتقل إلى التفسير وغريب الكلمات وسبب النزول.</p></article></div>`;
    document.getElementById('studyPlayNow')?.addEventListener('click',()=>ensureReciterAndPlay(qState.surah,qState.ayah));
    document.getElementById('studyChangeReciter')?.addEventListener('click',()=>openReciterChooser(qState.surah,qState.ayah));
  }
  async function renderTafsir(){
    body.innerHTML='<div class="study-info-card"><p>جارٍ تحميل التفسير الميسر…</p></div>';
    const key=`${qState.surah}:${qState.ayah}`;
    try{
      const j=await apiText(`https://api.alquran.cloud/v1/ayah/${key}/ar.muyassar`);
      const text=j?.data?.text||'لم يصل نص التفسير.';
      body.innerHTML=`<article class="study-info-card"><h4>📖 التفسير الميسر</h4><p>${esc(text)}</p><small class="muted">المصدر: AlQuran Cloud · edition ar.muyassar</small></article>`;
    }catch(e){body.innerHTML='<div class="study-info-card"><h4>تعذر جلب التفسير الآن</h4><p>تحقق من اتصال الإنترنت ثم أعد المحاولة. يمكنك أيضًا فتح كتاب التفسير الميسر من صفحة الدراسة.</p></div>';}
  }
  function tajClass(cls){if(/ghn/i.test(cls))return'tw-ghn';if(/qlq/i.test(cls))return'tw-qalqalah';if(/idgh/i.test(cls))return'tw-idgham';if(/ikhf/i.test(cls))return'tw-ikhfa';if(/iqlb/i.test(cls))return'tw-iqlab';if(/madda/i.test(cls))return'tw-madda';return'tw-silent';}
  async function renderTajweed(){
    body.innerHTML='<div class="study-info-card"><p>جارٍ تحميل نسخة التجويد الملونة…</p></div>';
    const key=`${qState.surah}:${qState.ayah}`;
    try{
      const j=await apiText(`https://api.alquran.cloud/v1/ayah/${key}/quran-tajweed`);
      let html=j?.data?.text||'';
      html=html.replace(/<tajweed\s+class="?([\w_]+)"?>([\s\S]*?)<\/tajweed>/gi,(_,c,t)=>`<span class="${tajClass(c)}" title="قاعدة تجويد: ${esc(c)}">${t}</span>`).replace(/<span class="end">([\s\S]*?)<\/span>/gi,'<span>$1</span>');
      body.innerHTML=`<div class="study-verse-hero"><div class="tajweed-verse">${html}</div></div><div class="tajweed-legend"><span class="tw-ghn">● غنة</span><span class="tw-qalqalah">● قلقلة</span><span class="tw-idgham">● إدغام</span><span class="tw-ikhfa">● إخفاء</span><span class="tw-iqlab">● إقلاب</span><span class="tw-madda">● مد</span><span class="tw-silent">● وقف/صامت</span></div><div class="study-info-card" style="margin-top:12px"><p>هذه ألوان القاعدة في نص التجويد. التطبيق يساعدك على رؤية المواضع، أما ضبط المخرج والمد والغنة عمليًا فالأفضل أن يكون مع معلم متقن.</p></div>`;
    }catch(e){body.innerHTML='<div class="study-info-card"><h4>تعذر تحميل التجويد الآن</h4><p>تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى.</p></div>';}
  }
  function renderWords(){
    const v=currentVerse(), words=(v?.text||'').replace(/﴿|﴾/g,'').split(/\s+/).filter(Boolean);
    body.innerHTML=`<div class="study-info-card"><h4>🔎 الكلمات والنطق</h4><p>كل كلمة قابلة للاستماع بصوت الجهاز للتدريب على النطق. هذا صوت نطقي تعليمي وليس تلاوة قرآنية.</p><div class="word-grid">${words.map((w,i)=>`<div class="word-chip"><span>${esc(w)}</span><button type="button" data-speak-word="${i}" aria-label="نطق الكلمة">🔊</button></div>`).join('')}</div></div><div class="study-info-card" style="margin-top:12px"><h4>📚 معاني الكلمات</h4><p>المعنى الدقيق للكلمة يُفهم من السياق ومن كتب غريب القرآن والتفسير. افتح «غريب القرآن» من صفحة الدراسة لمصدر متخصص بدل توليد معنى غير موثوق.</p><button class="btn" type="button" id="openGharib">فتح مادة غريب القرآن</button></div>`;
    $$('#rafiqStudyModalBody [data-speak-word]').forEach(b=>b.addEventListener('click',()=>wordPronounce(words[+b.dataset.speakWord]||'')));
    document.getElementById('openGharib')?.addEventListener('click',()=>{closeModal();go('study');setTimeout(()=>{$('#studySearch').value='غريب القرآن';renderStudy('غريب القرآن');},70);});
  }
  function renderAsbab(){
    const key=`${qState.surah}:${qState.ayah}`;
    const known={'80:1':{text:'ورد سبب النزول في قصة ابن أم مكتوم رضي الله عنه، وأن النبي ﷺ كان يخاطب بعض كبراء قريش فجاءه ابن أم مكتوم يطلب التعلم، فنزل صدر سورة عبس عتابًا للنبي ﷺ.',ref:'يُراجع في كتب أسباب النزول، ومن أشهرها: الواحدي.'}};
    const item=known[key];
    body.innerHTML=item?`<div class="study-info-card"><h4>📜 سبب النزول</h4><p>${esc(item.text)}</p><small class="muted">${esc(item.ref)}</small></div>`:`<div class="study-info-card"><h4>📜 سبب النزول</h4><p>لا يوجد في قاعدة الدراسة المحلية سبب نزول موثق مُرتبط بهذه الآية حاليًا. هذا لا يعني بالضرورة عدم وجود روايات؛ عند الحاجة توجّه إلى <b>كتاب أسباب النزول للواحدي</b> وابحث بموضع الآية.</p><button class="btn primary" type="button" id="openAsbabBook">📚 فتح كتاب أسباب النزول للواحدي</button></div>`;
    document.getElementById('openAsbabBook')?.addEventListener('click',()=>{const b=studyMeta.find(x=>x.title.includes('أسباب النزول'));if(b){closeModal();openBookReader(b);}});
  }
  window.openAyahStudy=async function(surah,ayah,tab='summary'){
    qState.surah=surah;qState.ayah=ayah;qState.tab=topicMap[tab]||tab||'summary';
    const s=quran[surah-1],v=s?.verses?.find(x=>x.a===ayah)||s?.verses?.[ayah-1];
    $('#rafiqStudyModalTitle').textContent=`📚 دراسة ${s?.name||'الآية'} · ${ayah}`;
    $('#rafiqStudyModalSub').textContent=v?.text||'';
    setTabs(); modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    if(qState.tab==='tafsir')return renderTafsir();if(qState.tab==='tajweed')return renderTajweed();if(qState.tab==='words'||qState.tab==='غريب القرآن')return renderWords();if(qState.tab==='asbab'||qState.tab==='أسباب النزول')return renderAsbab();return renderSummary();
  };
  document.querySelectorAll('#rafiqStudyModal .study-tab').forEach(b=>b.addEventListener('click',()=>openAyahStudy(qState.surah,qState.ayah,b.dataset.studyView)));

  // Fix book reader close binding: its HTML appears after the main IIFE in V80.
  const bookClose=document.getElementById('bookReaderClose');
  bookClose?.addEventListener('click',()=>{const m=document.getElementById('bookReader'),f=document.getElementById('bookReaderFrame');m?.classList.remove('open');m?.setAttribute('aria-hidden','true');document.body.classList.remove('reader-lock');if(f)f.src='about:blank';});
  const bookReader=document.getElementById('bookReader');
  bookReader?.addEventListener('click',e=>{if(e.target===bookReader){bookClose?.click();}});

  // Make the reader show an explicit state instead of a giant blank frame.
  const frame=document.getElementById('bookReaderFrame');
  if(frame){
    frame.addEventListener('load',()=>{try{if(frame.contentDocument?.body?.innerText?.trim().length>80)document.getElementById('bookReaderFallback').hidden=true;}catch{}});
  }
})();
