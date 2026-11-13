(function(){
  'use strict';
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const cleanIslamicText=t=>!t?'':String(t)
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<span[^>]*class=["'][^"']*book-ayah[^"']*["'][^>]*>\s*\(?([\s\S]*?)\)?\s*<\/span>/gi,'﴿ $1 ﴾')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi,'$1')
    .replace(/<[^>]+>/g,'')
    .replace(/\[\d+\]/g,'')
    .replace(/&quot;/g,'"')
    .replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/[ \t]+/g,' ')
    .replace(/\n\s*\n+/g,'\n\n')
    .trim();
  const toast=msg=>window.rafiqToast?.(msg);
  const stateKey='rafiq-mushaf-state-v4';
  const state=(()=>{try{return JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{return{}}})();
  const CONTENT=window.RAFIQ_CONTENT;
  let quran=[];
  let surahNo=Number(state.surah||1)||1, selectedAyah=Number(state.ayah||0)||0, studyTab='overview';
  let maskMode=false;
  const QP_WEB='https://quranpedia.net';
  const TAFSIR_BOOK=2012,MEANINGS_BOOK=2013,ASBAB_BOOK=2919;
  const TAFSIR_QP_BOOK_ID=32;
  const TAJWEED_RULES=window.RAFIQ_TAJWEED?.RULES||{};
  const tajInfo=cls=>{const r=TAJWEED_RULES[Object.keys(TAJWEED_RULES).find(k=>TAJWEED_RULES[k].className===cls)]||null;return r?[r.name,r.description]:['حكم تجويدي','حكم ملوّن وارد من النص التجويدي المعلَّم من المصدر المرجعي.']};
  function normalizeClass(el){return String(el?.dataset?.rule||el?.className||'').split(/\s+/).filter(x=>x&&x!=='tajweed-mark')[0]||'';}

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
    const hasKhanjaria=/\u0670/u.test(String(v.text||''));
    const daggerCard=hasKhanjaria?`<section class="tajweed-dagger-card"><b>ألف خنجرية (ٰ)</b><p>علامة من علامات الرسم العثماني، وتُشرح هنا تعليميًا فقط؛ لا نغيّر نص المصحف.</p><div class="tajweed-dagger-example">مثال: هَٰذَا</div></section>`:'';
    box.innerHTML=`<div class="mushaf-note">التجويد معروض من نصٍّ معلَّم من المصدر المرجعي، بلا استنتاج آلي للأحكام. <a href="https://alquran.cloud/tajweed-guide" target="_blank" rel="noopener noreferrer">دليل القواعد والألوان</a></div>${daggerCard}<section class="tajweed-reader-card"><div class="tajweed-reader-head"><div><h4>النص الملوّن بأحكام التجويد</h4><span>اضغط على أي موضع ملوّن لمعرفة الحكم</span></div><span class="tajweed-source-pill">Al Quran Cloud · quran-tajweed</span></div><div class="ayah-tajweed-text">${data.html}</div><div class="ayah-taj-source">المصدر: ${esc(data.source)}</div><div id="tajInspector" class="taj-inspector"><b>اختر حكمًا ملوّنًا</b><p>سيظهر اسم الحكم وشرحه المختصر هنا.</p></div></section>${joins?`<section class="connected-pronunciation"><div class="connected-pronunciation-head"><h4>النطق عند الوصل</h4><span>يعرض فقط الوصل التعليمي المدعوم بالحكم المعلَّم في المصدر</span></div><div class="connected-pronunciation-text">${esc(connected.text)}</div><ul class="connected-joins">${joins}</ul><div class="connected-disclaimer">تمثيل تعليمي للنطق عند الوصل، ولا يغيّر نص الآية الأصلي.</div></section>`:''}`;
    const els=[...box.querySelectorAll('.tajweed-mark')];
    els.forEach(el=>{
      const cls=normalizeClass(el);
      const info=tajInfo(cls);
      const isDagger=el.textContent.includes('ٰ');
      el.title=isDagger?'ألف خنجرية (ٰ)':info[0];
      el.setAttribute('role','button');
      el.tabIndex=0;
      const activate=(ev)=>{ev.preventDefault();ev.stopPropagation();els.forEach(x=>x.classList.remove('selected'));el.classList.add('selected');const ins=box.querySelector('#tajInspector');if(ins)ins.innerHTML=`<b>${esc(isDagger?'ألف خنجرية (ٰ)':info[0])}</b><p>${esc(isDagger?'علامة من علامات الرسم العثماني تُقرأ ألفًا في موضعها.':info[1])}</p>`;};
      el.addEventListener('click',activate);
      el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){activate(ev);}});
    });
  }
  function renderIndex(){const box=$('#mushafSurahList');if(!box)return;const q=($('#mushafSearch')?.value||'').trim();const list=quran.filter(s=>!q||String(s.s)===q||String(s.name).includes(q));box.innerHTML=list.map(s=>`<button type="button" class="mushaf-surah-btn ${Number(s.s)===surahNo?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${esc(s.type||'')} · ${s.count} آيات</span></button>`).join('')||'<div class="mushaf-empty">لا توجد سورة مطابقة.</div>';box.querySelectorAll('[data-sura]').forEach(b=>b.onclick=()=>{surahNo=Number(b.dataset.sura);selectedAyah=0;studyTab='overview';savePosition();renderIndex();renderSurah(true)})}
  let activeSharePayload=null;
  let currentShareTheme='mihrab';
  let activeReciteRecognition=null;
  let activeReciteAyah=null;

  function normalizeArabic(text){
    return String(text||'')
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
      .replace(/[أإآٱ]/g,'ا')
      .replace(/ة/g,'ه')
      .replace(/ى/g,'ي')
      .replace(/\u0640/g,'')
      .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function startVoiceRecite(s,a){
    const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));
    if(!su||!v)return;
    const panel=$('#voiceRecitePanel');if(!panel)return;
    stopVoiceRecite();
    activeReciteAyah={s:Number(s),a:Number(a),su,v};
    panel.hidden=false;
    const meta=$('#voiceReciteMeta');if(meta)meta.textContent=`سورة ${su.name} · الآية ${a}`;
    const rawWords=String(v.text||'').split(/\s+/).filter(Boolean);
    const wordsBox=$('#voiceReciteWords');
    if(wordsBox)wordsBox.classList.add('blind');
    const heardEl=$('#voiceReciteHeard');if(heardEl)heardEl.textContent='';
    const revBtn=$('#voiceRevealBtn');if(revBtn)revBtn.textContent='👁️ إظهار النص';
    if(wordsBox)wordsBox.innerHTML=rawWords.map((w,i)=>`<span class="recite-word ${i===0?'current':''}" data-widx="${i}">${esc(w)}</span>`).join(' ');
    const st=$('#voiceReciteStatus');if(st)st.textContent='اضغط على «ابدأ التسميع» واقرأ بصوتك في الميكروفون...';
    const micBtn=$('#voiceMicToggle');
    if(micBtn){micBtn.classList.remove('listening');micBtn.innerHTML='🎙️ ابدأ التسميع';}
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  /* ── التسميع الصوتي ─────────────────────────────────────────────
     المتصفح يعيد كلمات بلا تشكيل وبإملاء حديث، فنطابقها مع نص المصحف المعياري
     (بعد تطبيعه) وعند التطابق تظهر الكلمة كما في المصحف: بالتشكيل الكامل.
     نعيد الحساب من نص الجلسة كله في كل نتيجة، حتى لا تُعدّ الكلمة مرتين. */
  let reciteWanted=false;
  function lev(a,b){
    if(a===b)return 0;
    const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
    let prev=Array.from({length:n+1},(_,i)=>i);
    for(let i=1;i<=m;i++){
      const cur=[i];
      for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
    }
    return prev[n];
  }
  function reciteWordsMatch(sp,ex){
    if(!sp||!ex)return false;
    if(sp===ex)return true;
    if(sp.length<4||ex.length<4)return false;
    const d=lev(sp,ex);
    return d<=1||(ex.length>=8&&d<=2);
  }
  function alignRecite(spoken,expected){
    const status=new Array(expected.length).fill(0); // 1 مطابقة، 2 كلمة فُوّتت
    let j=0;
    for(const sw of spoken){
      if(j>=expected.length)break;
      if(reciteWordsMatch(sw,expected[j])){status[j]=1;j++;}
      else if(j+1<expected.length&&reciteWordsMatch(sw,expected[j+1])){status[j]=2;status[j+1]=1;j+=2;}
    }
    return {status,next:j};
  }
  function stopVoiceRecite(){
    reciteWanted=false;
    if(activeReciteRecognition){try{activeReciteRecognition.stop()}catch{}activeReciteRecognition=null;}
    const micBtn=$('#voiceMicToggle');
    if(micBtn){micBtn.classList.remove('listening');micBtn.innerHTML='🎙️ ابدأ التسميع';}
  }
  function toggleVoiceReciteMic(){
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){
      toast('المتصفح الحالي لا يدعم التعرف الصوتي. جرّب Chrome أو Edge أو Safari.');
      return;
    }
    const st=$('#voiceReciteStatus');
    if(activeReciteRecognition){
      stopVoiceRecite();
      if(st)st.textContent='تم إيقاف الاستماع.';
      return;
    }
    if(!activeReciteAyah)return;
    const {v}=activeReciteAyah;
    const rawWords=String(v.text||'').split(/\s+/).filter(Boolean);
    const normWords=rawWords.map(normalizeArabic);
    const micBtn=$('#voiceMicToggle'),heard=$('#voiceReciteHeard');
    let committed='',done=false;
    reciteWanted=true;

    const paint=(finalText,interim)=>{
      const spokenRaw=(finalText+' '+interim).trim();
      const spoken=normalizeArabic(spokenRaw).split(/\s+/).filter(Boolean);
      const {status,next}=alignRecite(spoken,normWords);
      document.querySelectorAll('#voiceReciteWords .recite-word').forEach((el,idx)=>{
        el.classList.toggle('matched',status[idx]===1);
        el.classList.toggle('skipped',status[idx]===2);
        el.classList.toggle('current',idx===next);
      });
      if(heard)heard.textContent=spokenRaw?('سمعتك: '+spokenRaw):'';
      const okCount=status.filter(x=>x===1).length;
      if(next>=normWords.length){
        done=true;
        const missed=status.filter(x=>x===2).length;
        if(st)st.textContent=missed?`اكتملت الآية، لكن فاتتك ${missed} كلمة (بالأحمر). أعد المحاولة للتثبيت.`:'🎉 ما شاء الله! قرأت الآية كاملة.';
        if(!missed)toast('ما شاء الله! تلاوة صحيحة ✅');
        const box=$('#voiceReciteWords');if(box)box.classList.remove('blind');
        stopVoiceRecite();
      }else if(st){
        st.textContent=`ظهرت ${okCount} من ${normWords.length} كلمة…`;
      }
    };

    const run=()=>{
      const rec=new SpeechRecognition();
      rec.lang='ar-SA';
      rec.continuous=true;
      rec.interimResults=true;
      rec.maxAlternatives=1;
      let sessionFinal='';
      rec.onstart=()=>{
        if(micBtn){micBtn.classList.add('listening');micBtn.innerHTML='⏹️ إيقاف الاستماع';}
        if(st&&!done)st.textContent='🎙️ أسمعك… ابدأ القراءة.';
      };
      rec.onresult=e=>{
        let fin='',interim='';
        for(let i=0;i<e.results.length;i++){
          const r=e.results[i];
          if(r.isFinal)fin+=r[0].transcript+' ';else interim+=r[0].transcript+' ';
        }
        sessionFinal=fin;
        paint((committed+' '+fin).trim(),interim.trim());
      };
      rec.onerror=e=>{
        if(e.error==='not-allowed'||e.error==='service-not-allowed'){reciteWanted=false;toast('اسمح بالوصول للميكروفون لاستخدام التسميع.');}
        else if(e.error==='network'){reciteWanted=false;toast('التسميع الصوتي يحتاج اتصالًا بالإنترنت.');}
      };
      rec.onend=()=>{
        committed=(committed+' '+sessionFinal).trim();
        if(reciteWanted&&!done){ // يتوقف Chrome تلقائيًا بعد صمت قصير، فنستأنف
          try{run();return;}catch{}
        }
        activeReciteRecognition=null;
        if(micBtn){micBtn.classList.remove('listening');micBtn.innerHTML='🎙️ ابدأ التسميع';}
      };
      activeReciteRecognition=rec;
      try{rec.start();}catch{reciteWanted=false;activeReciteRecognition=null;}
    };
    run();
  }

  // أزرار لوحة التسميع (تُربط مرة واحدة بالتفويض)
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#voiceMicToggle,#closeVoiceRecite,#voiceNextAyahBtn,#voiceRevealBtn');
    if(!btn)return;
    if(btn.id==='voiceMicToggle')toggleVoiceReciteMic();
    else if(btn.id==='closeVoiceRecite'){stopVoiceRecite();const p=$('#voiceRecitePanel');if(p)p.hidden=true;}
    else if(btn.id==='voiceRevealBtn'){
      const box=$('#voiceReciteWords');if(!box)return;
      const blind=box.classList.toggle('blind');
      btn.textContent=blind?'👁️ إظهار النص':'🙈 إخفاء النص';
    }
    else if(btn.id==='voiceNextAyahBtn'&&activeReciteAyah){
      const {s,a,su}=activeReciteAyah;
      if(a<su.verses.length){
        startVoiceRecite(s,a+1);
        document.getElementById('mushaf-ayah-'+(a+1))?.scrollIntoView({behavior:'smooth',block:'center'});
      }else toast('هذه آخر آية في السورة.');
    }
  });

  function openAyahShareModal(su,v){
    const modal=$('#ayahShareModal');if(!modal)return;
    activeSharePayload={su,v};
    const sub=$('#shareModalSubtitle');if(sub)sub.textContent=`${su.name} · الآية ${v.a}`;
    const txt=$('#sharePreviewText');if(txt)txt.textContent=`﴿ ${v.text} ﴾`;
    const ref=$('#sharePreviewRef');if(ref)ref.textContent=`سورة ${su.name} · الآية ${v.a}`;
    const prev=$('#ayahSharePreview');
    if(prev){
      prev.className = `ayah-share-preview-card preview-theme-${currentShareTheme||'mihrab'}`;
    }
    modal.classList.add('open','active');modal.setAttribute('aria-hidden','false');
  }
  function closeAyahShareModal(){
    const modal=$('#ayahShareModal');if(!modal)return;
    modal.classList.remove('open','active');modal.setAttribute('aria-hidden','true');
    activeSharePayload=null;
  }
  async function shareAyah(s,a){
    const su=quran.find(x=>Number(x.s)===Number(s)),v=su?.verses?.find(x=>Number(x.a)===Number(a));
    if(!su||!v)return;
    openAyahShareModal(su,v);
  }
  const toAr=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
  function renderSurah(scroll=false){
    const s=currentSurah();if(!s)return;
    $('#mushafSurahTitle').textContent=s.name;
    $('#mushafSurahMeta').textContent=`${s.s} · ${s.type||'—'} · ${s.count} آيات`;
    const box=$('#mushafVerses');if(box)box.classList.toggle('mask-mode',maskMode);
    const panel=$('#ayahStudyPanel');
    if(panel&&box&&box.contains(panel)){panel.hidden=true;box.after(panel);}
    
    const isTawbah = Number(s.s) === 9;
    const isFatiha = Number(s.s) === 1;
    const basmalaHtml = (!isTawbah && !isFatiha) ? `
      <div class="basmala-ornament">
        <span class="basmala-text">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>
      </div>` : '';

    const surahHeaderHtml = `
      <div class="surah-header-ornament">
        <div class="surah-corner surah-corner-tl"></div>
        <div class="surah-corner surah-corner-tr"></div>
        <div class="surah-corner surah-corner-bl"></div>
        <div class="surah-corner surah-corner-br"></div>
        <div class="surah-title-wrap">
          <span class="surah-side-ornament">۞</span>
          <h2 class="surah-main-name">سُورَةُ ${esc(s.name)}</h2>
          <span class="surah-side-ornament">۞</span>
        </div>
        <div class="surah-meta-row">
          <span><span class="ayah-ico" data-ico="scroll"></span> ${esc(s.type || '')}</span>
          <span>•</span>
          <span><span class="ayah-ico" data-ico="study"></span> ${s.count} آيات</span>
          <span>•</span>
          <span>ترتيبها: ${s.s}</span>
        </div>
      </div>
      ${basmalaHtml}
    `;

    const versesHtml = s.verses.map(v=>`<article class="mushaf-ayah ${Number(v.a)===selectedAyah?'selected':''}" id="mushaf-ayah-${v.a}" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${esc(s.name)} · الآية ${v.a}</div><div class="mushaf-ayah-text" tabindex="0" role="button" aria-label="دراسة الآية ${v.a}">${esc(v.text)} <span class="ayah-number-badge" aria-label="آية ${v.a}"><span>${toAr(v.a)}</span></span></div><div class="mushaf-ayah-actions"><button type="button" class="ayah-action-btn" data-play="${v.a}" title="استماع"><span class="ayah-ico" data-ico="play"></span> استماع</button><button type="button" class="ayah-action-btn" data-study="${v.a}" title="دراسة وتدارس الآية"><span class="ayah-ico" data-ico="study"></span> دراسة الآية</button><button type="button" class="ayah-action-btn" data-mark="${v.a}" title="تثبيت موضع قراءتك عند هذه الآية للعودة إليها لاحقًا">${Number(v.a)===selectedAyah?'<span class="ayah-ico" data-ico="pinned"></span> موضع القراءة':'<span class="ayah-ico" data-ico="pin"></span> حفظ الموضع'}</button><button type="button" class="ayah-action-btn" data-recite="${v.a}" title="تسميع بالصوت: انطق الآية وتظهر كلماتك بالتشكيل"><span class="ayah-ico" data-ico="recite"></span> تسميع</button><button type="button" class="ayah-action-btn" data-share="${v.a}" title="مشاركة"><span class="ayah-ico" data-ico="share"></span> مشاركة</button></div></article>`).join('');
    box.innerHTML = surahHeaderHtml + versesHtml;
    box.querySelectorAll('.mushaf-ayah-text').forEach(t=>{
      const activate=()=>{
        if(maskMode){t.classList.toggle('revealed');}
        else{const a=Number(t.closest('.mushaf-ayah')?.dataset?.ayah);if(a)openStudy(s.s,a);}
      };
      t.onclick=activate;
      t.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};
    });
    box.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>openStudy(s.s,Number(b.dataset.study)));
    box.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playAyah(s.s,Number(b.dataset.play)));
    box.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{
      selectedAyah=Number(b.dataset.mark);
      savePosition();
      box.querySelectorAll('.mushaf-ayah').forEach(el=>el.classList.toggle('selected',Number(el.dataset.ayah)===selectedAyah));
      box.querySelectorAll('[data-mark]').forEach(el=>{
        const isThis=Number(el.dataset.mark)===selectedAyah;
        el.innerHTML=isThis?'<span class="ayah-ico" data-ico="pinned"></span> موضع القراءة':'<span class="ayah-ico" data-ico="pin"></span> حفظ الموضع';
      });
      toast(`تم حفظ موضع قراءتك في ${s.name} · الآية ${selectedAyah} 📍`);
      window.dispatchEvent(new CustomEvent('rafiq-glow', { detail: { type: 'ward', msg: 'تم حفظ موضع قراءتك في المصحف 📍' } }));
    });
    box.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>shareAyah(s.s,Number(b.dataset.share)));
    box.querySelectorAll('[data-recite]').forEach(b=>b.onclick=()=>startVoiceRecite(s.s,Number(b.dataset.recite)));
    if(scroll)document.querySelector('#mushafTop')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function renderStudyShell(s,v){
    let panel=$('#ayahStudyPanel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='ayahStudyPanel';
      panel.className='ayah-study';
      $('#mushafVerses')?.after(panel);
    }
    const targetAyahEl=document.getElementById('mushaf-ayah-'+v.a);
    if(targetAyahEl){
      targetAyahEl.after(panel);
    } else {
      const box=$('#mushafVerses');
      if(box&&!panel.parentElement)box.appendChild(panel);
    }
    panel.hidden=false;
    panel.innerHTML=`
      <div class="ayah-study-head">
        <div>
          <div class="ayah-study-kicker">أدوات الآية وتدارسها</div>
          <h3>📖 ${esc(s.name)} · الآية ${v.a}</h3>
          <p>${esc(v.text)}</p>
        </div>
        <div class="ayah-study-head-actions">
          <button type="button" class="action info" id="studyListenBtn">🔊 استماع</button>
          <button type="button" class="action" id="studyOfflineBtn">📥 تجهيز الدراسة أوفلاين</button>
          <button type="button" class="action" id="closeMushafStudy">✕ إغلاق</button>
        </div>
      </div>
      <div class="ayah-study-tabs" role="tablist" aria-label="أقسام دراسة الآية">
        <button type="button" class="ayah-study-tab active" id="study-tab-overview" role="tab" aria-selected="true" aria-controls="ayahStudyInner" tabindex="0" data-tab="overview">نظرة عامة</button>
        <button type="button" class="ayah-study-tab" id="study-tab-tafsir" role="tab" aria-selected="false" aria-controls="ayahStudyInner" tabindex="-1" data-tab="tafsir">📖 التفسير</button>
        <button type="button" class="ayah-study-tab" id="study-tab-meanings" role="tab" aria-selected="false" aria-controls="ayahStudyInner" tabindex="-1" data-tab="meanings">🔎 معاني الكلمات</button>
        <button type="button" class="ayah-study-tab" id="study-tab-tajweed" role="tab" aria-selected="false" aria-controls="ayahStudyInner" tabindex="-1" data-tab="tajweed">🎙️ التجويد</button>
        <button type="button" class="ayah-study-tab" id="study-tab-asbab" role="tab" aria-selected="false" aria-controls="ayahStudyInner" tabindex="-1" data-tab="asbab">🕊️ سبب النزول</button>
      </div>
      <div id="ayahStudyInner" role="tabpanel" aria-labelledby="study-tab-overview" tabindex="0"></div>
    `;

    $('#closeMushafStudy').onclick=()=>{
      panel.hidden=true;
      selectedAyah=0;
      savePosition();
      document.querySelectorAll('.mushaf-ayah.selected').forEach(x=>x.classList.remove('selected'));
      const activeEl=document.getElementById('mushaf-ayah-'+v.a);
      if(activeEl)activeEl.scrollIntoView({behavior:'smooth',block:'nearest'});
      if(window.RAFIQ_RETURN_TO_SESSION){
        window.RAFIQ_RETURN_TO_SESSION=false;
        window.RAFIQ_MEM?.startSession?.();
      }
    };
    $('#studyListenBtn').onclick=()=>playAyah(s.s,v.a);
    $('#studyOfflineBtn').onclick=()=>prepareStudyOffline(s.s,v.a);
    const selectTab=(tab,{focus=false}={})=>{
      studyTab=tab;
      const tabs=[...panel.querySelectorAll('.ayah-study-tab')];
      const active=tabs.find(x=>x.dataset.tab===tab);
      tabs.forEach(x=>{const selected=x===active;x.classList.toggle('active',selected);x.setAttribute('aria-selected',String(selected));x.tabIndex=selected?0:-1;});
      $('#ayahStudyInner')?.setAttribute('aria-labelledby',active?.id||'');
      if(focus) active?.focus();
      renderStudyBody(s,v);
    };
    panel.querySelectorAll('.ayah-study-tab').forEach((b,index)=>{
      b.onclick=()=>selectTab(b.dataset.tab);
      b.onkeydown=e=>{
        const tabs=[...panel.querySelectorAll('.ayah-study-tab')];
        let next=index;
        if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(index-1+tabs.length)%tabs.length;
        else if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(index+1)%tabs.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=tabs.length-1;
        else return;
        e.preventDefault();selectTab(tabs[next].dataset.tab,{focus:true});
      };
    });

    renderStudyBody(s,v);

    requestAnimationFrame(()=>{
      setTimeout(()=>{
        panel.scrollIntoView({behavior:'smooth',block:'start'});
      },60);
    });
  }

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
    box.innerHTML=`<section class="ayah-detail quranpedia-direct-card"><div class="source-kicker">${esc(title)}</div><iframe class="quranpedia-study-frame" title="${esc(title)}" src="${esc(src)}" loading="lazy" sandbox="allow-scripts allow-same-origin" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="quranpedia-source-note">المصدر المباشر: Quranpedia</div>${sourceLinks(s,a,book)}</section>`;
  }

  function renderAsbabIbtida(box,s,a,v){
    box.innerHTML=`
      <section class="ayah-detail asbab-ibtida-card">
        <div class="source-kicker">علم أسباب النزول — التوجيه والتحقيق المعتمد</div>
        <div class="asbab-ibtida-badge">✨ نزول ابتدائي عام</div>
        <h4 class="asbab-ibtida-title">نزلت هذه الآية الكريمة ابتداءً للهداية والتشريع العام</h4>
        <div class="asbab-scholarly-content">
          <p>
            هذه الآية الكريمة نزلت <strong>ابتداءً</strong> ضمن السياق القرآني العام لبيان التوحيد وهداية الخلق وتشريع الأحكام، ولم يرتبط نزولها بواقعةٍ خاصة أو سؤالٍ عينيّ مخصوص، وهو الغالب الأعم في أكثر آيات كتاب الله العزيز.
          </p>
          <div class="asbab-quote-box">
            <blockquote>
              «القرآن قسمان: قسم نزل ابتداءً وهو الأكثر، وقسم نزل عقب واقعة أو سؤال»
            </blockquote>
            <div class="asbab-quote-ref">— الحافظ جلال الدين السيوطي رحمه الله في «لباب النقول في أسباب النزول»، والإمام الزركشي في «البرهان في علوم القرآن»</div>
          </div>
          <p>ولمعرفة تفسير هذه الآية ومقاصدها وغريب ألفاظها، يرجى الانتقال مباشرة إلى:</p>
          <div class="asbab-shortcuts">
            <button type="button" class="action primary asbab-quick-nav" data-target="tafsir">📖 قراءة التفسير الميسر</button>
            <button type="button" class="action asbab-quick-nav" data-target="meanings">🔎 بيان معاني الكلمات</button>
          </div>
        </div>
        ${sourceLinks(s,a,ASBAB_BOOK)}
      </section>
    `;

    box.querySelectorAll('.asbab-quick-nav').forEach(btn=>{
      btn.onclick=()=>{
        const target=btn.dataset.target;
        const panel=box.closest('#ayahStudyPanel');
        panel?.querySelector(`.ayah-study-tab[data-tab="${target}"]`)?.click();
      };
    });
  }

  async function renderBook(box,s,a,book,title,v){
    loading(box);
    const data=await CONTENT?.getBookContent?.(s,a,book);
    const cleanedText=cleanIslamicText(data?.text);
    const hasText=Boolean(cleanedText);
    if(!hasText){
      if(book===ASBAB_BOOK){
        renderAsbabIbtida(box,s,a,v);
        return;
      }
      if(navigator.onLine){renderBookFrame(box,s,a,book,title);return;}
      box.innerHTML=`<section class="ayah-detail"><h4>${esc(title)}</h4><p>المادة غير محفوظة على جهازك بعد. جهّز المواد العلمية من الإعدادات مرة واحدة عند توفر الإنترنت.</p>${sourceLinks(s,a,book)}</section>`;
      return;
    }
    const paragraphs=cleanedText.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join('');
    const bookLabel=book===ASBAB_BOOK?'كتاب أسباب نزول القرآن — للإمام أبي الحسن الواحدي النيسابوري (ت 468هـ)':esc(data.book?.name||CONTENT.BOOKS?.[book]?.name||'الموسوعة القرآنية');
    box.innerHTML=`<section class="ayah-detail quranpedia-direct-card"><div class="source-kicker">${esc(title)}</div><div class="source-content">${paragraphs}</div><div class="quranpedia-source-note">المصدر: ${bookLabel}</div>${sourceLinks(s,a,book)}</section>`;
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
        let text;
        const cleaned=cleanIslamicText(data?.text);
        if(cleaned){
          text=cleaned.split(/\n{2,}/).filter(Boolean).slice(0,2).map(x=>`<p>${esc(x)}</p>`).join('');
        } else if(book===ASBAB_BOOK){
          text=`<p class="asbab-overview-ibtida"><strong>✨ نزول ابتدائي:</strong> نزلت الآية ابتداءً للهداية والتشريع العام، ولم يُنقل لها سبب نزول خاص بحادثة عينية في كتب الأسباب المسندة (كالواحدي والسيوطي).</p>`;
        } else {
          text=`<p class="study-unavailable">المادة غير متاحة حاليًا لهذه الآية.</p>`;
        }
        return `<section class="ayah-detail"><h4>${esc(title)}</h4><div>${text}</div><button type="button" class="action study-open-tab" data-open-tab="${book===TAFSIR_BOOK?'tafsir':book===MEANINGS_BOOK?'meanings':'asbab'}">فتح القسم كاملًا</button></section>`;
      }).join('')}</div>`;
      box.querySelectorAll('[data-open-tab]').forEach(b=>b.onclick=()=>box.closest('#ayahStudyPanel')?.querySelector(`.ayah-study-tab[data-tab="${b.dataset.openTab}"]`)?.click());
      return;
    }
    const book=studyTab==='tafsir'?TAFSIR_BOOK:studyTab==='meanings'?MEANINGS_BOOK:ASBAB_BOOK;
    const title=studyTab==='tafsir'?'التفسير الميسر':studyTab==='meanings'?'معاني الكلمات':'سبب النزول — الواحدي';
    return renderBook(box,s.s,v.a,book,title,v);
  }

  async function openStudy(s,a){
    const sNo=Number(s);
    const aNo=Number(a);
    const su=quran.find(x=>Number(x.s)===sNo),v=su?.verses?.find(x=>Number(x.a)===aNo);
    if(!su||!v)return;
    selectedAyah=aNo;
    studyTab='overview';
    savePosition();
    if(surahNo!==sNo){
      surahNo=sNo;
      renderIndex();
      renderSurah(false);
    } else {
      document.querySelectorAll('.mushaf-ayah.selected').forEach(x=>x.classList.remove('selected'));
      const activeEl=document.getElementById('mushaf-ayah-'+aNo);
      if(activeEl)activeEl.classList.add('selected');
    }
    prefetchStudy(sNo,aNo);
    renderStudyShell(su,v);
  }
  window.openAyahStudy=openStudy;window.shareRafiqAyah=shareAyah;
  async function playAyah(s,a){const list=window.RAFIQ_RECITERS||[],pref=window.RAFIQ_API?.state?.prefs?.reciter||window.RAFIQ_API?.state?.audio?.reciter,r=list.find(x=>x.folder===pref)||list[0],audio=$('#quranAudio');if(!r||!audio)return toast('اختر قارئًا من صفحة التلاوات أولًا.');const url=r.source==='mp3quran'?`${r.server}${String(s).padStart(3,'0')}.mp3`:`https://everyayah.com/data/${r.folder}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`;const playable=await CONTENT?.getPlayableAudio(url)||url;audio.src=playable;audio.currentTime=0;audio.play().then(()=>toast(`بدأت تلاوة الآية ${a}`)).catch(()=>toast('التلاوة تحتاج اتصالًا أو تنزيلًا مسبقًا.'))}
  let initialized=false;
  async function start(){
    if(initialized)return;
    let data=window.RAFIQ_API?.quran||window.RAFIQ_QURAN||[];
    if((!Array.isArray(data)||data.length<114)&&typeof window.RAFIQ_FETCH_QURAN==='function'){
      try{const d=await window.RAFIQ_FETCH_QURAN();if(Array.isArray(d)&&d.length===114)data=d;}catch{}
    }
    // Standalone fallback: the Mushaf must not depend on another UI module having fired first.
    if(!Array.isArray(data)||data.length<114){
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
    const maskBtn=$('#mushafMaskBtn');
    if(maskBtn){
      maskBtn.addEventListener('click',()=>{
        maskMode=!maskMode;
        const box=$('#mushafVerses'), hint=$('#mushafMaskHint');
        if(box)box.classList.toggle('mask-mode',maskMode);
        if(hint)hint.hidden=!maskMode;
        maskBtn.classList.toggle('active',maskMode);
        maskBtn.setAttribute('aria-pressed',String(maskMode));
        maskBtn.textContent=maskMode?'👁️ كشف الكل':'🙈 تسميع';
        if(!maskMode){
          box?.querySelectorAll('.mushaf-ayah-text.revealed').forEach(el=>el.classList.remove('revealed'));
        }else{
          toast('تم تفعيل وضع التسميع: اضغط على أي آية لكشفها والتحقق ✅');
        }
      });
    }
    $('#closeAyahShareModal')?.addEventListener('click',closeAyahShareModal);
    $('#ayahShareModal')?.addEventListener('click',e=>{if(e.target===$('#ayahShareModal'))closeAyahShareModal();});
    $$('#shareStyleBtns .btn-share-style').forEach(b=>{
      b.onclick=()=>{
        $$('#shareStyleBtns .btn-share-style').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        currentShareTheme = b.dataset.shareTheme || 'mihrab';
        const prev = $('#ayahSharePreview');
        if(prev){
          prev.className = `ayah-share-preview-card preview-theme-${currentShareTheme}`;
        }
      };
    });
    $('#shareAsImageBtn')?.addEventListener('click',async()=>{
      if(!activeSharePayload)return;
      const {su,v}=activeSharePayload;
      closeAyahShareModal();
      if(typeof window.shareAsImage==='function'){
        await window.shareAsImage({text:`﴿ ${v.text} ﴾`,ref:`سورة ${su.name} · الآية ${v.a}`,label:'القرآن الكريم',fallbackTitle:`${su.name} · الآية ${v.a}`,theme:currentShareTheme});
      }else toast('جاري تجهيز الصورة...');
    });
    $('#shareAsTextBtn')?.addEventListener('click',async()=>{
      if(!activeSharePayload)return;
      const {su,v}=activeSharePayload;
      const formatted=`﴿ ${v.text} ﴾\nسورة ${su.name} · الآية ${v.a}\n— رفيق القرآن`;
      closeAyahShareModal();
      try{
        if(navigator.share){await navigator.share({title:`${su.name} · الآية ${v.a}`,text:formatted});}
        else{await navigator.clipboard.writeText(formatted);toast('تم نسخ الآية الكريمة للمشاركة ✅');}
      }catch{toast('تم نسخ النص');}
    });
    $('#mushafTop')?.addEventListener('click',e=>{if(e.target.closest('button,input'))return;window.scrollTo({top:0,behavior:'smooth'});});
    window.addEventListener('rafiq-quran-ready',()=>start(),{once:true});
    document.addEventListener('rafiq-data-ready',()=>start(),{once:true});
    start();
  }
  init();
})();
