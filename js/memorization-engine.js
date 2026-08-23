/* Rafiq Quran — Memorization Core
 * Single owner for memorization planning, 7-day stabilization,
 * spaced review, prior-memorization import, daily/weekly sessions.
 * This module intentionally keeps its data separate from the legacy visual
 * constellation so the core schedule is deterministic and testable.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'rafiq-memorization-core-v1';
  const SCHEMA_VERSION = 1;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v) => { const d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML; };
  const toast = (m) => window.rafiqToast?.(m);

  const DEFAULT = {
    version: SCHEMA_VERSION,
    settings: {
      newPerDay: 10,
      reviewPerDay: 30,
      sessionMinutes: 25,
      weeklyReviewDay: 5,
      startSurah: 1,
      startAyah: 1,
      newEnabled: true,
      autoCreateDaily: true
    },
    items: [],
    priorRanges: [],
    history: [],
    sessions: [],
    importedLegacy: false
  };

  let data = load();
  let quran = [];
  let todayKey = null;

  function cloneDefault(){ return JSON.parse(JSON.stringify(DEFAULT)); }
  function load(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if(raw && typeof raw === 'object') return mergeData(raw);
    } catch {}
    return cloneDefault();
  }
  function mergeData(raw){
    const base=cloneDefault();
    return {
      ...base,
      ...raw,
      settings:{...base.settings,...(raw.settings||{})},
      items:Array.isArray(raw.items)?raw.items:[],
      priorRanges:Array.isArray(raw.priorRanges)?raw.priorRanges:[],
      history:Array.isArray(raw.history)?raw.history:[],
      sessions:Array.isArray(raw.sessions)?raw.sessions:[]
    };
  }
  function save(){
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); }catch{}
    window.dispatchEvent(new CustomEvent('rafiq-memorization-change'));
  }

  async function loadQuran(){
    if(Array.isArray(window.RAFIQ_QURAN)&&window.RAFIQ_QURAN.length===114){ quran=window.RAFIQ_QURAN; return quran; }
    try{
      const r=await fetch('./quran-uthmani.json',{cache:'force-cache'});
      if(r.ok){quran=await r.json();return quran;}
    }catch{}
    return quran;
  }

  function runtimeDayKey(){
    try{
      if(typeof window.RAFIQ_GET_RITUAL_KEY==='function') return window.RAFIQ_GET_RITUAL_KEY();
    }catch{}
    const d=new Date();
    return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function keyDate(key){
    const m=/rafiq-(\d{4})-(\d{2})-(\d{2})/.exec(String(key||''));
    return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date();
  }
  function addDays(key,n){const d=keyDate(key);d.setDate(d.getDate()+n);return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function diffDays(a,b){return Math.round((keyDate(b)-keyDate(a))/86400000);}
  function today(){return todayKey||runtimeDayKey();}

  function getSurah(n){ return quran.find(s=>Number(s.s)===Number(n)) || quran[Number(n)-1] || null; }
  function verseCount(s){ const x=getSurah(s); return Number(x?.count||x?.verses?.length||0); }
  function normPoint(s,a){
    s=Math.max(1,Math.min(114,Number(s)||1));
    const c=verseCount(s)||1; a=Math.max(1,Math.min(c,Number(a)||1));
    return {s,a};
  }
  function cmpPoint(a,b){ return a.s===b.s ? a.a-b.a : a.s-b.s; }
  function nextPoint(p){ const c=verseCount(p.s); if(p.a<c)return {s:p.s,a:p.a+1}; if(p.s<114)return {s:p.s+1,a:1}; return null; }
  function pointsBetween(start,end,limit=100000){
    start=normPoint(start.s,start.a);end=normPoint(end.s,end.a);if(cmpPoint(start,end)>0)[start,end]=[end,start];
    const out=[];let p=start;let guard=0;
    while(p&&cmpPoint(p,end)<=0&&guard<limit){out.push({...p});if(cmpPoint(p,end)===0)break;p=nextPoint(p);guard++;}
    return out;
  }
  function rangeLabel(r){
    const a=normPoint(r.start.s,r.start.a),b=normPoint(r.end.s,r.end.a),sa=getSurah(a.s),sb=getSurah(b.s);
    if(!sa||!sb)return 'نطاق غير محدد';
    return a.s===b.s?`${sa.name} · آية ${a.a}–${b.a}`:`${sa.name} ${a.a} → ${sb.name} ${b.a}`;
  }
  function idForRange(start,end,kind='new'){return `${kind}-${start.s}:${start.a}-${end.s}:${end.a}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}

  function collectLegacyKeys(){
    try{
      const raw=JSON.parse(localStorage.getItem('rafiq-state-v85')||'null');
      return Array.isArray(raw?.memorizedAyahs)?raw.memorizedAyahs:[];
    }catch{return[]}
  }
  function importLegacyIfNeeded(){
    if(data.importedLegacy)return;
    const keys=collectLegacyKeys();
    if(!keys.length){data.importedLegacy=true;save();return;}
    const pts=keys.map(k=>{const m=/^(\d+):(\d+)$/.exec(String(k));return m?{s:Number(m[1]),a:Number(m[2])}:null}).filter(Boolean).sort(cmpPoint);
    let i=0;
    while(i<pts.length){
      let start=pts[i],end=pts[i];
      while(i+1<pts.length){const n=nextPoint(end);if(!n||n.s!==pts[i+1].s||n.a!==pts[i+1].a)break;i++;end=pts[i];}
      data.priorRanges.push({id:idForRange(start,end,'prior'),start,end,addedKey:today(),source:'legacy-memorized-ayahs'});
      i++;
    }
    data.importedLegacy=true;save();
  }

  function itemStatus(item,key=today()){
    if(item.snoozedUntil && diffDays(key,item.snoozedUntil)>0) return {phase:item.phase,day:1,daysLeft:diffDays(key,item.snoozedUntil),due:false,label:'مؤجل حتى '+keyShort(item.snoozedUntil)};
    if(item.snoozedUntil && diffDays(key,item.snoozedUntil)<=0) item.snoozedUntil=null;
    if(item.phase==='stabilizing'){
      const day=Math.max(1,Math.min(7,diffDays(item.createdKey,key)+1));
      return {phase:'stabilizing',day,daysLeft:Math.max(0,7-day),due:!item.history.some(h=>h.key===key),label:`تثبيت · اليوم ${day} من 7`};
    }
    const due=item.dueKey?diffDays(key,item.dueKey)<=0:true;
    return {phase:'review',day:7,daysLeft:Math.max(0,diffDays(key,item.dueKey||key)),due,label:`مراجعة متباعدة · كل ${item.interval||7} أيام`};
  }

  function snoozeItem(item,key=today(),days=1){
    item.snoozedUntil=addDays(key,Math.max(1,Number(days)||1));
    data.history.unshift({kind:'snooze',itemId:item.id,key,until:item.snoozedUntil,at:Date.now()});
    save();render();renderHomeCore();toast('تم تأجيل هذه المراجعة يومًا واحدًا.');
  }

  function gradeItem(item,grade,key=today()){
    const status=itemStatus(item,key);
    item.history=item.history||[];
    if(item.history.some(h=>h.key===key))return;
    item.history.push({key,grade});
    if(status.phase==='stabilizing'){
      const day=Math.max(1,Math.min(7,diffDays(item.createdKey,key)+1));
      item.stabilizedDays=Math.max(Number(item.stabilizedDays||0),day);
      if(day>=7){
        item.phase='review'; item.interval=7; item.dueKey=addDays(key,7);
      }
    }else{
      let interval=Number(item.interval||7);
      if(grade==='easy') interval=Math.min(180,Math.max(7,Math.round(interval*1.75)));
      else if(grade==='good') interval=Math.min(120,interval+7);
      else if(grade==='hard') interval=Math.max(2,Math.round(interval/2));
      else { interval=2; item.phase='stabilizing'; item.createdKey=key; item.stabilizedDays=0; }
      item.interval=interval;
      item.dueKey=addDays(key,interval);
    }
    data.history.unshift({kind:'grade',itemId:item.id,key,grade,at:Date.now()});
    data.history=data.history.slice(0,2000);
    save();render();renderHomeCore();
  }

  function allDueItems(key=today()){
    return data.items.filter(i=>itemStatus(i,key).due);
  }
  function stabilizationItems(key=today()){
    return data.items.filter(i=>i.phase==='stabilizing'&&i.createdKey!==key&&itemStatus(i,key).due&&!i.snoozedUntil);
  }
  function reviewItems(key=today()){
    return data.items.filter(i=>i.phase==='review'&&itemStatus(i,key).due);
  }
  function priorVerseCount(){return data.priorRanges.reduce((n,r)=>n+pointsBetween(r.start,r.end,20000).length,0)}
  function totalScheduledNew(){return data.items.filter(i=>i.origin==='new').reduce((n,i)=>n+pointsBetween(i.start,i.end,20000).length,0)}

  function findExisting(point){
    return data.items.some(i=>pointsBetween(i.start,i.end,20000).some(p=>p.s===point.s&&p.a===point.a)) || data.priorRanges.some(r=>pointsBetween(r.start,r.end,20000).some(p=>p.s===point.s&&p.a===point.a));
  }
  function cursor(){
    let p=normPoint(data.settings.startSurah,data.settings.startAyah);
    if(!data.settings.autoCreateDaily)return p;
    const all=[...data.items,...data.priorRanges];
    if(all.length){
      let max=normPoint(1,1);
      for(const r of all){if(cmpPoint(r.end,max)>0)max=normPoint(r.end.s,r.end.a);}
      const n=nextPoint(max);if(n)p=n;
    }
    return p;
  }
  function makeDailyNewItem(key=today()){
    if(!data.settings.newEnabled||!data.settings.autoCreateDaily)return null;
    if(data.items.some(i=>i.origin==='new'&&i.createdKey===key))return data.items.find(i=>i.origin==='new'&&i.createdKey===key);
    let start=cursor();
    if(!start||start.s>114)return null;
    while(start&&findExisting(start))start=nextPoint(start);
    if(!start)return null;
    const n=Math.max(1,Number(data.settings.newPerDay)||10);
    const pts=[];let p=start;while(p&&pts.length<n){if(!findExisting(p))pts.push(p);p=nextPoint(p);}
    if(!pts.length)return null;
    const end=pts[pts.length-1];
    const item={id:idForRange(start,end,'new'),origin:'new',start,end,createdKey:key,phase:'stabilizing',stabilizedDays:0,history:[],interval:7,dueKey:addDays(key,1)};
    data.items.push(item);save();return item;
  }

  function taskPlan(key=today()){
    const settings=data.settings||DEFAULT.settings;
    const newItem=makeDailyNewItem(key);
    const due=[...allDueItems(key)];
    const isWeekly=keyDate(key).getDay()===Number(settings.weeklyReviewDay);
    const reviewAll=reviewItems(key).sort((a,b)=>String(a.dueKey).localeCompare(String(b.dueKey)));
    const review=isWeekly?reviewAll:reviewAll.slice(0,Math.max(1,Number(settings.reviewPerDay)||30));
    const stabilization=stabilizationItems(key);
    const backlog=Math.max(0,reviewAll.length-review.length);
    return {
      key,newItem,review,stabilization,backlog,
      newRange:newItem?rangeLabel(newItem):null,
      reviewCount:review.reduce((n,i)=>n+pointsBetween(i.start,i.end,20000).length,0),
      stabilizationCount:stabilization.reduce((n,i)=>n+pointsBetween(i.start,i.end,20000).length,0)
    };
  }

  function forecastNewRanges(days=7,key=today()){
    let p=cursor();
    const out=[];
    // If today already has a scheduled range, start forecasting after it.
    const existingToday=data.items.find(i=>i.origin==='new'&&i.createdKey===key);
    if(existingToday){const n=nextPoint(existingToday.end);if(n)p=n;}
    for(let i=0;i<days;i++){
      const k=addDays(key,i);
      const already=data.items.find(x=>x.origin==='new'&&x.createdKey===k);
      if(already){out.push(already);const n=nextPoint(already.end);if(n)p=n;continue;}
      while(p&&findExisting(p))p=nextPoint(p);
      if(!p){out.push(null);continue;}
      const pts=[];let cur=p;const n=Math.max(1,Number(data.settings.newPerDay)||10);
      while(cur&&pts.length<n){if(!findExisting(cur))pts.push(cur);cur=nextPoint(cur);}
      if(!pts.length){out.push(null);continue;}
      const virtual={origin:'forecast',start:pts[0],end:pts[pts.length-1],createdKey:k,phase:'stabilizing'};out.push(virtual);p=cur;
    }
    return out;
  }

  function upcoming(days=7,key=today()){
    const forecasts=forecastNewRanges(days,key);
    const out=[];
    for(let i=0;i<days;i++){const k=addDays(key,i),p=taskPlanPreview(k);p.newItem=forecasts[i]||null;out.push(p)}
    return out;
  }
  function taskPlanPreview(key){
    const dayNew=data.items.find(i=>i.origin==='new'&&i.createdKey===key);
    const stabilization=data.items.filter(i=>i.phase==='stabilizing'&&i.createdKey&&diffDays(i.createdKey,key)>=0&&diffDays(i.createdKey,key)<7);
    const review=data.items.filter(i=>i.phase==='review'&&i.dueKey&&diffDays(key,i.dueKey)<=0);
    return {key,newItem:dayNew,stabilization,review,overdue:review.filter(i=>i.dueKey&&diffDays(key,i.dueKey)>0)};
  }

  function sessionTasks(){
    const p=taskPlan();
    const out=[];
    if(p.newItem)out.push({kind:'new',title:'الحفظ الجديد',item:p.newItem});
    for(const i of p.stabilization)out.push({kind:'stabilization',title:'التثبيت القريب',item:i});
    for(const i of p.review)out.push({kind:'review',title:'المراجعة المتباعدة',item:i});
    return out;
  }

  function openRecitationChallenge(item){
    const body=$('#modalBody');if(!body)return;
    const verses=pointsBetween(item.start,item.end,80).map(p=>{const v=getSurah(p.s)?.verses?.find(x=>Number(x.a)===p.a);return v?.text||''}).filter(Boolean);
    body.innerHTML=`<div class="mem-recite"><div class="mem-session-intro"><b>التسميع الذاتي</b><small>اقرأ المقطع غيبًا أولًا، ثم اكشف النص للمطابقة.</small></div><div class="mem-recite-text" id="memReciteText" hidden>${verses.map(v=>`<p>${esc(v)}</p>`).join('')}</div><div class="mem-recite-actions"><button class="btn primary" id="memRevealRecite" type="button">إظهار النص</button><button class="btn" data-recite-grade="relearn" type="button">أعد التثبيت</button><button class="btn" data-recite-grade="hard" type="button">أخطأت</button><button class="btn" data-recite-grade="good" type="button">جيد</button><button class="btn" data-recite-grade="easy" type="button">أتقنت</button></div></div>`;
    $('#memRevealRecite')?.addEventListener('click',()=>{$('#memReciteText')?.removeAttribute('hidden');$('#memRevealRecite')?.setAttribute('disabled','true')});
    $$('[data-recite-grade]').forEach(b=>b.onclick=()=>{gradeItem(item,b.dataset.reciteGrade,today());toast('تم تسجيل نتيجة التسميع.');document.querySelector('#closeModal')?.click()});
  }

  function startSession(){
    const tasks=sessionTasks();
    const body=$('#modalBody'),modal=$('#modal'),title=$('#modalTitle');
    if(!body||!modal)return;
    if(!tasks.length){toast('ممتاز — لا توجد مهام مستحقة الآن.');return;}
    title.textContent='جلسة الحفظ والمراجعة';
    body.innerHTML=`<div class="mem-session"><div class="mem-session-intro"><b>${tasks.length} محطة في جلسة اليوم</b><small>ابدأ بالحفظ الجديد، ثم التثبيت، ثم المراجعة المتباعدة.</small></div><div class="mem-session-list">${tasks.map((t,i)=>`<article class="mem-session-task" data-session-item="${esc(t.item.id)}"><div class="mem-task-no">${i+1}</div><div class="mem-task-copy"><strong>${esc(t.title)}</strong><span>${esc(rangeLabel(t.item))}</span><small>${t.kind==='new'?'حفظ جديد':t.kind==='stabilization'?'تثبيت اليوم':'مراجعة مستحقة'}</small></div><div class="mem-task-actions"><button class="btn" data-session-recite="${esc(t.item.id)}">تسميع</button><button class="btn" data-session-study="${esc(t.item.id)}">دراسة الآية</button><button class="btn" data-session-play="${esc(t.item.id)}">استماع</button><button class="btn" data-session-snooze="${esc(t.item.id)}">تأجيل</button><button class="btn" data-session-grade="hard" data-item="${esc(t.item.id)}">صعب</button><button class="btn primary" data-session-grade="good" data-item="${esc(t.item.id)}">جيد</button><button class="btn" data-session-grade="easy" data-item="${esc(t.item.id)}">سهل</button></div></article>`).join('')}</div><div class="mem-session-foot"><span>بعد كل تقييم يُعاد حساب موعد المراجعة تلقائيًا.</span></div></div>`;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    $$('[data-session-grade]').forEach(b=>b.onclick=()=>{const item=data.items.find(i=>i.id===b.dataset.item);if(item)gradeItem(item,b.dataset.sessionGrade,today());const row=b.closest('[data-session-item]');if(row){row.classList.add('done');row.querySelectorAll('button').forEach(x=>x.disabled=true)}});
    $$('[data-session-snooze]').forEach(b=>b.onclick=()=>{const item=data.items.find(i=>i.id===b.dataset.sessionSnooze);if(item)snoozeItem(item,today(),1);const row=b.closest('[data-session-item]');row?.classList.add('done')});
    $$('[data-session-study]').forEach(b=>b.onclick=()=>{const item=data.items.find(i=>i.id===b.dataset.sessionStudy);if(!item)return;const ay=item.start.a||1;window.openAyahStudy?.(item.start.s,ay,'summary')});
    $$('[data-session-play]').forEach(b=>b.onclick=()=>{const item=data.items.find(i=>i.id===b.dataset.sessionPlay);if(item)window.RAFIQ_PLAY_AYAH?.(item.start.s,item.start.a||1)});
    $$('[data-session-recite]').forEach(b=>b.onclick=()=>{const item=data.items.find(i=>i.id===b.dataset.sessionRecite);if(!item)return;openRecitationChallenge(item)});
  }

  function addPriorRange(){
    const ss=Number($('#memPriorStartSurah')?.value||1), sa=Number($('#memPriorStartAyah')?.value||1), es=Number($('#memPriorEndSurah')?.value||ss), ea=Number($('#memPriorEndAyah')?.value||sa);
    const start=normPoint(ss,sa),end=normPoint(es,ea);if(cmpPoint(start,end)>0)return toast('نطاق المحفوظ غير صحيح.');
    const pts=pointsBetween(start,end,20000);if(!pts.length)return toast('لم نتمكن من إنشاء النطاق.');
    data.priorRanges.push({id:idForRange(start,end,'prior'),start,end,addedKey:today(),source:'manual'});
    save();render();renderHomeCore();toast(`أُضيف المحفوظ السابق · ${rangeLabel({start,end})}`);
  }
  function deletePrior(id){data.priorRanges=data.priorRanges.filter(x=>x.id!==id);save();render();renderHomeCore();}

  function saveCorePlan(){
    const n=Math.max(1,Number($('#coreNewPerDay')?.value||10));
    const r=Math.max(1,Number($('#coreReviewPerDay')?.value||30));
    const mins=Math.max(5,Number($('#coreSessionMinutes')?.value||25));
    const day=Math.max(0,Math.min(6,Number($('#coreWeeklyReviewDay')?.value||5)));
    const ss=Math.max(1,Math.min(114,Number($('#coreStartSurah')?.value||1))),sa=Math.max(1,Number($('#coreStartAyah')?.value||1));
    data.settings={...data.settings,newPerDay:n,reviewPerDay:r,sessionMinutes:mins,weeklyReviewDay:day,startSurah:ss,startAyah:sa,autoCreateDaily:true,newEnabled:true};
    save();render();renderHomeCore();toast('تم حفظ خطة الحفظ والمراجعة.');
  }

  function renderPlanControls(){
    const s=data.settings;
    const set=(id,v)=>{const e=$('#'+id);if(e&&document.activeElement!==e)e.value=String(v)};
    set('coreNewPerDay',s.newPerDay);set('coreReviewPerDay',s.reviewPerDay);set('coreSessionMinutes',s.sessionMinutes);set('coreWeeklyReviewDay',s.weeklyReviewDay);set('coreStartSurah',s.startSurah);set('coreStartAyah',s.startAyah);
  }
  function populateCoreSurahs(){
    for(const id of ['coreStartSurah','memPriorStartSurah','memPriorEndSurah']){
      const e=$('#'+id);if(!e)continue;if(e.options.length===0)e.innerHTML=quran.map((s,i)=>`<option value="${i+1}">${i+1} · ${esc(s.name)}</option>`).join('');
    }
    renderPlanControls(); updateAyahMaxes();
  }
  function updateAyahMaxes(){
    const map=[['coreStartSurah','coreStartAyah'],['memPriorStartSurah','memPriorStartAyah'],['memPriorEndSurah','memPriorEndAyah']];
    for(const [sid,aid] of map){const s=Number($('#'+sid)?.value||1),e=$('#'+aid),max=verseCount(s)||1;if(!e)continue;e.max=String(max);if(Number(e.value||1)>max)e.value=String(max);}
  }

  function weekDayName(i){return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][i]||'';}
  function weeklyReviewLabel(){return weekDayName(Number(data.settings.weeklyReviewDay)||5)}

  function render(){
    const key=todayKey=runtimeDayKey();
    taskPlan(key);
    renderPlanControls();populateCoreSurahs();
    renderDashboard();renderPrior();renderWeek();renderUpcoming();renderWeak();renderGalaxyBridge();
  }
  function renderDashboard(){
    const p=taskPlan();
    const set=(id,v)=>{const e=$('#'+id);if(e)e.textContent=v};
    set('memTodayKey',keyShort(p.key));
    set('memNewToday',p.newItem?rangeLabel(p.newItem):'لا يوجد حفظ جديد مجدول');
    set('memStabilizeToday',p.stabilizationCount?`${p.stabilizationCount} آية مستحقة للتثبيت`:'لا يوجد تثبيت مستحق');
    set('memReviewToday',p.reviewCount?`${p.reviewCount} آية للمراجعة`:'لا توجد مراجعة مستحقة');
    set('memBacklog',p.backlog?`${p.backlog} مجموعة متأخرة`:'لا يوجد تراكم');
    const tasks=sessionTasks();set('memSessionCount',`${tasks.length} محطات`);set('memSessionTime',`${data.settings.sessionMinutes} دقيقة تقريبًا`);
    const due=[...allDueItems()];const verses=due.reduce((n,i)=>n+pointsBetween(i.start,i.end,20000).length,0);set('memDueTotal',`${verses} آية مستحقة اليوم`);
    const nextNew=upcoming(2)[1]?.newItem;set('memTomorrowNew',nextNew?rangeLabel(nextNew):'بحسب الخطة');
    set('memTomorrowReview',`${taskPlanPreview(addDays(today(),1)).review.reduce((n,i)=>n+pointsBetween(i.start,i.end,20000).length,0)} آية`);
    set('memWeekBadge',`المراجعة الشاملة · ${weeklyReviewLabel()}`);
    const first=data.items.find(i=>i.phase==='stabilizing');
    set('memNextRelease',first?`${Math.max(0,7-(Number(first.stabilizedDays||0)))} يوم متبقٍ`:'لا يوجد حفظ تحت التثبيت');
    const weak=data.items.filter(i=>Array.isArray(i.history)&&i.history.filter(h=>h.grade==='hard'||h.grade==='relearn').length>=2);
    const stats={prior:priorVerseCount(),active:data.items.length,review:data.items.filter(i=>i.phase==='review').length,newTotal:totalScheduledNew(),weak:weak.length};
    set('memPriorCount',`${stats.prior.toLocaleString('ar-EG')} آية`);set('memActiveGroups',`${stats.active} مجموعة`);set('memReviewGroups',`${stats.review} مجموعة`);set('memNewTotal',`${stats.newTotal.toLocaleString('ar-EG')} آية`);set('memWeakCount',`${stats.weak} مجموعة تحتاج دعمًا`);
  }
  function keyShort(k){const d=keyDate(k);return new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(d)}

  function renderPrior(){
    const box=$('#memPriorList');if(!box)return;
    const rows=data.priorRanges.map(r=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(r))}</strong><small>محفوظ سابق · أُضيف ${esc(keyShort(r.addedKey))}</small></div><button class="btn danger-muted" type="button" data-prior-delete="${esc(r.id)}">حذف</button></article>`);
    box.innerHTML=rows.join('')||'<div class="mem-empty">لم تضف محفوظك السابق بعد. أضف نطاقًا واحدًا أو أكثر ليُبنى عليه جدول المراجعة.</div>';
    $$('[data-prior-delete]').forEach(b=>b.onclick=()=>deletePrior(b.dataset.priorDelete));
  }
  function renderWeek(){
    const box=$('#memWeekGrid');if(!box)return;const days=upcoming(7);box.innerHTML=days.map((d,i)=>{
      const prev=d.review.reduce((n,x)=>n+pointsBetween(x.start,x.end,20000).length,0),stab=d.stabilization.reduce((n,x)=>n+pointsBetween(x.start,x.end,20000).length,0);
      return `<article class="mem-week-card ${i===0?'today':''}"><header><b>${esc(keyShort(d.key))}</b><span>${i===0?'اليوم':i===1?'غدًا':''}</span></header><div class="mem-week-item"><small>الحفظ الجديد</small><strong>${d.newItem?esc(rangeLabel(d.newItem)):'—'}</strong></div><div class="mem-week-item"><small>التثبيت</small><strong>${stab?`${stab} آية`:'—'}</strong></div><div class="mem-week-item"><small>المراجعة</small><strong>${prev?`${prev} آية`:'—'}</strong></div></article>`;
    }).join('')+`<article class="mem-week-report"><b>حصيلة الأسبوع</b><span>أنجزت ${data.history.filter(h=>h.key&&diffDays(h.key, today())>=-6&&h.key<=today()).length} تقييمات خلال الأيام السبعة الأخيرة.</span><span>المراجعة الشاملة القادمة: ${esc(weeklyReviewLabel())}.</span></article>`;
  }
  function renderUpcoming(){
    const box=$('#memUpcomingList');if(!box)return;
    const out=[];for(let i=1;i<=7;i++){const k=addDays(today(),i),p=taskPlanPreview(k);out.push(`<article><b>${i===1?'غدًا':keyShort(k)}</b><span>حفظ: ${p.newItem?esc(rangeLabel(p.newItem)):'—'}</span><span>مراجعة: ${p.review.length?`${p.review.reduce((n,x)=>n+pointsBetween(x.start,x.end,20000).length,0)} آية`:'—'}</span></article>`)}
    box.innerHTML=out.join('');
  }
  function renderWeak(){
    const box=$('#memWeakList');if(!box)return;
    const weak=data.items.filter(i=>Array.isArray(i.history)&&i.history.filter(h=>h.grade==='hard'||h.grade==='relearn').length>=2).sort((a,b)=>String(a.dueKey||'').localeCompare(String(b.dueKey||'')));
    box.innerHTML=weak.map(i=>{const hard=i.history.filter(h=>h.grade==='hard'||h.grade==='relearn').length;return `<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${hard} نتيجة صعبة · الموعد التالي ${esc(keyShort(i.dueKey||today()))}</small></div><button class="btn" type="button" data-weak-study="${esc(i.id)}">دراسة</button></article>`}).join('')||'<div class="mem-empty">لا توجد نقاط ضعف متكررة حاليًا. ممتاز.</div>';
    $$('[data-weak-study]').forEach(b=>b.onclick=()=>{const i=data.items.find(x=>x.id===b.dataset.weakStudy);if(i)window.openAyahStudy?.(i.start.s,i.start.a,'summary')});
  }

  function renderGalaxyBridge(){
    const el=$('#hifzProgress');if(el)el.textContent=`${data.priorRanges.length+data.items.length} مجموعات · ${priorVerseCount()+totalScheduledNew()} آية`;
    const meter=$('#galaxyMeter');if(meter)meter.textContent=`${data.items.filter(i=>i.phase==='review').length} مراجعة`;
  }

  function injectUI(){
    const view=$('#view-galaxy');
    if(view && !$('#memCoreRoot')){
      const shell=view.querySelector('.galaxy-shell');
      const root=document.createElement('div');root.id='memCoreRoot';root.className='mem-core-root';
      root.innerHTML=`
        <div class="mem-core-head"><div><span class="mem-kicker">Core · الحفظ والمراجعة</span><h2>رحلة حفظك من اليوم إلى الإتقان</h2><p>محرك واحد يدير الحفظ الجديد، تثبيت 7 أيام، المراجعة المتباعدة، والمحفوظ السابق.</p></div><div class="mem-core-actions"><button class="btn primary" id="memStartSession" type="button">▶ ابدأ جلسة اليوم</button><span class="pill" id="memTodayKey">اليوم</span></div></div>
        <div class="mem-today-grid">
          <article class="mem-today-card new"><small>حفظ اليوم</small><strong id="memNewToday">—</strong><span id="memTomorrowNew">—</span></article>
          <article class="mem-today-card"><small>التثبيت اليوم</small><strong id="memStabilizeToday">—</strong><span>جزء من دورة الـ7 أيام</span></article>
          <article class="mem-today-card review"><small>المراجعة اليوم</small><strong id="memReviewToday">—</strong><span id="memReviewTomorrow">—</span></article>
          <article class="mem-today-card alert"><small>التراكم</small><strong id="memBacklog">—</strong><span>نمنع تراكم المراجعات قدر الإمكان</span></article>
        </div>
        <div class="mem-stat-row"><div><small>مجموع المحفوظ السابق</small><b id="memPriorCount">0 آية</b></div><div><small>مجموعات الحفظ</small><b id="memActiveGroups">0 مجموعة</b></div><div><small>مجموعات المراجعة</small><b id="memReviewGroups">0 مجموعة</b></div><div><small>حفظ مخطط</small><b id="memNewTotal">0 آية</b></div></div>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>جلسة اليوم</h3><p id="memSessionCount">0 محطات</p></div><span class="badge" id="memSessionTime">25 دقيقة تقريبًا</span></div><div class="mem-session-summary"><div><span>المستحق</span><b id="memDueTotal">0 آية</b></div><div><span>الغد</span><b id="memTomorrowReview">0 آية</b></div><div><span>انتقال الجديد إلى السابق</span><b id="memNextRelease">—</b></div></div></section>
        <section class="mem-grid-2"><section class="mem-panel"><div class="mem-panel-head"><div><h3>المحفوظ السابق</h3><p>أضف ما حفظته قبل استخدام رفيق، وسيُعامل كمحفوظ جاهز للمراجعة.</p></div></div><div class="mem-form-grid"><select id="memPriorStartSurah" aria-label="بداية المحفوظ السابق"></select><input id="memPriorStartAyah" type="number" min="1" value="1" aria-label="آية البداية"/><select id="memPriorEndSurah" aria-label="نهاية المحفوظ السابق"></select><input id="memPriorEndAyah" type="number" min="1" value="1" aria-label="آية النهاية"/></div><button class="btn primary" id="memAddPrior" type="button">＋ إضافة المحفوظ</button><div class="mem-range-list" id="memPriorList"></div></section><section class="mem-panel"><div class="mem-panel-head"><div><h3>الخطة الأساسية</h3><p>هذه الخطة هي التي تولّد الحفظ الجديد وتضبط حجم المراجعة اليومية.</p></div></div><div class="mem-form-grid three"><label>آيات جديدة/يوم<input id="coreNewPerDay" type="number" min="1" value="10"/></label><label>آيات مراجعة/يوم<input id="coreReviewPerDay" type="number" min="1" value="30"/></label><label>مدة الجلسة<input id="coreSessionMinutes" type="number" min="5" value="25"/></label><label>يوم المراجعة الأسبوعية<select id="coreWeeklyReviewDay"><option value="0">الأحد</option><option value="1">الاثنين</option><option value="2">الثلاثاء</option><option value="3">الأربعاء</option><option value="4">الخميس</option><option value="5">الجمعة</option><option value="6">السبت</option></select></label><label>سورة بداية الحفظ<select id="coreStartSurah"></select></label><label>آية بداية الحفظ<input id="coreStartAyah" type="number" min="1" value="1"/></label></div><button class="btn primary" id="coreSavePlan" type="button">حفظ الخطة الأساسية</button><div class="mem-note">المرحلة الأولى: تثبيت يومي 7 أيام. بعدها تدخل المجموعة في مراجعة متباعدة تبدأ كل 7 أيام وتتكيف مع تقييمك.</div></section></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>الأسبوع القادم</h3><p>قبل أن تحفظ، اعرف ماذا ينتظرك في كل يوم.</p></div><span class="badge" id="memWeekBadge">مراجعة أسبوعية</span></div><div class="mem-week-grid" id="memWeekGrid"></div></section>
        <section class="mem-panel"><div class="mem-panel-head"><div><h3>ما سيحدث لاحقًا</h3><p>الحفظ الجديد لا يدخل المحفوظ السابق إلا بعد استكمال دورة التثبيت.</p></div></div><div class="mem-upcoming-list" id="memUpcomingList"></div></section><section class="mem-panel"><div class="mem-panel-head"><div><h3>نقاط تحتاج دعمًا</h3><p>المجموعات التي تكررت فيها نتيجة «صعب» أو «أخطأت» ستظهر هنا لتعود إليها في جلسة أقرب.</p></div><span class="badge" id="memWeakCount">0 مجموعات تحتاج دعمًا</span></div><div class="mem-range-list" id="memWeakList"></div></section>`;
      view.insertBefore(root,shell||view.firstChild);
    }
    const planView=$('#view-plan');
    if(planView && !$('#legacyPlanNotice')){
      const note=document.createElement('div');note.id='legacyPlanNotice';note.className='mem-core-notice';note.innerHTML='<b>ملاحظة:</b> الخطة العامة الموجودة هنا تصلح لختمة/ورد القراءة، أما خطة <strong>الحفظ والمراجعة</strong> الأساسية فتدار من «الحفظ والمراجعة» حتى لا تختلط أهداف القراءة بالحفظ.';planView.querySelector('.section-head')?.after(note);
    }
  }

  function onQuranReady(){loadQuran().then(()=>{importLegacyIfNeeded();injectUI();bind();render();});}
  function bind(){
    if(window.__rafiqMemBound)return;window.__rafiqMemBound=true;
    $('#memStartSession')?.addEventListener('click',startSession);
    $('#memAddPrior')?.addEventListener('click',addPriorRange);
    $('#coreSavePlan')?.addEventListener('click',saveCorePlan);
    ['coreStartSurah','memPriorStartSurah','memPriorEndSurah'].forEach(id=>$('#'+id)?.addEventListener('change',updateAyahMaxes));
    ['coreStartAyah','memPriorStartAyah','memPriorEndAyah'].forEach(id=>$('#'+id)?.addEventListener('input',updateAyahMaxes));
    document.addEventListener('rafiq-home-updated',renderHomeCore);
    document.addEventListener('rafiq-memorization-change',()=>{render();renderHomeCore();});
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){data=load();render();renderHomeCore();}});
  }
  function renderHomeCore(){
    const host=$('#todayList');if(!host)return;
    const p=taskPlan();
    host.innerHTML=`<article class="today-row core-today-row"><b>حفظ جديد</b><span>${p.newItem?esc(rangeLabel(p.newItem)):'لا يوجد'}</span><em>${p.newItem?'ابدأ به أولًا':'أنشئ خطة'}</em></article><article class="today-row core-today-row"><b>تثبيت</b><span>${p.stabilizationCount?p.stabilizationCount+' آية في دورة التثبيت':'لا يوجد مستحق'}</span><em>7 أيام</em></article><article class="today-row core-today-row"><b>مراجعة</b><span>${p.reviewCount?p.reviewCount+' آية مستحقة':'لا توجد مستحقة'}</span><em>${p.backlog?`${p.backlog} متأخر`:'منتظم'}</em></article><article class="today-row core-today-row"><b>جلسة اليوم</b><span>الحفظ → التثبيت → المراجعة</span><button class="inline-cta" id="homeMemSessionBtn" type="button">ابدأ الآن →</button></article>`;
    $('#homeMemSessionBtn')?.addEventListener('click',startSession);
  }

  // Public API for diagnostics and future modules.
  window.RAFIQ_MEM = {
    getData:()=>JSON.parse(JSON.stringify(data)),
    today:()=>today(),
    render:()=>render(),
    startSession,
    plan:()=>taskPlan(),
    grade:(id,grade)=>{const i=data.items.find(x=>x.id===id);if(i)gradeItem(i,grade,today());},
    reset:()=>{data=cloneDefault();save();render();renderHomeCore();}
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onQuranReady,{once:true});else onQuranReady();
  document.addEventListener('rafiq-quran-ready',onQuranReady,{once:false});
})();
