/* Rafiq Quran — Memorization Core v2
 * Purpose: make memorization/review the primary workflow.
 * Modes after the initial 7 successful stabilization reviews:
 *   1) weekly: fixed 7-day review cycle
 *   2) spaced: FSRS-like adaptive intervals using difficulty + stability + retrievability
 * This is an FSRS-like scheduler, not a verbatim FSRS implementation.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'rafiq-memorization-core-v2';
  const SCHEMA_VERSION = 2;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = v => { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; };
  const toast = m => window.rafiqToast?.(m);

  const DEFAULT = {
    version: SCHEMA_VERSION,
    settings: {
      newPerDay: 10,
      reviewPerDay: 30,
      sessionMinutes: 25,
      reviewMode: 'spaced',
      weeklyReviewDay: 5,
      startSurah: 1,
      startAyah: 1
    },
    items: [],
    priorRanges: [],
    history: [],
    sessions: [],
    migratedLegacy: false
  };

  let data = load();
  let quran = [];
  let bound = false;
  let todayKeyCache = null;

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function load(){
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return v && typeof v === 'object' ? merge(v) : clone(DEFAULT);
    } catch { return clone(DEFAULT); }
  }
  function merge(raw){
    const d = clone(DEFAULT);
    return {
      ...d,
      ...raw,
      settings: { ...d.settings, ...(raw.settings || {}) },
      items: Array.isArray(raw.items) ? raw.items : [],
      priorRanges: Array.isArray(raw.priorRanges) ? raw.priorRanges : [],
      history: Array.isArray(raw.history) ? raw.history : [],
      sessions: Array.isArray(raw.sessions) ? raw.sessions : []
    };
  }
  function save(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
    document.dispatchEvent(new CustomEvent('rafiq-memorization-change'));
  }

  async function loadQuran(){
    if (quran.length === 114) return quran;
    if (Array.isArray(window.RAFIQ_QURAN) && window.RAFIQ_QURAN.length === 114) return (quran = window.RAFIQ_QURAN);
    try {
      const r = await fetch('./quran-uthmani.json', { cache:'force-cache' });
      if (!r.ok) throw new Error('quran');
      quran = await r.json();
    } catch { quran = []; }
    return quran;
  }

  function ritualKey(){
    try { if (typeof window.RAFIQ_GET_RITUAL_KEY === 'function') return window.RAFIQ_GET_RITUAL_KEY(); } catch {}
    const d = new Date();
    return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function keyDate(key){
    const m = /^rafiq-(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||''));
    return m ? new Date(Number(m[1]), Number(m[2])-1, Number(m[3])) : new Date();
  }
  function addDays(key,n){ const d = keyDate(key); d.setDate(d.getDate()+Number(n||0)); return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function diffDays(a,b){ return Math.round((keyDate(b)-keyDate(a))/86400000); }
  function today(){ const k=ritualKey(); todayKeyCache=k; return k; }
  function keyShort(key){ const d=keyDate(key); return new Intl.DateTimeFormat('ar-EG',{weekday:'short',day:'numeric',month:'short'}).format(d); }
  function humanDate(key){ return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long'}).format(keyDate(key)); }

  function getSurah(s){ return quran.find(x=>Number(x.s)===Number(s)) || quran[Number(s)-1] || null; }
  function verseCount(s){ const x=getSurah(s); return Number(x?.count || x?.verses?.length || 0); }
  function normPoint(s,a){
    s = Math.max(1, Math.min(114, Number(s)||1));
    const c = verseCount(s)||1;
    a = Math.max(1, Math.min(c, Number(a)||1));
    return {s,a};
  }
  function cmpPoint(a,b){ return a.s===b.s ? a.a-b.a : a.s-b.s; }
  function nextPoint(p){ const c=verseCount(p.s); if(p.a<c)return {s:p.s,a:p.a+1}; if(p.s<114)return {s:p.s+1,a:1}; return null; }
  function pointsBetween(start,end,limit=10000){
    let a=normPoint(start.s,start.a), b=normPoint(end.s,end.a);
    if(cmpPoint(a,b)>0)[a,b]=[b,a];
    const out=[]; let p=a; let guard=0;
    while(p && cmpPoint(p,b)<=0 && guard++<limit){ out.push({...p}); if(cmpPoint(p,b)===0) break; p=nextPoint(p); }
    return out;
  }
  function rangeLabel(r){
    const a=normPoint(r.start.s,r.start.a), b=normPoint(r.end.s,r.end.a), sa=getSurah(a.s), sb=getSurah(b.s);
    if(!sa||!sb)return 'نطاق غير محدد';
    if(a.s===b.s && a.a===1 && b.a===verseCount(a.s)) return `${sa.name} · سورة كاملة`;
    return a.s===b.s ? `${sa.name} · الآيات ${a.a}–${b.a}` : `${sa.name} ${a.a} → ${sb.name} ${b.a}`;
  }
  function id(prefix='m'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
  function containsPoint(r,p){ return pointsBetween(r.start,r.end,20000).some(x=>x.s===p.s&&x.a===p.a); }

  function collectLegacy(){
    const candidates=['rafiq-memorization-core-v1','rafiq-state-v85'];
    for(const key of candidates){
      try{ const x=JSON.parse(localStorage.getItem(key)||'null'); if(x)return x; }catch{}
    }
    return null;
  }
  function migrateLegacyOnce(){
    if(data.migratedLegacy) return;
    const legacy=collectLegacy();
    const ayahs=Array.isArray(legacy?.memorizedAyahs)?legacy.memorizedAyahs:[];
    if(ayahs.length){
      const pts=ayahs.map(x=>{const m=/^(\d+):(\d+)$/.exec(String(x));return m?{s:+m[1],a:+m[2]}:null}).filter(Boolean).sort(cmpPoint);
      let start=null,end=null;
      for(const p of pts){
        if(!start){start=end=p;continue;}
        const n=nextPoint(end);
        if(n&&n.s===p.s&&n.a===p.a){end=p;continue;}
        addPrior(start,end,'legacy'); start=end=p;
      }
      if(start)addPrior(start,end,'legacy');
    }
    data.migratedLegacy=true; save();
  }
  function addPrior(start,end,source='manual'){
    const item={id:id('prior'),start,end,source,addedKey:today(),mode:data.settings.reviewMode,phase:'review',dueKey:today(),interval:7,stability:7,difficulty:5,history:[],lapses:0,overdue:0};
    data.priorRanges.push(item); return item;
  }

  function getItem(id){ return data.items.find(x=>x.id===id) || data.priorRanges.find(x=>x.id===id) || null; }
  function allReviewable(){ return [...data.items,...data.priorRanges]; }
  function status(item,key=today()){
    if(item.phase==='stabilizing'){
      const completed = new Set((item.stabilizationHistory||[]).map(x=>x.key));
      const done=Math.min(7,completed.size);
      const due=!completed.has(key) && !item.snoozedUntil;
      return {kind:'stabilizing',done,daysLeft:7-done,due,label:`تثبيت · ${done+1} من 7`};
    }
    const due=item.dueKey ? diffDays(key,item.dueKey)>=0 : true;
    return {kind:'review',due,label:item.mode==='weekly'?'مراجعة أسبوعية':'مراجعة متباعدة',interval:Number(item.interval||7),next:item.dueKey};
  }

  function proposedNewRange(key=today()){
    const n=Math.max(1,Number(data.settings.newPerDay)||10);
    let p=normPoint(data.settings.startSurah,data.settings.startAyah);
    const existing=[...allReviewable()];
    for(const r of existing){ if(cmpPoint(r.end,p)>=0){ const q=nextPoint(r.end); if(q)p=q; } }
    const out=[]; let cur=p, guard=0;
    while(cur&&out.length<n&&guard++<20000){ out.push(cur); cur=nextPoint(cur); }
    if(!out.length)return null;
    return {start:out[0],end:out[out.length-1],key};
  }

  function completedNewFor(key){ return data.items.find(x=>x.origin==='new'&&x.createdKey===key) || null; }
  function recordNewAsMemorized(range,key=today()){
    if(completedNewFor(key)) return completedNewFor(key);
    const item={
      id:id('new'),origin:'new',start:range.start,end:range.end,createdKey:key,
      phase:'stabilizing',stabilizationHistory:[],mode:data.settings.reviewMode,
      interval:7,stability:7,difficulty:5,history:[],lapses:0,overdue:0
    };
    data.items.push(item);save();render();renderHomeCore();toast(`تم تسجيل ${rangeLabel(item)} كمحفوظ اليوم.`);return item;
  }

  function normalizeGrade(g){ return ['relearn','hard','good','easy'].includes(g)?g:'good'; }
  function gradeLabel(g){ return ({relearn:'أعد التثبيت',hard:'صعب',good:'جيد',easy:'سهل'})[g]||'جيد'; }

  // FSRS-like: uses stability, difficulty and retrievability to move the next date.
  function scheduleSpaced(item,grade,key){
    const now=key;
    const reviewsBefore=(item.history||[]).filter(x=>x.source==='review'||x.source==='recitation'||x.source==='api').length;
    const stability=Math.max(1,Number(item.stability||7));
    let difficulty=Math.max(1,Math.min(10,Number(item.difficulty||5)));
    if(reviewsBefore===0){
      const first={relearn:1,hard:2,good:7,easy:14};
      item.interval=first[grade]||7;
      item.stability=item.interval;
      item.difficulty=grade==='easy'?4:grade==='good'?5:grade==='hard'?6:7;
      item.dueKey=addDays(now,item.interval);
      if(grade==='relearn')item.lapses=(Number(item.lapses)||0)+1;
      return;
    }
    const previous=item.dueKey;
    const elapsed=previous?Math.max(0,diffDays(previous,now)):0;
    const retrievability=Math.exp(Math.log(0.9)*elapsed/Math.max(1,stability));
    const dDelta={relearn:1.4,hard:.55,good:-.10,easy:-.40}[grade];
    difficulty=Math.max(1,Math.min(10,difficulty+dDelta));
    let nextStability;
    if(grade==='relearn'){
      item.lapses=(Number(item.lapses)||0)+1; nextStability=1;
    }else if(grade==='hard'){
      nextStability=Math.max(2,stability*0.72*Math.max(.85,retrievability));
    }else if(grade==='good'){
      nextStability=Math.max(3,stability*(1.35+(10-difficulty)*.045)*Math.max(.9,retrievability));
    }else{
      nextStability=Math.max(5,stability*(1.9+(10-difficulty)*.06)*Math.max(.95,retrievability));
    }
    let interval=Math.round(nextStability);
    if(grade==='relearn')interval=1;
    else if(grade==='hard')interval=Math.max(2,Math.min(14,interval));
    else if(grade==='good')interval=Math.max(3,Math.min(90,interval));
    else interval=Math.max(5,Math.min(180,interval));
    item.stability=nextStability; item.difficulty=difficulty; item.interval=interval; item.dueKey=addDays(now,interval);
  }

  function gradeItem(itemId,grade,key=today(),source='review'){
    const item=getItem(itemId); if(!item)return;
    grade=normalizeGrade(grade);
    item.history=item.history||[];
    const previous=item.history[item.history.length-1];
    if(previous?.key===key && previous?.source===source)return;

    const entry={key,grade,source,at:Date.now()};
    if(item.phase==='stabilizing'){
      item.stabilizationHistory=item.stabilizationHistory||[];
      if(!item.stabilizationHistory.some(x=>x.key===key)) item.stabilizationHistory.push(entry);
      const done=item.stabilizationHistory.length;
      item.history.push(entry);
      if(grade==='relearn'){
        item.stabilizationHistory=[];
        item.lapses=(Number(item.lapses)||0)+1;
        item.dueKey=addDays(key,1);
      } else if(done>=7){
        item.phase='review'; item.mode=item.mode||data.settings.reviewMode; item.stability=7; item.difficulty=5; item.interval=7; item.dueKey=addDays(key,7);
      }
    } else {
      item.history.push(entry);
      if(grade==='relearn'){item.lapses=(Number(item.lapses)||0)+1; item.dueKey=addDays(key,1); item.stability=1; item.interval=1;}
      else if(item.mode==='weekly'){ item.interval=7; item.dueKey=addDays(key,grade==='hard'?2:7); }
      else scheduleSpaced(item,grade,key);
      if(item.dueKey && diffDays(key,item.dueKey)>0) item.overdue=0; else item.overdue=Math.max(0,(item.overdue||0)+1);
    }
    data.history.unshift({itemId:item.id,key,grade,source,at:Date.now(),next:item.dueKey});
    data.history=data.history.slice(0,3000);
    save();render();renderHomeCore();
    if(item.phase==='stabilizing'){
      const done=(item.stabilizationHistory||[]).length;
      if(done>=7) toast(`تم تثبيت ${rangeLabel(item)}. المراجعة القادمة ${humanDate(item.dueKey)}.`);
      else toast(`تم تسجيل ${gradeLabel(grade)} · التثبيت ${done}/7. المراجعة التالية غدًا.`);
    }else{
      toast(`تم تسجيل ${gradeLabel(grade)} · المراجعة القادمة: ${item.dueKey?humanDate(item.dueKey):'غير محددة'}.`);
    }
  }

  function snooze(itemId,key=today()){
    const item=getItem(itemId);if(!item)return;
    item.snoozedUntil=addDays(key,1);
    data.history.unshift({itemId:item.id,key,kind:'snooze',until:item.snoozedUntil,at:Date.now()});
    save();render();renderHomeCore();toast('تأجيل المراجعة إلى الغد.');
  }

  function dueReviewItems(key=today()){
    return allReviewable().filter(i=>status(i,key).due && i.dueKey && diffDays(key,i.dueKey)>=0);
  }
  function stabilizationDue(key=today()){
    return data.items.filter(i=>i.phase==='stabilizing'&&status(i,key).due && !i.snoozedUntil);
  }
  function weeklyDue(key=today()){
    return dueReviewItems(key).filter(i=>i.mode==='weekly');
  }
  function weakItems(){
    return allReviewable().filter(i=>{const h=(i.history||[]).slice(-6);return h.filter(x=>x.grade==='relearn'||x.grade==='hard').length>=2;});
  }
  function countRange(r){ return pointsBetween(r.start,r.end,20000).length; }

  function weeklyLabel(key=today()){
    const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    return data.settings.reviewMode==='weekly'?`كل ${days[Number(data.settings.weeklyReviewDay)||0]}`:'تكرار متباعد حسب أدائك';
  }

  function planForDay(key=today()){
    const planned=completedNewFor(key)||null;
    const newPreview=planned?null:proposedNewRange(key);
    const stabilizing=stabilizationDue(key);
    const due=dueReviewItems(key).sort((a,b)=>String(a.dueKey||'').localeCompare(String(b.dueKey||'')));
    const isWeekly=keyDate(key).getDay()===Number(data.settings.weeklyReviewDay);
    let reviews=due;
    if(!isWeekly && data.settings.reviewMode==='weekly') reviews=due.slice(0,Math.max(1,Number(data.settings.reviewPerDay)||30));
    if(data.settings.reviewMode==='spaced') reviews=due.slice(0,Math.max(1,Number(data.settings.reviewPerDay)||30));
    return {
      key,newPreview,plannedNew:planned,stabilizing,
      reviews,weekly:isWeekly,
      backlog:Math.max(0,due.length-reviews.length),
      tomorrow:planPreview(addDays(key,1))
    };
  }
  function planPreview(key){
    const has=completedNewFor(key);
    return {new:has?has:proposedNewRange(key),review:dueReviewItems(key),stabilization:stabilizationDue(key)};
  }

  function formatNext(item){
    if(!item.dueKey)return 'غير محدد';
    const n=diffDays(today(),item.dueKey);
    return n<=0?'مستحق الآن':n===1?'غدًا':`بعد ${n} أيام · ${humanDate(item.dueKey)}`;
  }

  function extractText(item){
    const verses=[]; for(const p of pointsBetween(item.start,item.end,500)){
      const s=getSurah(p.s); const v=s?.verses?.find(x=>Number(x.a)===p.a); if(v) verses.push(v.text);
      if(verses.length>=500)break;
    }
    return verses;
  }
  function startRecitation(item){
    if(!item)return;
    if(typeof window.openAyahStudy==='function'){ /* study hook remains separate */ }
    const s=item.start.s,a=item.start.a;
    document.querySelector('[data-go="recitations"]')?.click();
    window.rafiqToast?.(`ابدأ التلاوة من ${rangeLabel(item)} — الآية ${a}`);
  }

  function openRecite(itemId){
    const item=getItem(itemId); if(!item)return;
    const verses=extractText(item);
    const modal=document.createElement('div'); modal.className='mem-modal'; modal.id='memReciteModal';
    modal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card" role="dialog" aria-modal="true" aria-labelledby="memReciteTitle">
      <button class="mem-modal-close" type="button" aria-label="إغلاق">×</button>
      <div class="mem-modal-kicker">تسميع</div><h3 id="memReciteTitle">${esc(rangeLabel(item))}</h3>
      <p class="mem-help">حاول التسميع من الذاكرة أولًا. لا يظهر النص إلا عندما تطلب المساعدة.</p>
      <div class="mem-recall-state"><span id="memRecallHint">بدون مساعدة</span><span id="memRecallGradeHint">اختر النتيجة بعد المطابقة</span></div>
      <div class="mem-recite-text" id="memReciteText" hidden>${verses.map(v=>`<p>${esc(v)}</p>`).join('')}</div>
      <div class="mem-recite-hints"><button type="button" data-hint="word">أول كلمة</button><button type="button" data-hint="ayah">أول آية</button><button type="button" data-hint="full">إظهار النص كاملًا</button></div>
      <div class="mem-grade-grid"><button type="button" data-grade="relearn"><b>أعد التثبيت</b><small>نسيت أو احتجت كشف النص</small></button><button type="button" data-grade="hard"><b>صعب</b><small>أكملت مع تردد أو أخطاء</small></button><button type="button" data-grade="good"><b>جيد</b><small>استرجعت أغلبه مع مساعدة بسيطة</small></button><button type="button" data-grade="easy"><b>سهل</b><small>استرجعت المقطع كاملًا دون مساعدة</small></button></div>
      <button class="btn primary mem-reveal-all" type="button">إظهار النص</button>
    </div>`;
    document.body.appendChild(modal);
    const text=modal.querySelector('#memReciteText'); let helpLevel=0;
    const setHelp=(level)=>{helpLevel=level; if(level===0){text.hidden=true;modal.querySelector('#memRecallHint').textContent='بدون مساعدة';} else if(level===1){text.hidden=false; text.style.maxHeight='2.4em'; text.style.overflow='hidden'; modal.querySelector('#memRecallHint').textContent='تم إظهار أول كلمة';} else if(level===2){text.hidden=false;text.style.maxHeight='8em';text.style.overflow='hidden';modal.querySelector('#memRecallHint').textContent='تم إظهار أول آية';} else {text.hidden=false;text.style.maxHeight='none';text.style.overflow='visible';modal.querySelector('#memRecallHint').textContent='تم إظهار النص كاملًا';}};
    const close=()=>modal.remove();
    modal.querySelector('.mem-modal-close').onclick=close; modal.querySelector('.mem-modal-backdrop').onclick=close;
    modal.querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>setHelp(b.dataset.hint==='word'?1:b.dataset.hint==='ayah'?2:3));
    modal.querySelector('.mem-reveal-all').onclick=()=>setHelp(3);
    modal.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{let g=b.dataset.grade;if(g==='easy'&&helpLevel>0)g=helpLevel>=3?'relearn':helpLevel===2?'good':'good';if(g==='good'&&helpLevel>=3)g='hard';gradeItem(item.id,g,today(),'recitation');close();});
    setHelp(0);
  }

  function startSession(){
    const p=planForDay();
    const tasks=[];
    if(p.plannedNew) tasks.push({kind:'new-preview',item:p.plannedNew});
    p.stabilizing.forEach(i=>tasks.push({kind:'stabilization',item:i}));
    p.reviews.forEach(i=>tasks.push({kind:'review',item:i}));
    if(!tasks.length){toast('لا توجد مهمة مستحقة الآن. أحسنت، جدولك منتظم.');return;}
    const modal=document.createElement('div');modal.className='mem-modal';
    modal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-session-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>اعمل المطلوب فقط</h3><p class="mem-help">رتبنا لك الجلسة: الحفظ الجديد → التثبيت → المراجعة المستحقة.</p><div class="mem-session-task-list">${tasks.map((t,i)=>`<article class="mem-session-task" data-task="${esc(t.item.id||'planned')}"><b>${i+1}</b><div><strong>${t.kind==='new-preview'?'الحفظ الجديد':t.kind==='stabilization'?'تثبيت':t.item.mode==='weekly'?'مراجعة أسبوعية':'مراجعة متباعدة'}</strong><span>${esc(rangeLabel(t.item))}</span><small>${t.kind==='stabilization'?`تثبيت ${((t.item.stabilizationHistory||[]).length)+1}/7`:t.kind==='new-preview'?'المقطع المقترح للحفظ اليوم':`الموعد: ${formatNext(t.item)}`}</small></div><div class="mem-task-buttons">${t.kind==='new-preview'?'<button type="button" data-action="mark-new">سجل أنني حفظت</button>':'<button type="button" data-action="recite">تسميع</button><button type="button" data-action="study">دراسة الآية</button><button type="button" data-action="play">استماع</button><button type="button" data-action="snooze">غدًا</button>'}</div></article>`).join('')}</div><div class="mem-session-footer"><span>الجلسة الأساسية ≈ ${Number(data.settings.sessionMinutes)||25} دقيقة</span></div></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove(); modal.querySelector('.mem-modal-close').onclick=close; modal.querySelector('.mem-modal-backdrop').onclick=close;
    modal.querySelectorAll('.mem-session-task').forEach(row=>row.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>{
      const action=btn.dataset.action;
      const id=row.dataset.task; const task=tasks.find(t=>(t.item.id||'planned')===id); if(!task)return;
      if(action==='mark-new'){recordNewAsMemorized(task.item,today());row.querySelector('[data-action="mark-new"]')?.replaceWith(Object.assign(document.createElement('span'),{className:'mem-done',textContent:'✓ تم تسجيل الحفظ'}));render();return;}
      if(action==='recite')return openRecite(id);
      if(action==='study'){const i=getItem(id); if(i)window.openAyahStudy?.(i.start.s,i.start.a,'summary');return;}
      if(action==='play')return startRecitation(task.item);
      if(action==='snooze')return snooze(id);
    }));
  }

  function set(id,val){const e=$(id);if(e)e.textContent=String(val??'');}
  function fillSurahSelect(id,current){
    const el=$(id); if(!el||quran.length!==114)return;
    el.innerHTML=quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('');
    if(current)el.value=String(current);
  }
  function clampAyahInput(id,surah){const el=$(id);if(!el)return;el.max=String(verseCount(surah));if(Number(el.value)>Number(el.max))el.value=el.max;if(Number(el.value)<1)el.value=1;}

  function addNewFromForm(){
    const ss=Number($('#memNewStartSurah')?.value||data.settings.startSurah||1);
    const sa=Number($('#memNewStartAyah')?.value||data.settings.startAyah||1);
    const es=Number($('#memNewEndSurah')?.value||ss);
    const ea=Number($('#memNewEndAyah')?.value||sa);
    const start=normPoint(ss,sa), end=normPoint(es,ea);
    if(cmpPoint(start,end)>0){toast('اجعل بداية الحفظ قبل نهايته.');return;}
    if(pointsBetween(start,end,50000).some(p=>data.items.some(i=>containsPoint(i,p))||data.priorRanges.some(r=>containsPoint(r,p)))){toast('هناك جزء من هذا النطاق مسجل بالفعل.');return;}
    const item=recordNewAsMemorized({start,end},today());
    if(item)toast(`تم تسجيل ${rangeLabel(item)} في دورة التثبيت 7 أيام.`);
  }

  function addPriorFromForm(){
    const ss=Number($('#memPriorStartSurah')?.value||1), sa=Number($('#memPriorStartAyah')?.value||1);
    const es=Number($('#memPriorEndSurah')?.value||ss), ea=Number($('#memPriorEndAyah')?.value||sa);
    const start=normPoint(ss,sa), end=normPoint(es,ea);
    if(cmpPoint(start,end)>0){toast('اجعل بداية المحفوظ قبل نهايته.');return;}
    if(data.priorRanges.some(r=>cmpPoint(r.start,start)===0&&cmpPoint(r.end,end)===0)){toast('هذا النطاق مضاف بالفعل.');return;}
    const item=addPrior(start,end,'manual');
    save(); render(); renderHomeCore(); toast(`تمت إضافة ${rangeLabel(item)} إلى المحفوظ السابق.`);
  }

  function savePlan(){
    const s=Number($('#coreStartSurah')?.value||1), a=Number($('#coreStartAyah')?.value||1);
    const n=Math.max(1,Number($('#coreNewPerDay')?.value||10));
    const r=Math.max(1,Number($('#coreReviewPerDay')?.value||30));
    const mins=Math.max(5,Number($('#coreSessionMinutes')?.value||25));
    const mode=$('#coreReviewMode')?.value==='weekly'?'weekly':'spaced';
    const day=Number($('#coreWeeklyReviewDay')?.value||5);
    data.settings={...data.settings,startSurah:s,startAyah:a,newPerDay:n,reviewPerDay:r,sessionMinutes:mins,reviewMode:mode,weeklyReviewDay:day};
    save();render();renderHomeCore();toast('تم حفظ خطة الحفظ والمراجعة.');
  }

  function quickWholeSurah(){
    const s=Number($('#memPriorStartSurah')?.value||1), count=verseCount(s); if(!count)return;
    $('#memPriorStartAyah').value='1'; $('#memPriorEndSurah').value=String(s); $('#memPriorEndAyah').value=String(count);
  }

  function renderPrior(){
    const box=$('#memPriorList'); if(!box)return;
    const rows=data.priorRanges.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>وضعه: ${i.mode==='weekly'?'مراجعة أسبوعية':'تكرار متباعد'} · الموعد: ${esc(formatNext(i))}</small></div><button class="btn danger" type="button" data-del-prior="${esc(i.id)}">حذف</button></article>`);
    box.innerHTML=rows.join('')||'<div class="mem-empty">لم تضف محفوظًا سابقًا بعد.</div>';
    $$('[data-del-prior]').forEach(b=>b.onclick=()=>{data.priorRanges=data.priorRanges.filter(x=>x.id!==b.dataset.delPrior);save();render();renderHomeCore();});
  }

  function renderToday(){
    const p=planForDay();
    set('#memTodayKey',humanDate(today()));
    const newText=p.plannedNew?rangeLabel(p.plannedNew):p.newPreview?rangeLabel(p.newPreview):'لا يوجد';
    set('#memNewToday',newText);
    set('#memStabilizeToday',p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+countRange(x),0)} آية · ${Math.max(...p.stabilizing.map(x=>(x.stabilizationHistory||[]).length+1),1)}/7`:'لا يوجد مستحق');
    set('#memReviewToday',p.reviews.length?`${p.reviews.reduce((n,x)=>n+countRange(x),0)} آية`:'لا توجد مستحقة');
    set('#memBacklog',p.backlog?`${p.backlog} مجموعة متأخرة`:'لا يوجد تراكم');
    set('#memTomorrowNew',p.tomorrow?.new?`غدًا: ${rangeLabel(p.tomorrow.new)}`:'');
    set('#memTomorrowNewSummary',p.tomorrow?.new?rangeLabel(p.tomorrow.new):'لا يوجد');
    set('#memReviewTomorrow',p.tomorrow?.review?.length?`غدًا: ${p.tomorrow.review.reduce((n,x)=>n+countRange(x),0)} آية`:'غدًا: لا توجد مراجعة مستحقة');
    set('#memSessionCount',`${p.stabilizing.length+p.reviews.length+(p.newPreview?1:0)} محطات`);
    set('#memSessionTime',`${Number(data.settings.sessionMinutes)||25} دقيقة تقريبًا`);
    const nextRelease=data.items.filter(i=>i.phase==='stabilizing').sort((a,b)=>((a.stabilizationHistory?.length||0)-(b.stabilizationHistory?.length||0)))[0];
    set('#memNextRelease',nextRelease?`متبقي ${Math.max(0,7-(nextRelease.stabilizationHistory||[]).length)} جلسات`:'—');
  }

  function renderStats(){
    const prior=data.priorRanges.reduce((n,r)=>n+countRange(r),0);
    const active=data.items.length; const due=dueReviewItems(today()).length;
    const newTotal=data.items.filter(i=>i.origin==='new').reduce((n,i)=>n+countRange(i),0);
    const weak=weakItems().length;
    set('#memPriorCount',`${prior.toLocaleString('ar-EG')} آية`);
    set('#memActiveGroups',`${active} مجموعة`);
    set('#memReviewGroups',`${due} مجموعة مستحقة`);
    set('#memNewTotal',`${newTotal.toLocaleString('ar-EG')} آية`);
    set('#memWeakCount',`${weak} مجموعات تحتاج دعمًا`);
  }

  function renderWeek(){
    const box=$('#memWeekGrid');if(!box)return;
    let html='';
    for(let i=0;i<7;i++){
      const k=addDays(today(),i); const p=planPreview(k);
      const reviewCount=p.review.reduce((n,x)=>n+countRange(x),0); const stab=p.stabilization.reduce((n,x)=>n+countRange(x),0);
      html+=`<article class="mem-week-card ${i===0?'today':''}"><header><b>${i===0?'اليوم':i===1?'غدًا':keyShort(k)}</b><span>${humanDate(k)}</span></header><div><small>الحفظ</small><strong>${p.new?esc(rangeLabel(p.new)):'—'}</strong></div><div><small>التثبيت</small><strong>${stab?`${stab} آية`:'—'}</strong></div><div><small>${data.settings.reviewMode==='weekly'?'المراجعة الأسبوعية':'المراجعة المستحقة'}</small><strong>${reviewCount?`${reviewCount} آية`:'—'}</strong></div></article>`;
    }
    const nextWeekly=[];for(const i of allReviewable()){if(i.mode==='weekly'&&i.dueKey&&diffDays(today(),i.dueKey)>0)nextWeekly.push(i.dueKey)}
    html+=`<article class="mem-week-note"><b>${weeklyLabel()}</b><span>${data.settings.reviewMode==='weekly'?'في يوم المراجعة الأسبوعية نجمع المستحق الأسبوعي، مع إبقاء التثبيتات والضعف في مسارها الخاص.':'المواعيد تختلف حسب أداءك؛ لن ترى تاريخًا تخمينيًا غير محسوب.'}</span></article>`;
    box.innerHTML=html;
  }

  function renderUpcoming(){
    const box=$('#memUpcomingList');if(!box)return;
    const out=[];
    for(const item of data.items.filter(i=>i.phase==='stabilizing')){
      const done=(item.stabilizationHistory||[]).length;
      out.push(`<article><b>${esc(rangeLabel(item))}</b><span>التثبيت: ${done}/7</span><span>${done>=7?'تم التثبيت':`متبقي ${7-done} جلسات`}</span></article>`);
    }
    for(const item of allReviewable().filter(i=>i.phase==='review').sort((a,b)=>String(a.dueKey).localeCompare(String(b.dueKey))).slice(0,12)){
      out.push(`<article><b>${esc(rangeLabel(item))}</b><span>${item.mode==='weekly'?'مراجعة أسبوعية':'تكرار متباعد'}</span><span>التالي: ${esc(formatNext(item))}</span></article>`);
    }
    box.innerHTML=out.join('')||'<div class="mem-empty">لا توجد مراحل مستقبلية الآن.</div>';
  }

  function renderWeak(){
    const box=$('#memWeakList');if(!box)return;
    const list=weakItems().sort((a,b)=>Number(a.difficulty||5)-Number(b.difficulty||5));
    box.innerHTML=list.map(i=>{const h=(i.history||[]).filter(x=>x.grade==='hard'||x.grade==='relearn').length;return `<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${h} نتائج تحتاج دعمًا · ${i.dueKey?`التالي ${esc(formatNext(i))}`:'غير محدد'}</small></div><button class="btn" type="button" data-weak-recite="${esc(i.id)}">تسميع</button></article>`}).join('')||'<div class="mem-empty">لا توجد نقاط ضعف متكررة حاليًا.</div>';
    $$('[data-weak-recite]').forEach(b=>b.onclick=()=>openRecite(b.dataset.weakRecite));
  }

  function render(){
    renderToday();renderStats();renderPrior();renderWeek();renderUpcoming();renderWeak();
    fillSurahSelect('#memPriorStartSurah',data.priorRanges[0]?.start?.s||1);
    fillSurahSelect('#memPriorEndSurah',data.priorRanges[0]?.end?.s||data.priorRanges[0]?.start?.s||1);
    const suggested=proposedNewRange(today());
    fillSurahSelect('#memNewStartSurah',suggested?.start?.s||data.settings.startSurah||1);
    fillSurahSelect('#memNewEndSurah',suggested?.end?.s||suggested?.start?.s||data.settings.startSurah||1);
    if($('#memNewStartAyah'))$('#memNewStartAyah').value=String(suggested?.start?.a||data.settings.startAyah||1);
    if($('#memNewEndAyah'))$('#memNewEndAyah').value=String(suggested?.end?.a||suggested?.start?.a||data.settings.startAyah||1);
    fillSurahSelect('#coreStartSurah',data.settings.startSurah||1);
    if($('#coreStartAyah'))$('#coreStartAyah').value=String(data.settings.startAyah||1);
    if($('#coreNewPerDay'))$('#coreNewPerDay').value=String(data.settings.newPerDay);
    if($('#coreReviewPerDay'))$('#coreReviewPerDay').value=String(data.settings.reviewPerDay);
    if($('#coreSessionMinutes'))$('#coreSessionMinutes').value=String(data.settings.sessionMinutes);
    if($('#coreReviewMode'))$('#coreReviewMode').value=data.settings.reviewMode;
    if($('#coreWeeklyReviewDay'))$('#coreWeeklyReviewDay').value=String(data.settings.weeklyReviewDay);
    clampAyahInput('#memPriorStartAyah',Number($('#memPriorStartSurah')?.value||1));
    clampAyahInput('#memPriorEndAyah',Number($('#memPriorEndSurah')?.value||1));
    clampAyahInput('#coreStartAyah',Number($('#coreStartSurah')?.value||1));
    clampAyahInput('#memNewStartAyah',Number($('#memNewStartSurah')?.value||1));
    clampAyahInput('#memNewEndAyah',Number($('#memNewEndSurah')?.value||1));
    renderGalaxyBridge();
  }

  function renderGalaxyBridge(){
    const totalPrior=data.priorRanges.reduce((n,r)=>n+countRange(r),0);
    const totalNew=data.items.reduce((n,r)=>n+countRange(r),0);
    set('#hifzProgress',`${totalPrior+totalNew} آية في خطة الحفظ`);
    set('#galaxyMeter',`${dueReviewItems(today()).length} مراجعة مستحقة`);
  }

  function renderHomeCore(){
    const host=$('#todayList');if(!host)return;
    const p=planForDay();
    host.innerHTML=`<article class="today-row core-today-row"><b>حفظ اليوم</b><span>${p.newPreview?esc(rangeLabel(p.newPreview)):p.plannedNew?esc(rangeLabel(p.plannedNew)):'لا يوجد'}</span><em>${p.newPreview?'سجّل حفظه بعد الإتقان':'مسجّل'}</em></article><article class="today-row core-today-row"><b>التثبيت</b><span>${p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+countRange(x),0)} آية`:'لا يوجد مستحق'}</span><em>7 جلسات ناجحة</em></article><article class="today-row core-today-row"><b>المراجعة</b><span>${p.reviews.length?`${p.reviews.reduce((n,x)=>n+countRange(x),0)} آية`:'لا توجد مستحقة'}</span><em>${p.backlog?`${p.backlog} متأخر`:'منتظم'}</em></article><article class="today-row core-today-row"><b>جلسة اليوم</b><span>الحفظ → التثبيت → المراجعة</span><button class="inline-cta" id="homeMemSessionBtn" type="button">ابدأ الآن</button></article>`;
    $('#homeMemSessionBtn')?.addEventListener('click',startSession);
  }

  function injectUI(){
    const view=$('#view-plan');
    if(view&&!$('#memCoreRoot')){
      const root=document.createElement('section');root.id='memCoreRoot';root.className='mem-core-root';
      root.innerHTML=`
        <div class="mem-core-head"><div><span class="mem-kicker">الحفظ والمراجعة</span><h2>خطة واحدة، وكل شيء قدامك</h2><p>ابدأ بجلسة اليوم. الحفظ الجديد يُثبّت 7 جلسات، وبعدها يراجع أسبوعيًا أو بتكرار متباعد ذكي حسب اختيارك وأدائك.</p></div><div class="mem-core-actions"><button class="btn primary" id="memStartSession" type="button">ابدأ جلسة اليوم</button><span class="pill" id="memTodayKey">—</span></div></div>
        <div class="mem-today-grid"><article class="mem-today-card new"><small>حفظ اليوم</small><strong id="memNewToday">—</strong><span id="memTomorrowNew">—</span></article><article class="mem-today-card"><small>التثبيت</small><strong id="memStabilizeToday">—</strong><span>7 جلسات ناجحة لكل مقطع</span></article><article class="mem-today-card review"><small>المراجعة</small><strong id="memReviewToday">—</strong><span id="memReviewTomorrow">—</span></article><article class="mem-today-card alert"><small>المتأخر</small><strong id="memBacklog">—</strong><span>يُقسم تلقائيًا حتى لا يتراكم عليك الحمل</span></article></div>
        <section class="mem-panel mem-plan-main"><div class="mem-panel-head"><div><h3>خطتك الحالية</h3><p>عدّل الأساسيات فقط؛ التفاصيل الذكية يتولاها المحرك.</p></div><button class="btn" id="coreSavePlan" type="button">حفظ الخطة</button></div><div class="mem-form-grid"><label>آيات جديدة يوميًا<input id="coreNewPerDay" type="number" min="1" value="10"/></label><label>بداية الحفظ الجديد<select id="coreStartSurah"></select></label><label>آية البداية<input id="coreStartAyah" type="number" min="1" value="1"/></label></div><div class="mem-note">الأفضل أن تبدأ بالقيمة التي تقدر تلتزم بها يوميًا. المراجعات يُوزّعها المحرك تلقائيًا حسب النظام الذي تختاره.</div><details class="mem-advanced"><summary>خيارات متقدمة</summary><div class="mem-form-grid three"><label>حد المراجعة اليومية<input id="coreReviewPerDay" type="number" min="1" value="30"/></label><label>مدة الجلسة<input id="coreSessionMinutes" type="number" min="5" value="25"/></label><label>نظام المراجعة<select id="coreReviewMode"><option value="spaced">تكرار متباعد ذكي · FSRS-like</option><option value="weekly">مراجعة أسبوعية · كل 7 أيام</option></select></label><label>يوم المراجعة الأسبوعية<select id="coreWeeklyReviewDay"><option value="0">الأحد</option><option value="1">الاثنين</option><option value="2">الثلاثاء</option><option value="3">الأربعاء</option><option value="4">الخميس</option><option value="5">الجمعة</option><option value="6">السبت</option></select></label></div><p class="mem-advanced-note">في التكرار المتباعد لا يوجد فاصل ثابت: موعدك القادم يتحدد من أداءك واستقرار المقطع وصعوبة استرجاعه.</p></details></section>
        <section class="mem-grid-2"><section class="mem-panel"><div class="mem-panel-head"><div><h3>حفظت اليوم</h3><p>لو حفظت جزءًا مختلفًا عن المقترح، حدده مرة واحدة وسجله.</p></div></div><div class="mem-form-grid"><label>من سورة<select id="memNewStartSurah"></select></label><label>من آية<input id="memNewStartAyah" type="number" min="1" value="1"/></label><label>إلى سورة<select id="memNewEndSurah"></select></label><label>إلى آية<input id="memNewEndAyah" type="number" min="1" value="1"/></label></div><div class="mem-quick-actions"><button class="btn" id="memNewWholeSurah" type="button">سورة كاملة</button><button class="btn primary" id="memRecordNew" type="button">سجل أنني حفظت</button></div></section><section class="mem-panel"><div class="mem-panel-head"><div><h3>إضافة محفوظ سابق</h3><p>أسرع طريقة: اختر السورة واضغط «سورة كاملة». أو حدد مقطعًا من المصحف.</p></div></div><div class="mem-form-grid"><label>من سورة<select id="memPriorStartSurah"></select></label><label>من آية<input id="memPriorStartAyah" type="number" min="1" value="1"/></label><label>إلى سورة<select id="memPriorEndSurah"></select></label><label>إلى آية<input id="memPriorEndAyah" type="number" min="1" value="1"/></label></div><div class="mem-quick-actions"><button class="btn" id="memWholeSurah" type="button">سورة كاملة</button><button class="btn primary" id="memAddPrior" type="button">إضافة للمحفوظ السابق</button></div></section></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>لمحة رحلتك</h3><p>المحفوظ السابق، مجموعات الحفظ، المراجعات المستحقة، ونقاط الضعف.</p></div></div><div class="mem-stat-row"><div><small>المحفوظ السابق</small><b id="memPriorCount">0 آية</b></div><div><small>مجموعات الحفظ</small><b id="memActiveGroups">0 مجموعة</b></div><div><small>مجموعات مستحقة</small><b id="memReviewGroups">0 مجموعة</b></div><div><small>نقاط تحتاج دعمًا</small><b id="memWeakCount">0 مجموعة</b></div></div></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>جلسة اليوم</h3><p id="memSessionCount">—</p></div><span class="badge" id="memSessionTime">25 دقيقة</span></div><div class="mem-session-summary"><div><span>غدًا حفظ</span><b id="memTomorrowNewSummary">—</b></div><div><span>غدًا مراجعة</span><b id="memTomorrowReview">—</b></div><div><span>موعد انتقال أول مقطع</span><b id="memNextRelease">—</b></div></div></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>الأسبوع القادم</h3><p>تشوف الحفظ والتثبيت والمراجعة يومًا بيوم.</p></div></div><div class="mem-week-grid" id="memWeekGrid"></div></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>ما سيحدث لاحقًا</h3><p>موعد انتقال كل مقطع من التثبيت إلى المراجعة التالية.</p></div></div><div class="mem-upcoming-list" id="memUpcomingList"></div></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>تثبيت إضافي ونقاط الضعف</h3><p>المقاطع التي تكرر فيها الصعوبة تعود هنا لتثبيت إضافي بدل «مراجعة شاملة» مبهمة.</p></div></div><div class="mem-range-list" id="memWeakList"></div></section>`;
      $('#memCoreHost')?.appendChild(root);
    }
  }

  function updateAyahMaxes(){
    clampAyahInput('#memPriorStartAyah',Number($('#memPriorStartSurah')?.value||1));
    clampAyahInput('#memPriorEndAyah',Number($('#memPriorEndSurah')?.value||1));
    clampAyahInput('#coreStartAyah',Number($('#coreStartSurah')?.value||1));
  }

  function bind(){
    if(bound)return;bound=true;
    $('#memStartSession')?.addEventListener('click',startSession);
    $('#memAddPrior')?.addEventListener('click',addPriorFromForm);
    $('#memWholeSurah')?.addEventListener('click',quickWholeSurah);
    $('#memRecordNew')?.addEventListener('click',addNewFromForm);
    $('#memNewWholeSurah')?.addEventListener('click',()=>{const s=Number($('#memNewStartSurah')?.value||1);const c=verseCount(s);$('#memNewStartAyah').value='1';$('#memNewEndSurah').value=String(s);$('#memNewEndAyah').value=String(c);});
    $('#coreSavePlan')?.addEventListener('click',savePlan);
    ['#memPriorStartSurah','#memPriorEndSurah','#memNewStartSurah','#memNewEndSurah','#coreStartSurah'].forEach(sel=>$(sel)?.addEventListener('change',updateAyahMaxes));
    document.addEventListener('rafiq-memorization-change',()=>{render();renderHomeCore();});
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){data=load();render();renderHomeCore();}});
  }

  function onReady(){
    loadQuran().then(()=>{migrateLegacyOnce();injectUI();bind();render();renderHomeCore();});
  }
  window.RAFIQ_MEM={
    getData:()=>clone(data),
    plan:()=>planForDay(),
    startSession,
    addPrior:(s,a,es,ea)=>{const i=addPrior(normPoint(s,a),normPoint(es||s,ea||a),'api');save();render();return clone(i);},
    markNew:(s,a,es,ea)=>recordNewAsMemorized({start:normPoint(s,a),end:normPoint(es||s,ea||a)},today()),
    grade:(id,g)=>gradeItem(id,g,today(),'api'),
    reset:()=>{data=clone(DEFAULT);save();render();renderHomeCore();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
  document.addEventListener('rafiq-quran-ready',onReady,{once:false});
})();
