/* Rafiq Quran — Memorization Core v5
 * A simple user-facing plan on top of one local memorization/review engine.
 * Review modes: weekly (7-day cycle) or FSRS-like spaced repetition.
 */
(() => {
  'use strict';
  const STORAGE_KEY='rafiq-memorization-core-v5';
  const LEGACY_KEYS=['rafiq-memorization-core-v4','rafiq-memorization-core-v3','rafiq-memorization-core-v2','rafiq-memorization-core-v1','rafiq-state-v85'];
  const $=s=>document.querySelector(s);
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const toast=m=>window.rafiqToast?.(m);
  const DEFAULT={version:6,plan:{unit:'ayahs',amount:5,startSurah:1,startAyah:1,startIndex:1,cursor:null,reviewMode:'weekly',stabilizationDays:7,goals:[],activeGoalIndex:0,goalCursor:null,goalRange:null,enabled:false,mode:'rate',autoEnabled:true,weeklyReview:{enabled:true,days:7,distribution:'smart'}},dailyTasks:{},dailyReviews:{},items:[],priorRanges:[],history:[],sessions:[],activeSession:null,unitCache:{}};
  let data=load(); let quran=[]; let ready=false; let sessionModal=null; let pickerModal=null;

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function load(){
    try{
      const current=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(current)return merge(current);
      for(const key of LEGACY_KEYS){
        const raw=JSON.parse(localStorage.getItem(key)||'null');
        if(raw&&typeof raw==='object')return migrateLegacy(raw);
      }
    }catch{}
    return clone(DEFAULT);
  }
  function merge(raw){
    const d=clone(DEFAULT);
    const legacyGoal=raw.plan?.goalRange?{start:raw.plan.goalRange.start,end:raw.plan.goalRange.end}:null;
    const rawGoals=Array.isArray(raw.plan?.goals)?raw.plan.goals:(legacyGoal?[legacyGoal]:[]);
    d.plan={...d.plan,...(raw.plan||{}),unit:['ayahs','page','juz'].includes(raw.plan?.unit)?raw.plan.unit:'ayahs',amount:Math.max(1,Number(raw.plan?.amount||5)),reviewMode:raw.plan?.reviewMode==='spaced'?'spaced':'weekly',stabilizationDays:Math.max(1,Math.min(30,Number(raw.plan?.stabilizationDays||7))),weeklyReview:{enabled:raw.plan?.weeklyReview?.enabled!==false,days:7,distribution:['smart','ayahs','pages','surahs'].includes(raw.plan?.weeklyReview?.distribution)?raw.plan.weeklyReview.distribution:'smart'},goals:rawGoals.filter(g=>g?.start&&g?.end).map(g=>({start:clone(g.start),end:clone(g.end)})),activeGoalIndex:Math.max(0,Number(raw.plan?.activeGoalIndex||0)),goalCursor:raw.plan?.goalCursor?clone(raw.plan.goalCursor):null,goalRange:null,enabled:raw.plan?.enabled!==false,mode:raw.plan?.mode||'rate',autoEnabled:raw.plan?.autoEnabled!==false};
    if(!raw.plan?.enabled && (raw.plan?.goalRange || raw.plan?.goals?.length || raw.plan?.amount || raw.plan?.startSurah)) d.plan.enabled=true;
    d.dailyTasks=raw.dailyTasks&&typeof raw.dailyTasks==='object'?raw.dailyTasks:{};d.dailyReviews=raw.dailyReviews&&typeof raw.dailyReviews==='object'?raw.dailyReviews:{};
    d.items=Array.isArray(raw.items)?raw.items:[]; d.priorRanges=Array.isArray(raw.priorRanges)?raw.priorRanges:[];
    d.history=Array.isArray(raw.history)?raw.history:[]; d.sessions=Array.isArray(raw.sessions)?raw.sessions:[]; d.activeSession=raw.activeSession&&typeof raw.activeSession==='object'?raw.activeSession:null;
    d.unitCache=raw.unitCache&&typeof raw.unitCache==='object'?raw.unitCache:{};
    return d;
  }
  function migrateLegacy(raw){
    const d=clone(DEFAULT);
    if(raw.settings){d.plan.amount=Math.max(1,Number(raw.settings.newPerDay||1));d.plan.startSurah=Math.max(1,Number(raw.settings.startSurah||1));d.plan.startAyah=Math.max(1,Number(raw.settings.startAyah||1));d.plan.reviewMode=raw.settings.reviewMode==='spaced'?'spaced':'weekly';d.plan.stabilizationDays=Math.max(1,Math.min(30,Number(raw.settings.stabilizationDays||7)));}
    d.items=Array.isArray(raw.items)?clone(raw.items):[]; d.priorRanges=Array.isArray(raw.priorRanges)?clone(raw.priorRanges):[]; d.plan.enabled=true;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch{}
    return d;
  }
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{} document.dispatchEvent(new CustomEvent('rafiq-memorization-change'));}
  async function loadQuran(){
    if(quran.length===114)return quran;
    if(Array.isArray(window.RAFIQ_QURAN)&&window.RAFIQ_QURAN.length===114)return quran=window.RAFIQ_QURAN;
    try{const r=await fetch('./quran-uthmani.json',{cache:'force-cache'});if(r.ok)quran=await r.json()}catch{}
    return quran;
  }
  function ritualKey(){try{if(typeof window.RAFIQ_GET_RITUAL_KEY==='function')return window.RAFIQ_GET_RITUAL_KEY()}catch{} const d=new Date();return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function keyDate(k){const m=/^rafiq-(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));return m?new Date(+m[1],+m[2]-1,+m[3]):new Date()}
  function addDays(k,n){const d=keyDate(k);d.setDate(d.getDate()+Number(n||0));return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function diffDays(a,b){return Math.round((keyDate(b)-keyDate(a))/86400000)}
  function today(){return ritualKey()}
  function humanDate(k){return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long'}).format(keyDate(k))}
  function shortDate(k){return new Intl.DateTimeFormat('ar-EG',{weekday:'short',day:'numeric',month:'short'}).format(keyDate(k))}
  function surah(s){return quran[Number(s)-1]||null}
  function count(s){return Number(surah(s)?.count||surah(s)?.verses?.length||0)}
  function point(s,a){const c=count(s)||1;return {s:Math.max(1,Math.min(114,+s||1)),a:Math.max(1,Math.min(c,+a||1))}}
  function cmp(a,b){return a.s===b.s?a.a-b.a:a.s-b.s}
  function nextPoint(p){const c=count(p.s);return p.a<c?{s:p.s,a:p.a+1}:p.s<114?{s:p.s+1,a:1}:null}
  function points(start,end,limit=12000){let a=point(start.s,start.a),b=point(end.s,end.a);if(cmp(a,b)>0)[a,b]=[b,a];const out=[];let p=a;while(p&&cmp(p,b)<=0&&out.length<limit){out.push({...p});if(cmp(p,b)===0)break;p=nextPoint(p)}return out}
  function rangeCount(r){return points(r.start,r.end,20000).length}
  function rangeLabel(r){const a=point(r.start.s,r.start.a),b=point(r.end.s,r.end.a),sa=surah(a.s),sb=surah(b.s);if(!sa||!sb)return'مقطع غير محدد';if(a.s===b.s&&a.a===1&&b.a===count(a.s))return`${sa.name} · سورة كاملة`;return a.s===b.s?`${sa.name} · الآيات ${a.a}–${b.a}`:`${sa.name} ${a.a} → ${sb.name} ${b.a}`}
  function nextAfterRange(r){return nextPoint(point(r.end.s,r.end.a))}
  function makeId(p='m'){return`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
  function overlap(a,b){return points(a.start,a.end,20000).some(p=>points(b.start,b.end,20000).some(q=>p.s===q.s&&p.a===q.a))}

  // Unit resolver. Layout indexes are cached locally; the first online sync populates them.
  async function apiUnit(unit,index){
    const key=`${unit}:${index}`; if(data.unitCache[key])return clone(data.unitCache[key]);
    const resolved=await window.RAFIQ_QURAN_INDEX?.resolve?.(unit,index,1);
    if(!resolved)return null;
    const out={start:resolved.start,end:resolved.end,unit,index};
    data.unitCache[key]=out; save(); return clone(out);
  }
  async function resolveUnit(unit,index,amount){
    unit=String(unit);amount=Math.max(1,Number(amount)||1);index=Math.max(1,Number(index)||1);
    if(unit==='ayahs')return null;
    if(unit==='surah'){const end=Math.min(114,index+amount-1);return{start:{s:index,a:1},end:{s:end,a:count(end)},label:amount===1?`${surah(index)?.name||'السورة'} كاملة`:`السور ${index}–${end}`};}
    const resolved=await window.RAFIQ_QURAN_INDEX?.resolve?.(unit,index,amount);
    if(!resolved)return null;
    return{start:resolved.start,end:resolved.end,label:unitLabel(unit,index,amount)};
  }
  function unitLabel(unit,index,amount){const names={page:amount===1?'صفحة':'صفحات',juz:amount===1?'جزء':'أجزاء'};return`${names[unit]||unit} ${index}${amount>1?`–${index+amount-1}`:''}`}
  async function pointToUnitIndex(unit,p){
    const cached=await window.RAFIQ_QURAN_INDEX?.ensure?.();
    const bucket=cached?.[unit];
    if(Array.isArray(bucket)){const hit=bucket.find(x=>x.start&&x.end&&cmp(x.start,p)<=0&&cmp(p,x.end)<=0);if(hit)return Number(hit.index);}
    return null;
  }
  async function resolvePlanRange(){
    const p=data.plan;if(!p.enabled||p.autoEnabled===false)return null;
    const goal=normalizeGoalCursor();
    let st=null, limit=null;
    if(goal){st=goal.cursor;limit=goal.range.end;}
    else st=p.unit==='ayahs'?point(p.cursor?.s||p.startSurah,p.cursor?.a||p.startAyah):null;
    if(p.unit==='ayahs'){let all=[],cur=st;while(cur&&all.length<p.amount){if(limit&&cmp(cur,limit)>0)break;all.push(cur);cur=nextPoint(cur)}return all.length?{start:all[0],end:all[all.length-1]}:null}
    let startIndex=Number(p.startIndex||1);
    if(goal){const mapped=await pointToUnitIndex(p.unit,st);if(mapped)startIndex=mapped;}
    const maxIndex=p.unit==='page'?604:30;let amount=Math.min(Math.max(1,Number(p.amount||1)),Math.max(0,maxIndex-startIndex+1));if(!amount)return null;
    const r=await resolveUnit(p.unit,startIndex,amount);if(!r)return null;
    if(limit&&cmp(r.start,limit)>0)return null;
    if(limit&&cmp(r.end,limit)>0){let cur=r.start,last=null,n=0;while(cur&&cmp(cur,limit)<=0&&n<20000){last=cur;n++;cur=nextPoint(cur)}return last?{start:r.start,end:last}:null;}
    return r;
  }
  function advancePlanCursor(range){const p=data.plan;if(!range)return;const goal=normalizeGoalCursor();if(goal){p.goalCursor=nextAfterRange(range);normalizeGoalCursor();return;}if(p.unit==='ayahs'){p.cursor=nextAfterRange(range);p.startSurah=p.cursor?.s||1;p.startAyah=p.cursor?.a||1}else{p.startIndex=Math.max(1,Number(p.startIndex||1)+Math.max(1,Number(p.amount||1)));}}

  function allItems(){return [...data.items,...data.priorRanges]}
  function dueItems(k=today()){return allItems().filter(i=>i.phase==='review'&&(!i.dueKey||diffDays(i.dueKey,k)>=0)).sort((a,b)=>String(a.dueKey||'').localeCompare(String(b.dueKey||'')))}
  function stabilizationDue(k=today()){return data.items.filter(i=>i.phase==='stabilizing'&&!(i.stabilizationHistory||[]).some(x=>x.key===k)&&(!i.snoozedUntil||i.snoozedUntil<=k))}
  function nextDue(item){return item.dueKey||today()}
  function formatNext(item){const d=nextDue(item);const n=diffDays(today(),d);return n<=0?'مستحق اليوم':n===1?'غدًا':`بعد ${n} يوم · ${humanDate(d)}`}
  function activeWeak(){return allItems().filter(i=>(Number(i.lapses)||0)>0||Number(i.difficulty||5)>=7||((i.history||[]).filter(h=>h.grade==='hard'||h.grade==='relearn').length>=2)).sort((a,b)=>((Number(b.lapses)||0)+((b.history||[]).filter(h=>h.grade==='hard'||h.grade==='relearn').length||0))-((Number(a.lapses)||0)+((a.history||[]).filter(h=>h.grade==='hard'||h.grade==='relearn').length||0))).slice(0,8)}

  function recordSessionEvent(type,itemId,extra={}){
    const k=today();
    data.history.push({key:k,type,itemId:itemId||null,ts:Date.now(),...extra});
    data.sessions.push({key:k,type,itemId:itemId||null,ts:Date.now()});
    if(data.history.length>500)data.history=data.history.slice(-500);
    if(data.sessions.length>300)data.sessions=data.sessions.slice(-300);
  }
  function lastActivityKey(){return String(data.history.at(-1)?.key||'')}
  function goalList(){return Array.isArray(data.plan.goals)?data.plan.goals:[];}
  function currentGoal(){const goals=goalList();if(!goals.length)return null;const idx=Math.min(Math.max(0,Number(data.plan.activeGoalIndex||0)),goals.length-1);const g=goals[idx];const cursor=data.plan.goalCursor?point(data.plan.goalCursor.s,data.plan.goalCursor.a):point(g.start.s,g.start.a);return{index:idx,range:g,cursor};}
  function normalizeGoalCursor(){const goals=goalList();if(!goals.length)return null;let idx=Math.min(Math.max(0,Number(data.plan.activeGoalIndex||0)),goals.length-1);let cursor=data.plan.goalCursor?point(data.plan.goalCursor.s,data.plan.goalCursor.a):point(goals[idx].start.s,goals[idx].start.a);while(idx<goals.length&&cmp(cursor,goals[idx].end)>0){idx++;if(idx<goals.length)cursor=point(goals[idx].start.s,goals[idx].start.a);}data.plan.activeGoalIndex=idx;data.plan.goalCursor=cursor;return idx<goals.length?{index:idx,range:goals[idx],cursor}:null;}
  function hasGoal(){return goalList().length>0;}
  function goalLabel(){const g=currentGoal();if(!g)return'لا يوجد هدف محدد';return goalList().length>1?`الهدف الحالي: ${rangeLabel(g.range)} · ${goalList().length} أهداف في خطتك`:rangeLabel(g.range);}
  function isPlanPaused(){
    const last=lastActivityKey();
    return !!last && diffDays(last,today())>=7;
  }
  function nextInterval(item,grade,key){
    const now=keyDate(key), prev=String(item.history?.at(-1)?.key||item.createdKey||key), elapsed=Math.max(1,diffDays(prev,key));
    const current=Math.max(1,Number(item.stability||3));
    const d=Math.max(1,Math.min(10,Number(item.difficulty||5)));
    const retr=Math.exp(Math.log(.9)*elapsed/current);
    let stability=current, next=1;
    if(grade==='relearn'){stability=Math.max(1,Math.min(2,current*.45));next=1;item.lapses=(Number(item.lapses)||0)+1;}
    else if(grade==='hard'){stability=Math.max(1.5,current*(0.85+0.08*retr)*(1-(d-5)*0.015));next=Math.max(1,Math.round(stability*.8));}
    else if(grade==='good'){stability=Math.max(2,current*(1.25+0.20*retr)*(1+(5-d)*0.02));next=Math.max(2,Math.round(stability));}
    else {stability=Math.max(4,current*(1.7+0.35*retr)*(1+(5-d)*0.025));next=Math.max(3,Math.round(stability));}
    item.stability=Math.round(stability*10)/10; item.interval=next; item.difficulty=Math.max(1,Math.min(10,d+(grade==='easy'?-0.35:grade==='good'?-0.1:grade==='hard'?0.25:0.6))); item.dueKey=addDays(key,next);
    return next;
  }

  function createNew(range,key=today(),options={}){
    if(data.items.some(i=>i.origin==='new'&&i.createdKey===key&&i.start?.s===range.start.s&&i.start?.a===range.start.a&&i.end?.s===range.end.s&&i.end?.a===range.end.a))return data.items.find(i=>i.origin==='new'&&i.createdKey===key&&i.start?.s===range.start.s&&i.start?.a===range.start.a&&i.end?.s===range.end.s&&i.end?.a===range.end.a);
    const item={id:makeId('new'),origin:'new',start:point(range.start.s,range.start.a),end:point(range.end.s,range.end.a),createdKey:key,phase:'stabilizing',stabilizationHistory:[],mode:data.plan.reviewMode,history:[],stability:3,difficulty:5,interval:1,lapses:0,snoozedUntil:null,dueKey:key};
    data.items.push(item);if(options.advancePlan)advancePlanCursor(range);else if(hasGoal()&&currentGoal()){data.plan.goalCursor=nextAfterRange(range);normalizeGoalCursor();}save();return item;
  }
  function recordExplicitNew(range,key=today(),options={}){
    if(allItems().some(i=>overlap(i,range))){toast('هذا المقطع موجود بالفعل في سجل الحفظ.');return null}
    const item=createNew({...range},key,options);recordSessionEvent('memorized',item.id,{range:clone(item.start),end:clone(item.end)});toast(`تم تسجيل ${rangeLabel(item)} كمحفوظ.`);render();return item;
  }
  function addPrior(range){if(allItems().some(i=>overlap(i,range))){toast('هذا المقطع مسجل بالفعل.');return null} const item={id:makeId('prior'),origin:'prior',start:range.start,end:range.end,createdKey:today(),phase:'review',mode:data.plan.reviewMode,dueKey:today(),interval:7,stability:7,difficulty:5,history:[],lapses:0,snoozedUntil:null};data.priorRanges.push(item);save();toast(`تمت إضافة ${rangeLabel(item)} إلى المحفوظ السابق.`);render();return item}

  function noteStabilization(item,grade,key){
    if(grade==='relearn'){
      item.stabilizationHistory=[];item.lapses=(Number(item.lapses)||0)+1;item.snoozedUntil=null;item.history.push({key,grade,phase:'stabilizing'});recordSessionEvent('stabilization_failed',item.id);toast('لم يثبت بعد؛ سنعيد التثبيت من اليوم الأول.');return;
    }
    const done=new Set((item.stabilizationHistory||[]).map(x=>x.key));
    if(!done.has(key))item.stabilizationHistory.push({key,grade});
    item.snoozedUntil=null;item.history.push({key,grade,phase:'stabilizing'});recordSessionEvent('stabilization',item.id,{grade});
    const required=Math.max(1,Math.min(30,Number(data.plan.stabilizationDays||7)));
    if(new Set(item.stabilizationHistory.map(x=>x.key)).size>=required){
      item.phase='review';item.stability=required;item.interval=required;item.difficulty=grade==='easy'?4:grade==='hard'?6:5;item.mode=item.mode||data.plan.reviewMode;item.dueKey=addDays(key,required);
      toast(`تم تثبيت ${rangeLabel(item)} — أصبحت ضمن المحفوظ السابق.`);
    }
  }
  function scheduleSpaced(item,grade,key){nextInterval(item,grade,key);}
  function grade(itemId,grade,key=today()){
    const item=allItems().find(i=>i.id===itemId);if(!item)return null;
    grade=['relearn','hard','good','easy'].includes(grade)?grade:'good';
    item.history=item.history||[];item.snoozedUntil=null;
    if(item.phase==='stabilizing')noteStabilization(item,grade,key);
    else{
      item.history.push({key,grade,phase:'review'});
      if((item.mode||data.plan.reviewMode)==='weekly'){
        const days=grade==='relearn'?1:7; item.interval=days; item.dueKey=addDays(key,days); if(grade==='relearn')item.lapses=(Number(item.lapses)||0)+1;
      }else scheduleSpaced(item,grade,key);
      recordSessionEvent('review',item.id,{grade,next:item.dueKey});
    }
    save();render();return {item:clone(item),next:formatNext(item)};
  }
  function snooze(itemId){const item=allItems().find(i=>i.id===itemId);if(!item)return;item.snoozedUntil=addDays(today(),1);save();render();toast('تم تأجيل المراجعة إلى الغد.');}

  async function pointPageMap(){
    const idx=await window.RAFIQ_QURAN_INDEX?.ensure?.();
    const pages=Array.isArray(idx?.pages)?idx.pages:[];
    if(!pages.length)return null;
    const map=new Map();
    for(const page of pages){
      for(const p of points(page.start,page.end,20000))map.set(`${p.s}:${p.a}`,Number(page.index));
    }
    return map;
  }
  function mergeContiguousPoints(arr){
    if(!arr.length)return[];
    const out=[];let start=arr[0],prev=arr[0];
    for(let i=1;i<arr.length;i++){
      const cur=arr[i];
      const expected=nextPoint(prev);
      if(expected&&expected.s===cur.s&&expected.a===cur.a){prev=cur;continue;}
      out.push({start:{...start},end:{...prev}});start=cur;prev=cur;
    }
    out.push({start:{...start},end:{...prev}});return out;
  }
  async function buildWeeklyReviewAssignments(){
    const cfg=data.plan.weeklyReview||{};
    if(cfg.enabled===false || data.plan.reviewMode!=='weekly')return{};
    const days=Math.max(1,Number(cfg.days||7));
    const items=(data.priorRanges||[]).filter(i=>i?.start&&i?.end);
    if(!items.length)return{};
    let units=[];
    let distribution=['smart','ayahs','pages','surahs'].includes(cfg.distribution)?cfg.distribution:'smart';
    if(distribution==='ayahs'){
      const pts=[];for(const item of items)pts.push(...points(item.start,item.end,30000).map(p=>({...p,sourceId:item.id})));
      const total=pts.length,target=Math.max(1,Math.ceil(total/days));
      for(let i=0;i<pts.length;i+=target){const chunk=pts.slice(i,i+target);const ranges=mergeContiguousPoints(chunk);for(const r of ranges)units.push({...r,sourceIds:[...new Set(chunk.map(x=>x.sourceId))]});}
    }else if(distribution==='pages'){
      const pageMap=await pointPageMap();
      if(pageMap){
        const pageMapToPoints=new Map();
        for(const item of items){for(const p of points(item.start,item.end,30000)){const pg=pageMap.get(`${p.s}:${p.a}`);if(pg==null)continue;if(!pageMapToPoints.has(pg))pageMapToPoints.set(pg,[]);pageMapToPoints.get(pg).push({...p,sourceId:item.id});}}
        const pages=[...pageMapToPoints.keys()].sort((a,b)=>a-b);const target=Math.max(1,Math.ceil(pages.length/days));
        for(let i=0;i<pages.length;i+=target){const chosen=pages.slice(i,i+target),pts=chosen.flatMap(pg=>pageMapToPoints.get(pg)||[]).sort((a,b)=>a.s-b.s||a.a-b.a);if(!pts.length)continue;for(const r of mergeContiguousPoints(pts))units.push({start:r.start,end:r.end,sourceIds:[...new Set(pts.filter(p=>cmp(p,r.start)>=0&&cmp(p,r.end)<=0).map(x=>x.sourceId))],label:`الصفحات ${chosen[0]}–${chosen.at(-1)}`});}
      }else distribution='ayahs';
    }
    if(distribution==='surahs'){
      for(const item of items){
        let p=point(item.start.s,item.start.a), end=point(item.end.s,item.end.a);
        while(p&&p.s<=end.s){const lastAyah=p.s===end.s?end.a:count(p.s);units.push({start:{s:p.s,a:p.a},end:{s:p.s,a:lastAyah},sourceIds:[item.id],label:`${surah(p.s)?.name||'السورة'} · ${p.s===end.s&&p.a===1&&lastAyah===count(p.s)?'كاملة':`آيات ${p.a}–${lastAyah}`}`});if(p.s===end.s)break;p={s:p.s+1,a:1};}
      }
    }else if(distribution==='smart'){
      const ordered=[];for(const item of items)ordered.push(...points(item.start,item.end,30000).map(p=>({...p,sourceId:item.id})));ordered.sort((a,b)=>cmp(a,b));
      const total=ordered.length,target=total/days;let cursor=0;
      for(let d=0;d<days&&cursor<total;d++){const remain=total-cursor,daysLeft=days-d,desired=Math.max(1,Math.round(remain/daysLeft));let cut=Math.min(total,cursor+desired);
        if(d<days-1){let best=cut,bestScore=Infinity;const window=Math.max(2,Math.floor(desired*.15)),lo=Math.max(cursor+1,cut-window),hi=Math.min(total-1,cut+window);for(let j=lo;j<=hi;j++){const prev=ordered[j-1],next=ordered[j],breakHere=prev.s!==next.s;const score=Math.abs(j-(cursor+target))-(breakHere?Math.min(2,target*.08):0);if(score<bestScore){bestScore=score;best=j}}cut=best}
        const chunk=ordered.slice(cursor,cut),ranges=mergeContiguousPoints(chunk);for(const r of ranges){const ids=[...new Set(chunk.filter(p=>cmp(p,r.start)>=0&&cmp(p,r.end)<=0).map(p=>p.sourceId))];units.push({...r,sourceIds:ids,label:rangeLabel(r)})}cursor=cut;
      }
    }
    if(!units.length)return{};
    const fp=items.map(i=>`${i.id||''}:${i.start.s}:${i.start.a}:${i.end.s}:${i.end.a}`).sort().join('|')+'#'+distribution+'#'+days;
    const todayKey=today();
    const stored=cfg.schedule;
    const age=stored?diffDays(stored.anchor,todayKey):Infinity;
    let bucketsUnits,anchor;
    if(stored && stored.fingerprint===fp && Array.isArray(stored.buckets) && stored.buckets.length===days && age>=0 && age<days){
      anchor=stored.anchor;bucketsUnits=stored.buckets;
    }else{
      const buckets=Array.from({length:days},()=>({load:0,units:[]}));
      const weight=u=>Math.max(1,rangeCount(u));
      for(const u of [...units].sort((a,b)=>weight(b)-weight(a))){let idx=0;for(let i=1;i<buckets.length;i++)if(buckets[i].load<buckets[idx].load)idx=i;buckets[idx].units.push(u);buckets[idx].load+=weight(u);}
      bucketsUnits=buckets.map(b=>b.units);anchor=todayKey;
      data.plan.weeklyReview={...cfg,schedule:{anchor,fingerprint:fp,buckets:bucketsUnits}};save();
    }
    const out={};
    for(let i=0;i<days;i++){
      const key=addDays(anchor,i);
      out[key]=(bucketsUnits[i]||[]).map((u,j)=>({id:`weekly-${key}-${j}`,start:u.start,end:u.end,sourceIds:u.sourceIds||[],weekly:true,distribution}));
    }
    return out;
  }
  function weeklyTaskForDay(assignments,key){return Array.isArray(assignments?.[key])?assignments[key]:[]}

  async function buildPlanForDay(key=today()){
    const manual=Array.isArray(data.dailyTasks?.[key])?data.dailyTasks[key]:[];
    const manualReviewTasks=Array.isArray(data.dailyReviews?.[key])?data.dailyReviews[key]:[];
    const manualReviewItems=manualReviewTasks.flatMap(x=>(x.itemIds||[]).map(id=>allItems().find(i=>i.id===id)).filter(Boolean));
    const recorded=data.items.find(i=>i.origin==='new'&&i.createdKey===key);
    const newRanges=[];
    if(data.plan.enabled && data.plan.autoEnabled!==false){const auto=await resolvePlanRange();if(auto)newRanges.push({...auto,auto:true});}
    manual.map(x=>x.range||x).filter(Boolean).forEach(r=>{if(!newRanges.some(x=>overlap(x,r)))newRanges.push({...r,auto:false})});
    if(recorded&&!newRanges.some(r=>overlap(r,recorded)))newRanges.push(recorded);
    const reviewMap=new Map();
    const weeklyAssignments=await buildWeeklyReviewAssignments();
    if((data.plan.reviewMode==='weekly') && weeklyTaskForDay(weeklyAssignments,key).length){
      for(const w of weeklyTaskForDay(weeklyAssignments,key))reviewMap.set(w.id,w);
    }
    [...dueItems(key).filter(i=>!(data.plan.reviewMode==='weekly' && i.origin==='prior')),...manualReviewItems].forEach(i=>reviewMap.set(i.id,i));
    return{key,newRanges,newRange:newRanges[0]||null,stabilizing:stabilizationDue(key),reviews:[...reviewMap.values()],tomorrowKey:addDays(key,1),manualCount:manual.length,manualReviewCount:manualReviewTasks.length,auto:data.plan.enabled&&data.plan.autoEnabled!==false,weeklyAssignments:weeklyAssignments};
  }
  function addDailyTask(range,key=today()){
    if(!range)return null;
    data.dailyTasks=data.dailyTasks||{};
    const arr=Array.isArray(data.dailyTasks[key])?data.dailyTasks[key]:[];
    if(arr.some(x=>overlap(x.range||x,range))){toast('هذا المقطع مضاف بالفعل لمهمة اليوم.');return null;}
    arr.push({id:makeId('day'),range:{start:clone(range.start),end:clone(range.end)},createdAt:Date.now()});
    data.dailyTasks[key]=arr.slice(-6);save();toast(`تمت إضافة ${rangeLabel(range)} لمهمة اليوم.`);render();renderHomeCore();return arr.at(-1);
  }
  function removeDailyTask(id,key=today()){
    const arr=Array.isArray(data.dailyTasks?.[key])?data.dailyTasks[key]:[];
    data.dailyTasks[key]=arr.filter(x=>x.id!==id);save();render();renderHomeCore();
  }
  function addDailyReview(range,key=today()){
    if(!range?.reviewItemIds?.length)return null;
    data.dailyReviews=data.dailyReviews||{};const arr=Array.isArray(data.dailyReviews[key])?data.dailyReviews[key]:[];
    if(arr.some(x=>(x.itemIds||[]).some(id=>range.reviewItemIds.includes(id)))){toast('هذه المراجعة مضافة بالفعل لليوم.');return null;}
    arr.push({id:makeId('review-day'),range:{start:clone(range.start),end:clone(range.end)},itemIds:[...range.reviewItemIds],createdAt:Date.now()});data.dailyReviews[key]=arr.slice(-6);save();toast(`تمت إضافة ${rangeLabel(range)} إلى مراجعة اليوم.`);render();renderHomeCore();return arr.at(-1);
  }
  function removeDailyReview(id,key=today()){
    const arr=Array.isArray(data.dailyReviews?.[key])?data.dailyReviews[key]:[];data.dailyReviews[key]=arr.filter(x=>x.id!==id);save();render();renderHomeCore();
  }
  function goalProgress(){
    const goals=goalList();if(!goals.length)return null;
    const current=normalizeGoalCursor();let total=0,remaining=0;
    goals.forEach((g,i)=>{const full=rangeCount(g);total+=full;if(i>Number(data.plan.activeGoalIndex||0))remaining+=full;});
    if(current)remaining+=rangeCount({start:current.cursor,end:current.range.end});
    const done=Math.max(0,total-remaining);return{total,remaining,done,percent:Math.min(100,Math.round(done/Math.max(1,total)*100)),goals:goals.length,current:current?.range||null};
  }
  async function forecast(){
    const p=data.plan||{},g=goalProgress();if(!p.enabled||!g||!p.amount||p.autoEnabled===false)return null;
    const dailyRange=await resolvePlanRange();if(!dailyRange)return null;
    const dailyAyahs=Math.max(1,rangeCount(dailyRange));const days=Math.max(1,Math.ceil(g.remaining/dailyAyahs));const date=new Date();date.setDate(date.getDate()+days);
    return{days,finish:date,remaining:g.remaining,percent:g.percent,dailyAyahs};
  }

  async function futurePreview(days=7){
    const arr=[];for(let i=0;i<days;i++){const key=addDays(today(),i);const p=await buildPlanForDay(key);arr.push({key,newRange:i===0?p.newRange:null,stabilizing:p.stabilizing,reviews:p.reviews})}return arr;
  }

  function closeModal(m){m?.remove();}
  function openRangePicker({title='تحديد المقطع',mode='new',onDone}={}){
    closeModal(pickerModal);
    pickerModal=document.createElement('div');pickerModal.className='mem-modal';
    const modeLabel=mode==='prior'?'المحفوظ السابق':mode==='review'?'المراجعة':mode==='goal'?'هدف الحفظ':'الحفظ الجديد';
    pickerModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-picker-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button" aria-label="إغلاق">×</button><div class="mem-modal-kicker">${modeLabel}</div><h3>${esc(title)}</h3><p class="mem-help">اختَر طريقة تحديد المقطع كما تناسبك: بالسورة، بالآيات، بالصفحات أو بالأجزاء. لا تحتاج لحساب عدد الآيات بنفسك.</p><div class="picker-tabs" role="tablist"><button type="button" data-unit="surah">بالسورة</button><button type="button" data-unit="ayahs">بالآيات</button><button type="button" data-unit="page">بالصفحات</button><button type="button" data-unit="juz">بالأجزاء</button></div><div id="pickerFields"></div><div class="mem-picker-note" id="pickerNote" aria-live="polite"></div><div class="mem-quick-actions"><button class="btn" type="button" data-cancel>إلغاء</button><button class="btn primary" type="button" data-confirm>تأكيد المقطع</button></div></div>`;
    document.body.appendChild(pickerModal);
    const fields=pickerModal.querySelector('#pickerFields'),note=pickerModal.querySelector('#pickerNote'); let unit='surah';
    function surahOptions(){return quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('')}
    function rangeByAyahFields(){
      const allowAmount=mode!=='prior';
      return `<div class="mem-form-grid">
        <label>السورة<select id="pickStartSurah">${surahOptions()}</select></label>
        <label>من آية<input id="pickStartAyah" type="number" min="1" value="1" inputmode="numeric"></label>
        ${allowAmount?'<label class="full-width">طريقة التحديد<select id="pickAyahMode"><option value="range">من آية إلى آية</option><option value="amount">من آية + عدد آيات</option></select></label>':''}
        <label id="pickEndAyahWrap">إلى آية<input id="pickEndAyah" type="number" min="1" value="1" inputmode="numeric"></label>
        ${allowAmount?'<label id="pickAmountWrap" hidden>عدد الآيات<input id="pickAmount" type="number" min="1" value="5" inputmode="numeric"></label>':''}
      </div>`;
    }
    function bindDynamic(){
      const ss=$('#pickStartSurah');
      if(ss){const max=count(Number(ss.value)||1);const sa=$('#pickStartAyah'),ea=$('#pickEndAyah');if(sa)sa.max=String(max);if(ea)ea.max=String(max);ss.addEventListener('change',()=>{const m=count(Number(ss.value)||1);if(sa)sa.max=String(m);if(ea)ea.max=String(m);});}
      const am=$('#pickAyahMode');
      if(am)am.addEventListener('change',()=>{const isAmount=am.value==='amount';$('#pickEndAyahWrap')?.toggleAttribute('hidden',isAmount);$('#pickAmountWrap')?.toggleAttribute('hidden',!isAmount);});
    }
    function renderFields(){
      if(unit==='surah'){
        fields.innerHTML=`<div class="mem-form-grid"><label>السورة<select id="pickSurah">${surahOptions()}</select></label><label class="full-width"><span>ما الذي تريد تحديده؟</span><select id="pickSurahMode"><option value="full">السورة كاملة</option><option value="range">من آية إلى آية</option></select></label><label id="pickSurahFromWrap" hidden>من آية<input id="pickSurahFrom" type="number" min="1" value="1" inputmode="numeric"></label><label id="pickSurahToWrap" hidden>إلى آية<input id="pickSurahTo" type="number" min="1" value="1" inputmode="numeric"></label></div>`;
        const sel=$('#pickSurah'),sm=$('#pickSurahMode'),fw=$('#pickSurahFromWrap'),tw=$('#pickSurahToWrap');
        const sync=()=>{const show=sm?.value==='range';fw?.toggleAttribute('hidden',!show);tw?.toggleAttribute('hidden',!show);const max=count(Number(sel?.value||1));if($('#pickSurahFrom'))$('#pickSurahFrom').max=String(max);if($('#pickSurahTo'))$('#pickSurahTo').max=String(max)};
        sel?.addEventListener('change',sync);sm?.addEventListener('change',sync);sync();
      } else if(unit==='ayahs') {
        fields.innerHTML=rangeByAyahFields();bindDynamic();
      } else if(unit==='page') {
        fields.innerHTML=`<div class="mem-form-grid"><label>من صفحة<input id="pickIndex" type="number" min="1" max="604" value="1" inputmode="numeric"></label><label>إلى صفحة<input id="pickEndIndex" type="number" min="1" max="604" value="1" inputmode="numeric"></label></div>`;
      } else {
        fields.innerHTML=`<div class="mem-form-grid"><label>من جزء<input id="pickIndex" type="number" min="1" max="30" value="1" inputmode="numeric"></label><label>إلى جزء<input id="pickEndIndex" type="number" min="1" max="30" value="1" inputmode="numeric"></label></div>`;
      }
      pickerModal.querySelectorAll('.picker-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.unit===unit));
      note.textContent='';
    }
    pickerModal.querySelectorAll('.picker-tabs button').forEach(b=>b.onclick=()=>{unit=b.dataset.unit;renderFields()});
    pickerModal.querySelector('[data-cancel]').onclick=()=>closeModal(pickerModal);
    pickerModal.querySelector('.mem-modal-close').onclick=()=>closeModal(pickerModal);
    pickerModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(pickerModal);
    pickerModal.querySelector('[data-confirm]').onclick=async()=>{
      try{
        let range=null;
        if(unit==='surah'){
          const ss=Number($('#pickSurah')?.value||1), sm=$('#pickSurahMode')?.value||'full';
          if(sm==='range'){
            const aa=Number($('#pickSurahFrom')?.value||1),ea=Number($('#pickSurahTo')?.value||aa);if(aa>ea){note.textContent='آية البداية لازم تكون قبل آية النهاية.';return}range={start:point(ss,aa),end:point(ss,ea)};
          }else{range={start:{s:ss,a:1},end:{s:ss,a:count(ss)},label:`${surah(ss).name} · سورة كاملة`};}
        } else if(unit==='ayahs') {
          const ss=Number($('#pickStartSurah')?.value||1),aa=Number($('#pickStartAyah')?.value||1),mode2=$('#pickAyahMode')?.value||'range';
          if(mode2==='amount'){
            const amt=Math.max(1,Number($('#pickAmount')?.value||1));let cur=point(ss,aa),all=[];while(cur&&all.length<amt){all.push(cur);cur=nextPoint(cur)}range=all.length?{start:all[0],end:all[all.length-1]}:null;
          }else{const ea=Number($('#pickEndAyah')?.value||aa),st=point(ss,aa),en=point(ss,ea);if(cmp(st,en)>0){note.textContent='آية البداية لازم تكون قبل آية النهاية.';return}range={start:st,end:en};}
        } else {
          const idx=Number($('#pickIndex')?.value||1),end=Number($('#pickEndIndex')?.value||idx);if(end<idx){note.textContent='البداية لازم تكون قبل النهاية.';return}note.textContent='جارٍ تحديد المقطع…';const r1=await resolveUnit(unit,idx,1),r2=await resolveUnit(unit,end,1);if(!r1||!r2){note.textContent='هذا التقسيم غير متاح الآن محليًا.';return}range={start:r1.start,end:r2.end,label:`${unitLabel(unit,idx,1)} → ${unitLabel(unit,end,1)}`};
        }
        if(!range){note.textContent='لم أستطع تحديد المقطع. جرّب اختيارًا آخر.';return}
        if(mode==='review'){
          const matches=allItems().filter(i=>overlap(i,range));
          if(!matches.length){note.textContent='المراجعة اليدوية لازم تكون من محفوظ مسجل عندك أولًا.';return}
          range.reviewItemIds=matches.map(i=>i.id);
        }
        closeModal(pickerModal);onDone?.(range,{unit});
      }catch{note.textContent='تعذر تحديد المقطع. جرّب مرة أخرى.'}
    };
    renderFields();
  }

  async function startSession(){
    const p=await buildPlanForDay();
    const ordered=[
      ...p.reviews.map(i=>({kind:i.weekly?'weekly':'review',item:i})),
      ...p.stabilizing.map(i=>({kind:'stabilize',item:i})),
      ...(p.newRanges||[]).map(r=>({kind:'new',item:r}))
    ];
    const sessionKey=today();
    let active=data.activeSession&&data.activeSession.key===sessionKey?data.activeSession:null;
    if(!active){active={key:sessionKey,startedAt:Date.now(),done:[]};data.activeSession=active;save();}
    const done=new Set(active.done||[]);
    const tasks=ordered.filter(t=>!done.has(String(t.item.id||`${t.kind}:${rangeLabel(t.item)}`)));
    closeModal(sessionModal);
    sessionModal=document.createElement('div');sessionModal.className='mem-modal';
    if(!tasks.length){
      const resume=active.done?.length;
      sessionModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>${resume?'أنجزت مهام اليوم ✓':'مفيش جلسة مجهزة لليوم بعد'}</h3><p class="mem-help">${resume?'تم حفظ تقدم جلستك. لا توجد مهام أخرى مستحقة الآن.':'أضف حفظ اليوم أو شغّل الخطة التلقائية وحدد المعدل والهدف، وبعدها هتظهر الجلسة هنا.'}</p><div class="mem-quick-actions"><button class="btn" data-close>إغلاق</button>${resume?'':'<button class="btn primary" data-plan>افتح الخطة</button>'}</div></div>`;
      document.body.appendChild(sessionModal);sessionModal.querySelector('[data-close]').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('[data-plan]')?.addEventListener('click',()=>{closeModal(sessionModal);window.RAFIQ_APP?.go?.('plan')});sessionModal.querySelector('.mem-modal-close').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(sessionModal);return;
    }
    sessionModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-session-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>مهمتك اليوم</h3><p class="mem-help">المراجعة أولًا، ثم التثبيت، ثم الحفظ الجديد. لا يوجد مؤقت؛ توقف عندما تتقن ما عليك.</p><div class="mem-session-task-list">${tasks.map((t,i)=>{const id=String(t.item.id||`${t.kind}:${rangeLabel(t.item)}`);return `<article class="mem-session-task" data-task="${esc(id)}"><b>${i+1}</b><div><strong>${t.kind==='new'?'حفظ جديد':t.kind==='stabilize'?'تثبيت':'مراجعة مستحقة'}</strong><span>${esc(rangeLabel(t.item))}</span><small>${t.kind==='new'?'احفظه بهدوء ثم سجّل أنك أتقنته':t.kind==='stabilize'?`جلسة تثبيت ${((t.item.stabilizationHistory||[]).length)+1} من ${Number(data.plan.stabilizationDays||7)}`:`${formatNext(t.item)}`}</small></div><div class="mem-task-buttons">${t.kind==='new'?'<button type="button" data-action="record">سجل أنني أتقنته</button>':'<button type="button" data-action="recite">سمّع</button><button type="button" data-action="study">دراسة المقطع</button><button type="button" data-action="play">استماع</button><button type="button" data-action="snooze">غدًا</button>'}</div></article>`}).join('')}</div><div class="mem-session-footer">يمكنك الخروج والعودة لاحقًا؛ التقدم سيبقى محفوظًا.</div></div>`;
    document.body.appendChild(sessionModal);
    sessionModal.querySelector('.mem-modal-close').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(sessionModal);
    sessionModal.querySelectorAll('.mem-session-task').forEach(row=>row.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=async()=>{
      const task=tasks.find(t=>String(t.item.id||`${t.kind}:${rangeLabel(t.item)}`)===row.dataset.task);if(!task)return;const action=btn.dataset.action;
      if(action==='record'){const created=recordExplicitNew(task.item,today(),{advancePlan:task.kind==='new'&&task.item.auto===true});if(created){active.done.push(String(created.id));save();row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ تم</span>';render();}}
      else if(action==='recite')openRecitation(task.item,task.kind,active,row);
      else if(action==='study'){window.RAFIQ_RETURN_TO_SESSION=true;closeModal(sessionModal);window.RAFIQ_APP?.go?.('quran');window.openAyahStudy?.(task.item.start.s,task.item.start.a)}
      else if(action==='play'){await playRange(task.item)}
      else if(action==='snooze'){snooze(task.item.id);active.done.push(String(task.item.id));save();row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ نراجع غدًا</span>';}
    }));
  }
  async function playRange(r){const audio=document.querySelector('#quranAudio');if(!audio)return toast('مشغل التلاوة غير متاح هنا.');const p=point(r.start.s,r.start.a);const url=`https://everyayah.com/data/Husary_128kbps/${String(p.s).padStart(3,'0')}${String(p.a).padStart(3,'0')}.mp3`;const playable=await window.RAFIQ_CONTENT?.getPlayableAudio(url)||url;audio.src=playable;audio.currentTime=0;audio.play().catch(()=>toast('التلاوة تحتاج اتصالًا أو تنزيلًا مسبقًا.'))}
  function openRecitation(item,phase,activeSession=null,row=null){
    const modal=document.createElement('div');modal.className='mem-modal';const verses=points(item.start,item.end,3000).map(p=>({p,text:surah(p.s)?.verses?.[p.a-1]?.text||''}));
    modal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-recite-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">التسميع</div><h3>${esc(rangeLabel(item))}</h3><div class="mem-recall-state"><span>النص مخفي. استرجعه من الذاكرة.</span><span>${verses.length} آية</span></div><div class="mem-recite-hints"><button type="button" data-hint="first">إظهار أول آية</button><button type="button" data-hint="firstword">إظهار أول كلمة</button><button type="button" data-hint="all">إظهار النص</button></div><div class="mem-recite-text" id="reciteText" hidden></div><div class="mem-grade-grid"><button type="button" data-grade="relearn"><b>لم أتذكر</b><small>احتجت للنص أو لم أستطع الإكمال.</small></button><button type="button" data-grade="hard"><b>احتجت مساعدة</b><small>استخدمت تلميحًا أو أخطأت في أكثر من موضع.</small></button><button type="button" data-grade="good"><b>جيد</b><small>استرجاع صحيح مع تردد بسيط.</small></button><button type="button" data-grade="easy"><b>أتقنت</b><small>استرجاع كامل تقريبًا من الذاكرة.</small></button></div><p class="mem-next-preview" id="reciteNextPreview">اختر تقييمك بعد التسميع لمعرفة الموعد القادم.</p></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove();modal.querySelector('.mem-modal-close').onclick=close;modal.querySelector('.mem-modal-backdrop').onclick=close;
    const text=modal.querySelector('#reciteText');
    modal.querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>{const h=b.dataset.hint;if(h==='first'){text.hidden=false;text.innerHTML=`<p>${esc(verses[0]?.text||'')}</p>`}else if(h==='firstword'){text.hidden=false;const first=(verses[0]?.text||'').trim().split(/\s+/)[0]||'';text.innerHTML=`<p>${esc(first)} …</p>`}else{text.hidden=false;text.innerHTML=verses.map(v=>`<p><span class="recite-ayah-num">${v.p.a}</span> ${esc(v.text)}</p>`).join('')}});
    modal.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const result=phase==='weekly'?gradeWeeklyTask(item,b.dataset.grade):grade(item.id,b.dataset.grade);if(result){if(activeSession){activeSession.done=activeSession.done||[];if(!activeSession.done.includes(String(item.id)))activeSession.done.push(String(item.id));save();}modal.querySelector('#reciteNextPreview').textContent=`${result.next}`;setTimeout(()=>{close();if(row)row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ تم</span>';render();},900)}});
  }

  function setInput(id,v){const e=$(id);if(e)e.value=String(v??'')}
  function populateSurahs(select){if(!select||!quran.length)return;select.innerHTML=quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('')}
  function setWeeklyReviewConfig({enabled=true,distribution='smart'}={}){
    const d=['smart','ayahs','pages','surahs'].includes(distribution)?distribution:'smart';
    data.plan.weeklyReview={enabled:enabled!==false,days:7,distribution:d};save();render();renderHomeCore();
    toast(enabled===false?'تم إيقاف المراجعة الأسبوعية للمحفوظ السابق.':`تم ضبط المراجعة الأسبوعية: ${d==='smart'?'توزيع ذكي':d==='ayahs'?'آيات متقاربة':d==='pages'?'صفحات':'حسب السور'}.`);
  }
  function gradeWeeklyTask(task,grade,key=today()){
    const ids=[...(task.sourceIds||[])];ids.forEach(id=>{const item=allItems().find(i=>i.id===id);if(!item)return;item.history=item.history||[];item.history.push({key,grade,phase:'weekly'});if(grade==='relearn')item.lapses=(Number(item.lapses)||0)+1;});
    save();return{next:'المراجعة الأسبوعية القادمة ستكون في موعد الدورة التالية.'};
  }

  function setReviewMode(mode){
    const m=mode==='weekly'?'weekly':'spaced';
    data.plan.reviewMode=m;
    for(const item of data.items||[]){
      if(item.phase!=='review')continue;
      item.mode=m;
      const last=String(item.history?.at(-1)?.key||item.createdKey||today());
      const base=keyDate(last);
      const days=m==='weekly'?7:Math.max(1,Number(item.interval||7));
      item.dueKey=addDays(last,days);
    }
    for(const item of data.priorRanges||[]) item.mode=m;
    save();render();toast(m==='weekly'?'تم اختيار المراجعة الأسبوعية.':'تم اختيار المراجعة الذكية.');
  }
  function addGoal(range){
    if(!range)return;data.plan.goals=data.plan.goals||[];
    if(data.plan.goals.some(g=>overlap(g,range))){toast('هذا الهدف يتداخل مع هدف موجود بالفعل.');return null;}
    data.plan.goals.push({start:clone(range.start),end:clone(range.end)});
    if(data.plan.goals.length===1){data.plan.activeGoalIndex=0;data.plan.goalCursor=clone(range.start);}
    data.plan.enabled=true;data.plan.autoEnabled=true;data.plan.mode='goal';
    toast(`تمت إضافة الهدف: ${rangeLabel(range)}`);save();render();renderHomeCore();return range;
  }
  function removeGoal(index){const goals=goalList();if(index<0||index>=goals.length)return;goals.splice(index,1);if(!goals.length){data.plan.activeGoalIndex=0;data.plan.goalCursor=null;}else{data.plan.activeGoalIndex=Math.min(Number(data.plan.activeGoalIndex||0),goals.length-1);const g=goals[data.plan.activeGoalIndex];data.plan.goalCursor=clone(g.start);}save();render();renderHomeCore();toast('تم حذف الهدف.');}
  function moveGoal(index,dir){const goals=goalList(),to=index+dir;if(to<0||to>=goals.length)return;[goals[index],goals[to]]=[goals[to],goals[index]];data.plan.activeGoalIndex=0;data.plan.goalCursor=clone(goals[0].start);save();render();renderHomeCore();}

  async function savePlan(){
    const unit=['ayahs','page','juz'].includes($('#planUnit')?.value)?$('#planUnit').value:'ayahs';
    const amount=Math.max(1,Number($('#planAmount')?.value||1));
    data.plan={...data.plan,enabled:true,mode:hasGoal()?'goal':'rate',unit,amount,startSurah:Number($('#planStartSurah')?.value||1),startAyah:Number($('#planStartAyah')?.value||1),startIndex:Number($('#planStartIndex')?.value||1),cursor:data.plan.cursor||null,reviewMode:$('#planReviewMode')?.value||data.plan.reviewMode,stabilizationDays:Math.max(1,Math.min(30,Number($('#planStabilizationDays')?.value||data.plan.stabilizationDays||7)))};
    setReviewMode(data.plan.reviewMode);
    await resolvePlanRange();
    toast(hasGoal()?`تم تحديث المعدل اليومي لخطة أهدافك: ${amount} ${unit==='ayahs'?'آية':unit==='page'?'صفحة':'جزء'} يوميًا.`:`تم حفظ المعدل اليومي: ${amount} ${unit==='ayahs'?'آية':unit==='page'?'صفحة':'جزء'} يوميًا.`);
    render();renderHomeCore();
  }
  function renderPlanInputs(){
    const p=data.plan,unitSelect=$('#planUnit');if(!unitSelect)return;unitSelect.value=p.unit||'ayahs';setInput('#planAmount',p.amount||10);populateSurahs($('#planStartSurah'));setInput('#planStartSurah',p.startSurah||1);setInput('#planStartAyah',p.startAyah||1);setInput('#planStartIndex',p.startIndex||1);const ayahFieldsEl=$('#planAyahFields');if(ayahFieldsEl)ayahFieldsEl.hidden=p.unit!=='ayahs';const indexFieldsEl=$('#planIndexFields');if(indexFieldsEl)indexFieldsEl.hidden=p.unit==='ayahs';
    const idx=$('#planStartIndex');if(idx){idx.max=String(p.unit==='page'?604:p.unit==='juz'?30:114);idx.min='1'}
    const explain=$('#planStartExplain');const hasGoalsNow=hasGoal();if(explain)explain.textContent=hasGoalsNow?'لديك أهداف؛ لذلك ينتقل الحفظ بينها تلقائيًا بالترتيب.':'حدد من أين يبدأ أول مقدار يومي.';const startBlock=$('.plan-start-block');if(startBlock)startBlock.hidden=hasGoalsNow;if($('#planReviewModeWeekly'))$('#planReviewModeWeekly').checked=p.reviewMode==='weekly';if($('#planReviewModeSpaced'))$('#planReviewModeSpaced').checked=p.reviewMode!=='weekly';if($('#planStabilizationDays'))$('#planStabilizationDays').value=p.stabilizationDays||7;if($('#weeklyReviewDistribution'))$('#weeklyReviewDistribution').value=p.weeklyReview?.distribution||'smart';const wdb2=$('#weeklyDistributionSection');if(wdb2)wdb2.hidden=p.reviewMode!=='weekly';
  }
  function render(){
    const host=$('#memCoreHost');if(!host)return;
    renderPlanInputs();renderGoalList();
    buildPlanForDay().then(async p=>{
      const todayNew=p.newRanges?.length?p.newRanges.map(rangeLabel).join(' + '):'—';
      let tomorrowText='لا توجد مهمة حفظ جديدة بعد';
      if(p.newRanges?.length){
        const lastRange=p.newRanges[p.newRanges.length-1];
        if(data.plan.unit==='ayahs'&&data.plan.enabled&&data.plan.autoEnabled!==false){
          const nextStart=nextAfterRange(lastRange);
          const sa=nextStart?surah(nextStart.s):null;
          tomorrowText=sa?`غدًا: يبدأ من ${sa.name} · آية ${nextStart.a}`:'غدًا: خطتك مكتملة إلى هنا 🎉';
        }else if(data.plan.enabled&&data.plan.autoEnabled!==false){
          tomorrowText=`غدًا: يكمل رفيق القرآن من حيث توقفت (${data.plan.unit==='page'?'الصفحة':'الجزء'} التالي تلقائيًا)`;
        }else{
          tomorrowText='الخطة التلقائية متوقفة؛ أضف مهمة يدوية لغدٍ من هنا.';
        }
      }
      setText('#memNewToday',todayNew);setText('#memNewDesc',p.manualCount?'اختيارك لليوم':'خطة تلقائية من الهدف والمعدل اليومي');setText('#memStabilizeToday',rangeSummary(p.stabilizing));setText('#memReviewToday',rangeSummary(p.reviews));const overdue=p.reviews.filter(i=>diffDays(i.dueKey,today())<0).length;setText('#memBacklog',overdue?`${overdue} متأخر`:'لا يوجد');setText('#memTomorrow',tomorrowText);
      setText('#memPlanSummary',planSummary());const dt=$('#memDailyTasks');const todays=Array.isArray(data.dailyTasks?.[today()])?data.dailyTasks[today()]:[];const todaysReviews=Array.isArray(data.dailyReviews?.[today()])?data.dailyReviews[today()]:[];if(dt){const rows=[...todays.map(x=>({kind:'حفظ',cls:'new',label:rangeLabel(x.range||x),id:x.id})),...todaysReviews.map(x=>({kind:'مراجعة',cls:'review',label:rangeLabel(x.range||x),id:x.id}))];dt.innerHTML=rows.length?rows.map(x=>`<article class="daily-task-row ${x.cls}"><span><b>${x.kind}</b> ${esc(x.label)}</span><button type="button" class="btn" data-remove-${x.cls}="${x.id}">حذف</button></article>`).join(''):'<div class="daily-task-empty">لم تضف مهمة يدوية اليوم.</div>';dt.querySelectorAll('[data-remove-new]').forEach(b=>b.onclick=()=>removeDailyTask(b.dataset.removeNew));dt.querySelectorAll('[data-remove-review]').forEach(b=>b.onclick=()=>removeDailyReview(b.dataset.removeReview));}const pf=$('#planForecastBox');const fc=await forecast();window.RAFIQ_MEM_FORECAST=fc||null;if(pf){const unitName={ayahs:'آية',page:'صفحة',juz:'جزء'}[data.plan.unit]||'آية';const g=goalProgress();pf.innerHTML=fc?`<div><strong>${g.goals>1?`إجمالي ${g.goals} أهداف · `:''}متبقي ${fc.remaining.toLocaleString('ar-EG')} آية</strong><span>${data.plan.amount} ${unitName} يوميًا · تقدير الوصول ${fc.finish.toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'})}</span></div><b>${fc.percent}%</b>`:`<div><strong>${data.plan.enabled?'المعدل اليومي محفوظ':'الخطة التلقائية متوقفة'}</strong><span>${hasGoal()?`الهدف الحالي: ${esc(rangeLabel(currentGoal().range))}. أضف أهدافًا أخرى متى شئت.`:`ابدأ بإضافة هدف أو اكتفِ بمعدل يومي يبدأ من نقطة البداية التي تحددها.`}</span></div>`}setText('#memReturnNote',isPlanPaused()?'مرحبًا بعودتك. رفيق القرآن سيعيد توزيع ما فاتك بدل كسر خطتك.':'');if($('#weeklyReviewPreview')){const weekly=await buildWeeklyReviewAssignments();const rows=Array.from({length:7},(_,i)=>{const k=addDays(today(),i),rs=weekly[k]||[];return `<div class="weekly-day"><b>${i===0?'اليوم':new Intl.DateTimeFormat('ar-EG',{weekday:'short'}).format(keyDate(k))}</b><span>${rs.length?rs.map(r=>esc(rangeLabel(r))).join(' · '):'—'}</span></div>`}).join('');$('#weeklyReviewPreview').innerHTML=`<div class="weekly-preview-grid">${rows}</div>`;}
      const counts=allItems().reduce((acc,i)=>{acc.total+=rangeCount(i);if(i.phase==='stabilizing')acc.active++;if(i.phase==='review'&&i.dueKey&&diffDays(i.dueKey,today())>=0)acc.due++;return acc},{total:0,active:0,due:0});
      setText('#memSavedCount',`${counts.total.toLocaleString('ar-EG')} آية`);setText('#memSavedCount2',`${counts.total.toLocaleString('ar-EG')} آية`);setText('#memActiveCount',`${counts.active} مقاطع تحت التثبيت`);setText('#memDueCount',`${counts.due} مقاطع مستحقة`);setText('#memWeakCount',`${activeWeak().length} مقاطع تحتاج دعمًا`);
      renderWeek();renderUpcoming();renderWeak();renderSaved();renderGaps();renderHistory();
    });
  }
  function setText(id,v){const e=$(id);if(e)e.textContent=v}
  function planSummary(){const p=data.plan,names={ayahs:'آية',page:'صفحة',juz:'جزء'};const rate=`${p.amount} ${names[p.unit]||'آية'} يوميًا`;const g=goalProgress();if(g){return`${g.goals} أهداف · ${rate} · ${g.remaining.toLocaleString('ar-EG')} آية متبقية`}return`معدل يومي · ${rate}`}
  async function renderWeek(){const box=$('#memWeekGrid');if(!box)return;const arr=[];for(let i=0;i<7;i++){const k=addDays(today(),i),p=await buildPlanForDay(k),rangeText=p.newRanges?.length?p.newRanges.map(r=>esc(rangeLabel(r))).join(' + '):'—';arr.push(`<article class="mem-week-card ${i===0?'today':''}"><header><b>${i===0?'اليوم':i===1?'غدًا':new Intl.DateTimeFormat('ar-EG',{weekday:'short'}).format(keyDate(k))}</b><span>${humanDate(k)}</span></header><div><small>حفظ جديد</small><strong>${rangeText}</strong></div><div><small>تثبيت</small><strong>${p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+rangeCount(x),0)} آية`:'—'}</strong></div><div><small>مراجعة</small><strong>${p.reviews.length?`${p.reviews.reduce((n,x)=>n+rangeCount(x),0)} آية`:'—'}</strong></div></article>`)}box.innerHTML=arr.join('')}
  function renderUpcoming(){const box=$('#memUpcomingList');if(!box)return;const rows=allItems().filter(i=>i.phase==='stabilizing'||i.phase==='review').sort((a,b)=>String((a.dueKey||'')).localeCompare(String(b.dueKey||''))).slice(0,8);box.innerHTML=rows.length?rows.map(i=>`<article><b>${esc(rangeLabel(i))}</b><span>${i.phase==='stabilizing'?`تثبيت ${(new Set((i.stabilizationHistory||[]).map(x=>x.key))).size}/${Number(data.plan.stabilizationDays||7)} · باقي ${Math.max(0,Number(data.plan.stabilizationDays||7)-(new Set((i.stabilizationHistory||[]).map(x=>x.key))).size)} جلسات`:formatNext(i)}</span></article>`).join(''):`<div class="mem-empty">لا توجد مواعيد مؤجلة حاليًا.</div>`}
  function renderWeak(){const box=$('#memWeakList');if(!box)return;const rows=activeWeak();box.innerHTML=rows.length?rows.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${Number(i.lapses||0)} مرات إعادة تثبيت · صعوبة ${Math.round(Number(i.difficulty||5))/10}</small></div><button class="btn" data-weak="${i.id}">سمّع الآن</button></article>`).join(''):`<div class="mem-empty">لا توجد نقاط ضعف مسجلة حتى الآن.</div>`;box.querySelectorAll('[data-weak]').forEach(b=>b.onclick=()=>{const i=allItems().find(x=>x.id===b.dataset.weak);if(i)openRecitation(i,'review')})}
  function renderSaved(){const box=$('#memSavedList');if(!box)return;const rows=[...data.items,...data.priorRanges].sort((a,b)=>String(b.createdKey||'').localeCompare(String(a.createdKey||''))).slice(0,8);box.innerHTML=rows.length?rows.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${i.phase==='stabilizing'?`تثبيت · ${new Set((i.stabilizationHistory||[]).map(x=>x.key)).size}/${Number(data.plan.stabilizationDays||7)}`:`موعد المراجعة: ${formatNext(i)}`}</small></div></article>`).join(''):`<div class="mem-empty">لم تضف محفوظًا بعد.</div>`}
  function renderGaps(){const box=$('#memGapsList');if(!box)return;const gaps=[];for(let s=1;s<=114&&gaps.length<10;s++){const ranges=allItems().filter(i=>i.start?.s<=s&&i.end?.s>=s).map(i=>({a:i.start.s===s?i.start.a:1,b:i.end.s===s?i.end.a:count(s)})).sort((a,b)=>a.a-b.a);if(!ranges.length)continue;let end=0;for(const r of ranges){if(r.a>end+1)gaps.push({s,a:end+1,b:r.a-1});end=Math.max(end,r.b)}if(end<count(s))gaps.push({s,a:end+1,b:count(s)})}box.innerHTML=gaps.length?gaps.slice(0,8).map(g=>`<article class="mem-range-row"><div><strong>${esc(surah(g.s)?.name||'')}</strong><small>الآيات ${g.a}–${g.b} غير مضافة إلى المحفوظ</small></div><button class="btn" data-gap="${g.s}:${g.a}:${g.b}">إضافة للحفظ</button></article>`).join(''):`<div class="mem-empty">لا توجد فجوات بين المقاطع التي سجلتها.</div>`;box.querySelectorAll('[data-gap]').forEach(b=>b.onclick=()=>{const [ss,aa,bb]=b.dataset.gap.split(':').map(Number);addPrior({start:point(ss,aa),end:point(ss,bb)})})}
  function renderGoalList(){
    const box=$('#planGoalList');if(!box)return;const goals=goalList();
    box.innerHTML=goals.length?goals.map((g,i)=>`<article class="plan-goal-row"><div class="plan-goal-index">${i+1}</div><div class="plan-goal-copy"><strong>${esc(rangeLabel(g))}</strong><small>${i===Number(data.plan.activeGoalIndex||0)?'الهدف الحالي':'سيأتي بعده'}</small></div><button type="button" class="icon-btn danger" data-remove-goal="${i}" aria-label="حذف الهدف">×</button></article>`).join(''):'<div class="plan-goal-empty">مفيش أهداف محددة. أضف سورة أو مقطع، وبعدها أضف هدفًا آخر حتى لو كان في سورة بعيدة تمامًا.</div>';
    box.querySelectorAll('[data-remove-goal]').forEach(b=>b.onclick=()=>removeGoal(Number(b.dataset.removeGoal)));
  }
  function renderHistory(){const box=$('#memHistoryList');if(!box)return;const rows=data.history.slice(-12).reverse();box.innerHTML=rows.length?rows.map(h=>`<article class="mem-upcoming-list article"><b>${h.type==='memorized'?'حفظ':h.type==='review'?'مراجعة':h.type==='stabilization'?'تثبيت':h.type==='stabilization_failed'?'تعثر':'نشاط'}</b><span>${humanDate(h.key)} · ${h.grade||''}</span></article>`).join(''):`<div class="mem-empty">سيظهر هنا سجل رحلتك أولًا بأول.</div>`}


  function injectUI(){
    const view=$('#view-plan'); if(!view||$('#memCoreRoot'))return;
    const root=document.createElement('section');root.id='memCoreRoot';root.className='mem-core-root';
    root.innerHTML=`<div class="mem-core-head compact"><div><span class="mem-kicker">الحفظ والمراجعة</span><h2>من هنا تدير رحلتك ببساطة</h2><p>أضف ما حفظته من قبل، حدّد ما تريد حفظه الآن، واترك رفيق القرآن يوضح لك موعد المراجعة والتثبيت.</p></div><div class="mem-core-actions"><button class="btn primary" id="memStartSession" type="button">ابدأ جلسة اليوم</button></div></div>
      <section class="mem-panel mem-today-overview"><div class="plan-section-head"><div><span class="mem-kicker">اليوم</span><h3>مهمتك الآن</h3><p>هذه هي الخلاصة التي تراها كل يوم: ماذا تراجع، ماذا تثبت، وماذا تحفظ.</p></div><button class="btn" id="memAddPriorTop" type="button">+ أضف محفوظًا سابقًا</button></div><div class="mem-today-grid"><article class="mem-today-card review"><small>تراجع اليوم</small><strong id="memReviewToday">—</strong><span id="memTomorrow">—</span></article><article class="mem-today-card"><small>تثبّت اليوم</small><strong id="memStabilizeToday">—</strong><span>محفوظ جديد يحتاج تثبيتًا قبل المراجعة</span></article><article class="mem-today-card new"><small>تحفظ اليوم</small><strong id="memNewToday">—</strong><span id="memNewDesc">—</span></article></div></section>

      <section class="mem-panel plan-flow-card"><div class="plan-flow-head"><div><span class="mem-kicker">1 · المحفوظ السابق</span><h3>ماذا كنت حافظًا قبل رفيق القرآن؟</h3><p>أضف السور أو المقاطع التي تحفظها بالفعل. موعد مراجعتها يتحدد حسب اختيارك في بند 4 تحت (كل 7 أيام أو تكرار متباعد).</p></div><button class="btn primary" id="memAddPrior" type="button">+ إضافة محفوظ سابق</button></div><div class="prior-mini-state"><strong id="memSavedCount">0 آية</strong><span id="memDueCount">0 مقاطع مستحقة اليوم</span></div></section>

      <section class="mem-panel plan-flow-card"><div class="plan-flow-head"><div><span class="mem-kicker">2 · الحفظ الجديد</span><h3>احفظ اليوم أو اطلب منا أن نخطط لك</h3><p>تقدر تحدد مهمة اليوم بنفسك، أو تضيف هدفًا واحدًا أو عدة أهداف ليتم توزيعها تلقائيًا.</p></div></div><div class="plan-choice-grid compact"><article class="plan-choice"><div><small>مهمة اليوم</small><strong>أنا أختار ماذا أحفظ</strong><span>بالسورة أو بالآيات أو بالصفحات أو بالأجزاء.</span></div><button class="btn primary" id="memAddDaily" type="button">+ أضف حفظ اليوم</button></article><article class="plan-choice"><div><small>خطة تلقائية</small><strong>أريد من رفيق القرآن أن يخطط لي</strong><span>أضف أهدافك بالترتيب وحدد مقدارًا يوميًا، وسنكمل معك هدفًا بعد هدف.</span></div><button class="btn" id="memSetGoal" type="button">+ أضف هدفًا</button></article></div><section class="plan-section-card inner"><div class="plan-section-head"><div><h4>أهداف الحفظ</h4><p>أضف ما تريد حفظه على المدى الطويل، حتى لو كانت السور بعيدة عن بعضها.</p></div><label class="plan-switch"><input id="planAutoEnabled" type="checkbox" checked><span></span><b>تشغيل الخطة</b></label></div><div id="planGoalList" class="plan-goal-list"></div><div class="plan-inline-add"><button class="btn" id="memSetGoalInline" type="button">+ إضافة هدف آخر</button></div></section></section>

      <section class="mem-panel plan-flow-card"><div class="plan-flow-head"><div><span class="mem-kicker">3 · مقدار الحفظ</span><h3>كم تريد أن تحفظ كل يوم؟</h3><p>هذا الإعداد يستخدم عندما تكون الخطة التلقائية مفعلة. لو حددت مهمة اليوم بنفسك، لا تحتاجه.</p></div><button class="btn" id="coreSavePlan" type="button">حفظ الإعداد</button></div><div class="plan-rate-grid"><label>المقدار<input id="planAmount" type="number" min="1" value="5"></label><label>الوحدة<select id="planUnit"><option value="ayahs">آيات</option><option value="page">صفحات</option><option value="juz">أجزاء</option></select></label></div><div class="plan-start-block"><div class="plan-start-title"><b>من أين تبدأ؟</b><small id="planStartExplain">تستخدم فقط إذا لم تضف هدفًا.</small></div><div id="planAyahFields" class="plan-start-grid"><label>السورة<select id="planStartSurah"></select></label><label>من آية<input id="planStartAyah" type="number" min="1" value="1"></label></div><div id="planIndexFields" class="plan-start-grid" hidden><label id="planStartUnitLabel">بداية المقطع<input id="planStartIndex" type="number" min="1" value="1"></label><div class="plan-start-hint">سيحوّل التطبيق الصفحة أو الجزء إلى موضع فعلي في المصحف.</div></div><div class="plan-forecast-box" id="planForecastBox"></div></div></section>

      <section class="mem-panel plan-flow-card"><div class="plan-flow-head"><div><span class="mem-kicker">4 · نظام المراجعة (يحكم كل محفوظك)</span><h3>اختر أسلوب المراجعة الذي يناسبك</h3><p>هذا الاختيار يحكم كل المراجعة عندك — المحفوظ السابق (بند 1) وأي حفظ جديد بعد ما يترسّخ. إمّا دورة ثابتة كل 7 أيام، أو رفيق القرآن يحدد الموعد بالتكرار المتباعد حسب أدائك.</p></div></div><div class="review-mode-grid"><label class="review-mode-card"><input id="planReviewModeWeekly" name="planReviewMode" type="radio" value="weekly"><span><b>كل 7 أيام</b><small>موعد ثابت وبسيط لكل محفوظك — سابق وجديد.</small></span></label><label class="review-mode-card"><input id="planReviewModeSpaced" name="planReviewMode" type="radio" value="spaced"><span><b>تكرار متباعد ذكي</b><small>الموعد يتغير حسب سهولة المراجعة وصعوبتها.</small></span></label></div><div class="review-settings-row"><label>مدة التثبيت قبل الدخول في المراجعة<input id="planStabilizationDays" type="number" min="1" max="30" value="7"><small>عدد الجلسات المتتالية؛ الافتراضي 7.</small></label></div></section>

      <section class="mem-panel plan-flow-card" id="weeklyDistributionSection"><div class="plan-flow-head"><div><span class="mem-kicker">5 · توزيع الأسبوع (عند اختيار "كل 7 أيام")</span><h3>كيف نوزع محفوظك على أيام الأسبوع؟</h3><p>يظهر هذا فقط عند اختيار "كل 7 أيام" في البند السابق — يوزّع محفوظك السابق على 7 أيام بدل ما تراجعه كله في يوم واحد. يُحفظ تلقائيًا عند التغيير.</p></div></div><div class="weekly-review-controls"><label>طريقة التوزيع<select id="weeklyReviewDistribution"><option value="smart">ذكي ومتوازن (حسب حجم المحفوظ)</option><option value="ayahs">آيات متقاربة</option><option value="pages">صفحات متقاربة</option><option value="surahs">حسب السور قدر الإمكان</option></select></label></div><div class="weekly-review-preview" id="weeklyReviewPreview"></div></section>

      <section class="daily-task-list-wrap plan-section-card"><div class="daily-task-list-head"><div><strong>مراجعة إضافية اليوم</strong><small>لو عندك مقطع تريد مراجعته اليوم يدويًا، أضفه من هنا دون تغيير جدولك.</small></div><button class="btn" id="memAddReview" type="button">+ أضف مراجعة اليوم</button></div><div id="memDailyTasks" class="daily-task-list"></div></section>

      <details class="mem-collapse"><summary>تفاصيل المتابعة</summary><div class="mem-collapse-body"><section class="mem-grid-2"><section class="mem-panel"><div class="mem-panel-head"><div><h3>حفظت شيئًا خارج الخطة؟</h3><p>سجّل المقطع الذي أتقنته فعلًا.</p></div></div><button class="btn primary" id="memRecordNew" type="button">تحديد ما حفظته</button></section><section class="mem-panel"><div class="mem-panel-head"><div><h3>ملخصك</h3><p>أرقام قليلة تكفي لمعرفة حالتك.</p></div></div><div class="mem-stat-row"><div><small>المحفوظ</small><b id="memSavedCount2">0 آية</b></div><div><small>قيد التثبيت</small><b id="memActiveCount">0 مقاطع</b></div><div><small>مستحق اليوم</small><b id="memDueCount2">0 مقاطع</b></div><div><small>يحتاج تثبيتًا</small><b id="memWeakCount">0 مقاطع</b></div></div></section></section><details class="mem-collapse"><summary>هذا الأسبوع</summary><div class="mem-collapse-body"><div class="mem-week-grid" id="memWeekGrid"></div></div></details><details class="mem-collapse"><summary>المواعيد القادمة</summary><div class="mem-collapse-body"><div class="mem-upcoming-list" id="memUpcomingList"></div></div></details><details class="mem-collapse"><summary>تحتاج تثبيتًا</summary><div class="mem-collapse-body"><div class="mem-range-list" id="memWeakList"></div></div></details><details class="mem-collapse"><summary>فجوات في المحفوظ</summary><div class="mem-collapse-body"><div class="mem-range-list" id="memGapsList"></div></div></details><details class="mem-collapse"><summary>سجل الحفظ والمراجعة</summary><div class="mem-collapse-body"><div class="mem-range-list" id="memHistoryList"></div></div></details></div></details>`
    $('#memCoreHost')?.appendChild(root);
    $('#planUnit')?.addEventListener('change',()=>{const u=$('#planUnit').value;$('#planAyahFields').hidden=u!=='ayahs';$('#planIndexFields').hidden=u==='ayahs';const idx=$('#planStartIndex');if(idx)idx.max=String(u==='page'?604:u==='juz'?30:114);const explain=$('#planStartExplain');if(explain)explain.textContent=hasGoal()?'يُستخدم فقط إذا لم تضف أهدافًا بعد.':'حدد من أين يبدأ أول مقدار يومي.';});
    $('#weeklyReviewDistribution')?.addEventListener('change',()=>setWeeklyReviewConfig({enabled:true,distribution:$('#weeklyReviewDistribution')?.value||'smart'}));
    const syncReviewMode=()=>{const mode=document.querySelector('input[name="planReviewMode"]:checked')?.value||data.plan.reviewMode||'spaced';setReviewMode(mode);renderHomeCore();};
    const applyReviewModeVisibility=()=>{const box=$('#weeklyDistributionSection');if(box)box.hidden=data.plan.reviewMode!=='weekly';};
    const syncReviewMode2=()=>{syncReviewMode();applyReviewModeVisibility();};
    $('#planReviewModeWeekly')?.addEventListener('change',syncReviewMode2);$('#planReviewModeSpaced')?.addEventListener('change',syncReviewMode2);
    applyReviewModeVisibility();
    $('#planStabilizationDays')?.addEventListener('change',()=>{const n=Math.max(1,Math.min(30,Number($('#planStabilizationDays').value||7)));data.plan.stabilizationDays=n;save();render();renderHomeCore();});
    $('#memAddPriorTop')?.addEventListener('click',()=>openRangePicker({title:'إضافة محفوظ سابق',mode:'prior',onDone:r=>{if(r)addPrior(r);}}));
    const addGoalClick=()=>openRangePicker({title:'إضافة هدف حفظ',mode:'goal',onDone:r=>addGoal(r)});
    $('#memSetGoal')?.addEventListener('click',addGoalClick);$('#memSetGoalInline')?.addEventListener('click',addGoalClick);
    $('#memStartSession')?.addEventListener('click',startSession);
    $('#coreSavePlan')?.addEventListener('click',savePlan);
    $('#memAddDaily')?.addEventListener('click',()=>openRangePicker({title:'حفظ اليوم',mode:'new',onDone:r=>{if(r)addDailyTask(r)}}));
    $('#memAddReview')?.addEventListener('click',()=>openRangePicker({title:'مراجعة اليوم',mode:'review',onDone:r=>{if(r)addDailyReview(r)}}));
    $('#planAutoEnabled')?.addEventListener('change',()=>{data.plan.autoEnabled=$('#planAutoEnabled').checked;data.plan.enabled=data.plan.autoEnabled;save();render();renderHomeCore();toast(data.plan.autoEnabled?'تم تشغيل الخطة التلقائية.':'تم إيقاف الخطة التلقائية؛ مهام اليوم اليدوية تظل متاحة.');});
    $('#memRecordNew')?.addEventListener('click',()=>openRangePicker({title:'ماذا حفظت اليوم؟',mode:'new',onDone:r=>{if(r)recordExplicitNew(r);}}));
    $('#memAddPrior')?.addEventListener('click',()=>openRangePicker({title:'إضافة محفوظ سابق',mode:'prior',onDone:r=>{if(r)addPrior(r);}}));
  }

  function syncPlanInputs(){
    const p=data.plan;populateSurahs($('#planStartSurah'));if($('#planAutoEnabled'))$('#planAutoEnabled').checked=p.autoEnabled!==false;setInput('#planUnit',['ayahs','page','juz'].includes(p.unit)?p.unit:'ayahs');setInput('#planAmount',p.amount||5);setInput('#planStartSurah',p.startSurah||1);setInput('#planStartAyah',p.startAyah||1);setInput('#planStartIndex',p.startIndex||1);if($('#planReviewModeWeekly'))$('#planReviewModeWeekly').checked=p.reviewMode==='weekly';if($('#planReviewModeSpaced'))$('#planReviewModeSpaced').checked=p.reviewMode!=='weekly';setInput('#planStabilizationDays',p.stabilizationDays||7);setInput('#weeklyReviewDistribution',p.weeklyReview?.distribution||'smart');const wdb=$('#weeklyDistributionSection');if(wdb)wdb.hidden=p.reviewMode!=='weekly';
    const u=p.unit||'ayahs';if($('#planAyahFields'))$('#planAyahFields').hidden=u!=='ayahs';if($('#planIndexFields'))$('#planIndexFields').hidden=u==='ayahs';
  }

  function rangeSummary(items,max=3){
    const arr=(items||[]).map(rangeLabel);
    if(!arr.length)return'لا يوجد';
    const shown=arr.slice(0,max).join(' · ');
    return arr.length>max?`${shown} · +${arr.length-max} مقاطع`:shown;
  }

  function renderHomeCore(){
    const focus=$('#todayFocusContent')||$('#todayList'); if(!focus)return;
    buildPlanForDay().then(async p=>{
      const newText=p.newRanges?.length?p.newRanges.map(rangeLabel).join(' + '):'لا يوجد حفظ جديد محدد اليوم';
      const stabText=rangeSummary(p.stabilizing);
      const reviewText=rangeSummary(p.reviews);
      focus.innerHTML=`<div class="today-focus-tasks"><article class="today-focus-task task-review"><div class="today-focus-task-icon">🔄</div><div><small>تراجع اليوم</small><strong>${reviewText}</strong><span>${p.reviews.length?'هذه مقاطعك المستحقة اليوم. ابدأ بالمراجعة أولًا.':'لا توجد مراجعة مستحقة اليوم.'}</span></div></article><article class="today-focus-task task-stabilize"><div class="today-focus-task-icon">🧱</div><div><small>تثبّت اليوم</small><strong>${stabText}</strong><span>${p.stabilizing.length?'هذه المقاطع في مرحلة التثبيت قبل دخولها المراجعة.':'لا يوجد تثبيت مستحق اليوم.'}</span></div></article><article class="today-focus-task task-new"><div class="today-focus-task-icon">✨</div><div><small>تحفظ اليوم</small><strong>${newText}</strong><span>${p.newRanges?.length?'هذا هو الحفظ الجديد المحدد لك اليوم.':'أضف مهمة اليوم أو فعّل خطة تلقائية.'}</span></div></article></div><div class="today-focus-foot"><span>${p.manualCount?'عندك مهمة يدوية لليوم.':''}${p.auto?' الخطة التلقائية مفعلة.':''}</span><button class="btn" type="button" id="todayPlanBtn">تعديل مهمة اليوم</button></div>`;
      $('#todayPlanBtn')?.addEventListener('click',()=>window.RAFIQ_APP?.go?.('plan'));
    });
  }

  function bindGlobal(){document.addEventListener('rafiq-memorization-change',()=>{render();renderHomeCore()});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){data=load();render();renderHomeCore()}})}
  function onReady(){if(ready)return;ready=true;loadQuran().then(()=>{injectUI();syncPlanInputs();bindGlobal();render();renderHomeCore()});}
  window.RAFIQ_MEM={getData:()=>clone(data),plan:async()=>await buildPlanForDay(),startSession,grade:(id,g)=>grade(id,g),addPrior:(s,a,es,ea)=>addPrior({start:point(s,a),end:point(es||s,ea||a)}),markNew:(s,a,es,ea)=>recordExplicitNew({start:point(s,a),end:point(es||s,ea||a)}),setReviewMode,setWeeklyReviewConfig,addGoal,setPlanPreset:({amount=5,startSurah=1,startAyah=1,unit='ayahs'}={})=>{data.plan={...data.plan,enabled:true,mode:hasGoal()?'goal':'rate',unit:['ayahs','page','juz'].includes(unit)?unit:'ayahs',amount:Math.max(1,Number(amount)||1),startSurah:Math.max(1,Number(startSurah)||1),startAyah:Math.max(1,Number(startAyah)||1),cursor:null};save();render();renderHomeCore();},addDailyTask,removeDailyTask,getForecast:forecast};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
})();
