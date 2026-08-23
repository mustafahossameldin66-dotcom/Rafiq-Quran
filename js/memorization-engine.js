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
  const DEFAULT={version:5,plan:{unit:'ayahs',amount:1,startSurah:1,startAyah:1,startIndex:1,cursor:null,reviewMode:'spaced',goalRange:null},items:[],priorRanges:[],history:[],sessions:[],activeSession:null,unitCache:{}};
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
    d.plan={...d.plan,...(raw.plan||{}),unit:raw.plan?.unit||'ayahs',amount:Math.max(1,Number(raw.plan?.amount||1)),reviewMode:raw.plan?.reviewMode||'spaced',goalRange:raw.plan?.goalRange||null};
    d.items=Array.isArray(raw.items)?raw.items:[]; d.priorRanges=Array.isArray(raw.priorRanges)?raw.priorRanges:[];
    d.history=Array.isArray(raw.history)?raw.history:[]; d.sessions=Array.isArray(raw.sessions)?raw.sessions:[]; d.activeSession=raw.activeSession&&typeof raw.activeSession==='object'?raw.activeSession:null; d.plan.goalRange=raw.plan?.goalRange||null;
    d.unitCache=raw.unitCache&&typeof raw.unitCache==='object'?raw.unitCache:{};
    return d;
  }
  function migrateLegacy(raw){
    const d=clone(DEFAULT);
    if(raw.settings){d.plan.amount=Math.max(1,Number(raw.settings.newPerDay||1));d.plan.startSurah=Math.max(1,Number(raw.settings.startSurah||1));d.plan.startAyah=Math.max(1,Number(raw.settings.startAyah||1));d.plan.reviewMode=raw.settings.reviewMode==='weekly'?'weekly':'spaced';}
    d.items=Array.isArray(raw.items)?clone(raw.items):[]; d.priorRanges=Array.isArray(raw.priorRanges)?clone(raw.priorRanges):[];
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
  function unitLabel(unit,index,amount){const names={page:amount===1?'صفحة':'صفحات',quarter:amount===1?'ربع حزب':'أرباع حزب',juz:amount===1?'جزء':'أجزاء'};return`${names[unit]||unit} ${index}${amount>1?`–${index+amount-1}`:''}`}
  async function resolvePlanRange(){
    const p=data.plan;if(p.unit==='ayahs'){let st=point(p.startSurah,p.startAyah);if(p.cursor?.s)p=Object.assign({},p,{startSurah:p.cursor.s,startAyah:p.cursor.a});st=point(p.startSurah,p.startAyah);const all=[];let cur=st;while(cur&&all.length<p.amount){all.push(cur);cur=nextPoint(cur)}return all.length?{start:all[0],end:all[all.length-1]}:null}
    if(p.unit==='surah')return resolveUnit('surah',Number(p.startIndex||1),Number(p.amount||1));
    return resolveUnit(p.unit,Number(p.startIndex||1),Number(p.amount||1));
  }
  function advancePlanCursor(range){const p=data.plan;if(p.unit==='ayahs'){p.cursor=nextAfterRange(range);p.startSurah=p.cursor?.s||1;p.startAyah=p.cursor?.a||1}else{p.startIndex=Math.max(1,Number(p.startIndex||1)+Math.max(1,Number(p.amount||1)));}}

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
  function hasGoal(){return !!data.plan.goalRange}
  function goalLabel(){return data.plan.goalRange?rangeLabel(data.plan.goalRange):'لا يوجد هدف محدد'}
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

  function createNew(range,key=today()){
    if(data.items.some(i=>i.origin==='new'&&i.createdKey===key))return data.items.find(i=>i.origin==='new'&&i.createdKey===key);
    const item={id:makeId('new'),origin:'new',start:point(range.start.s,range.start.a),end:point(range.end.s,range.end.a),createdKey:key,phase:'stabilizing',stabilizationHistory:[],mode:data.plan.reviewMode,history:[],stability:3,difficulty:5,interval:1,lapses:0,snoozedUntil:null,dueKey:key};
    data.items.push(item);advancePlanCursor(item);save();return item;
  }
  function recordExplicitNew(range,key=today()){
    if(allItems().some(i=>overlap(i,range))){toast('هذا المقطع موجود بالفعل في سجل الحفظ.');return null}
    const item=createNew({...range},key);recordSessionEvent('memorized',item.id,{range:clone(item.start),end:clone(item.end)});toast(`تم تسجيل ${rangeLabel(item)} كمحفوظ.`);render();return item;
  }
  function addPrior(range){if(allItems().some(i=>overlap(i,range))){toast('هذا المقطع مسجل بالفعل.');return null} const item={id:makeId('prior'),origin:'prior',start:range.start,end:range.end,createdKey:today(),phase:'review',mode:data.plan.reviewMode,dueKey:today(),interval:7,stability:7,difficulty:5,history:[],lapses:0,snoozedUntil:null};data.priorRanges.push(item);save();toast(`تمت إضافة ${rangeLabel(item)} إلى المحفوظ السابق.`);render();return item}

  function noteStabilization(item,grade,key){
    if(grade==='relearn'){
      item.stabilizationHistory=[];item.lapses=(Number(item.lapses)||0)+1;item.snoozedUntil=null;item.history.push({key,grade,phase:'stabilizing'});recordSessionEvent('stabilization_failed',item.id);toast('لم يثبت بعد؛ سنعيد التثبيت من اليوم الأول.');return;
    }
    const done=new Set((item.stabilizationHistory||[]).map(x=>x.key));
    if(!done.has(key))item.stabilizationHistory.push({key,grade});
    item.snoozedUntil=null;item.history.push({key,grade,phase:'stabilizing'});recordSessionEvent('stabilization',item.id,{grade});
    if(new Set(item.stabilizationHistory.map(x=>x.key)).size>=7){
      item.phase='review';item.stability=7;item.interval=7;item.difficulty=grade==='easy'?4:grade==='hard'?6:5;item.mode=item.mode||data.plan.reviewMode;item.dueKey=addDays(key,7);
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

  async function buildPlanForDay(key=today()){
    const item=data.items.find(i=>i.origin==='new'&&i.createdKey===key);let newRange=item||null;
    if(!item)newRange=await resolvePlanRange();
    return{key,newRange,stabilizing:stabilizationDue(key),reviews:dueItems(key),tomorrowKey:addDays(key,1)};
  }
  async function futurePreview(days=7){
    const arr=[];for(let i=0;i<days;i++){const key=addDays(today(),i);const p=await buildPlanForDay(key);arr.push({key,newRange:i===0?p.newRange:null,stabilizing:p.stabilizing,reviews:p.reviews})}return arr;
  }

  function closeModal(m){m?.remove();}
  function openRangePicker({title='تحديد المقطع',mode='new',onDone}={}){
    closeModal(pickerModal);
    pickerModal=document.createElement('div');pickerModal.className='mem-modal';
    pickerModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-picker-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">${mode==='prior'?'المحفوظ السابق':'الحفظ الجديد'}</div><h3>${esc(title)}</h3><p class="mem-help">حدد بالضبط ما حفظته أو ما تريد أن يكون هدفك. لا تحتاج إلى حساب عدد الآيات بنفسك.</p><div class="picker-tabs" role="tablist"><button type="button" data-unit="surah">سورة كاملة</button><button type="button" data-unit="ayahs">من آية إلى آية</button><button type="button" data-unit="page">من صفحة إلى صفحة</button><button type="button" data-unit="quarter">من ربع إلى ربع</button><button type="button" data-unit="juz">من جزء إلى جزء</button></div><div id="pickerFields"></div><div class="mem-picker-note" id="pickerNote"></div><div class="mem-quick-actions"><button class="btn" type="button" data-cancel>إلغاء</button><button class="btn primary" type="button" data-confirm>تأكيد المقطع</button></div></div>`;
    document.body.appendChild(pickerModal);
    const fields=pickerModal.querySelector('#pickerFields'),note=pickerModal.querySelector('#pickerNote'); let unit=mode==='prior'?'surah':'ayahs';
    function surahOptions(){return quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('')}
    function renderFields(){
      const commonStart=mode==='prior'||mode==='goal'?`<label>من سورة<select id="pickStartSurah">${surahOptions()}</select></label><label>من آية<input id="pickStartAyah" type="number" min="1" value="1"></label><label>إلى سورة<select id="pickEndSurah">${surahOptions()}</select></label><label>إلى آية<input id="pickEndAyah" type="number" min="1" value="1"></label>`:`<label>تبدأ من سورة<select id="pickStartSurah">${surahOptions()}</select></label><label>من آية<input id="pickStartAyah" type="number" min="1" value="1"></label>`;
      if(unit==='surah')fields.innerHTML=`<div class="mem-form-grid"><label>السورة<select id="pickSurah">${surahOptions()}</select></label></div>`;
      else if(unit==='ayahs')fields.innerHTML=`<div class="mem-form-grid">${commonStart}${mode==='prior'||mode==='goal'?'':'<label>عدد الآيات<input id="pickAmount" type="number" min="1" value="10"></label>'}</div>`;
      else if(unit==='page')fields.innerHTML=`<div class="mem-form-grid"><label>من صفحة<input id="pickIndex" type="number" min="1" max="604" value="1"></label><label>إلى صفحة<input id="pickEndIndex" type="number" min="1" max="604" value="1"></label></div>`;
      else if(unit==='quarter')fields.innerHTML=`<div class="mem-form-grid"><label>من ربع<input id="pickIndex" type="number" min="1" max="240" value="1"></label><label>إلى ربع<input id="pickEndIndex" type="number" min="1" max="240" value="1"></label></div>`;
      else fields.innerHTML=`<div class="mem-form-grid"><label>من جزء<input id="pickIndex" type="number" min="1" max="30" value="1"></label><label>إلى جزء<input id="pickEndIndex" type="number" min="1" max="30" value="1"></label></div>`;
      pickerModal.querySelectorAll('.picker-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.unit===unit));
      pickerModal.querySelectorAll('select').forEach(sel=>sel.addEventListener('change',()=>{if(sel.id==='pickStartSurah'){const a=$('#pickStartAyah');if(a)a.max=String(count(+sel.value));}}));
      note.textContent='';
    }
    pickerModal.querySelectorAll('.picker-tabs button').forEach(b=>b.onclick=()=>{unit=b.dataset.unit;renderFields()});
    pickerModal.querySelector('[data-cancel]').onclick=()=>closeModal(pickerModal);
    pickerModal.querySelector('.mem-modal-close').onclick=()=>closeModal(pickerModal);
    pickerModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(pickerModal);
    pickerModal.querySelector('[data-confirm]').onclick=async()=>{
      try{
        let range=null;
        if(unit==='surah'){const ss=Number($('#pickSurah')?.value||1);range={start:{s:ss,a:1},end:{s:ss,a:count(ss)},label:`${surah(ss).name} · سورة كاملة`}}
        else if(unit==='ayahs'){const ss=Number($('#pickStartSurah')?.value||1),aa=Number($('#pickStartAyah')?.value||1);if(mode==='prior'||mode==='goal'){const es=Number($('#pickEndSurah')?.value||ss),ea=Number($('#pickEndAyah')?.value||aa);const st=point(ss,aa),en=point(es,ea);if(cmp(st,en)>0){note.textContent='راجع ترتيب البداية والنهاية.';return}range={start:st,end:en}}else{const amt=Math.max(1,Number($('#pickAmount')?.value||1));let cur=point(ss,aa);const all=[];while(cur&&all.length<amt){all.push(cur);cur=nextPoint(cur)}range=all.length?{start:all[0],end:all[all.length-1]}:null}}
        else{const idx=Number($('#pickIndex')?.value||1),end=Number($('#pickEndIndex')?.value||idx);if(end<idx){note.textContent='البداية يجب أن تسبق النهاية.';return}note.textContent='جارٍ تحديد المقطع…';const r1=await resolveUnit(unit,idx,1),r2=await resolveUnit(unit,end,1);if(!r1||!r2){note.textContent='هذا التقسيم غير متاح الآن محليًا.';return}range={start:r1.start,end:r2.end,label:`${unitLabel(unit,idx,1)} → ${unitLabel(unit,end,1)}`}}
        closeModal(pickerModal);onDone?.(range,{unit,index:unit==='surah'?Number($('#pickSurah')?.value||1):Number($('#pickIndex')?.value||1),amount:1});
      }catch{note.textContent='تعذر تحديد المقطع. جرّب مرة أخرى.'}
    };
    renderFields();
  }

  async function startSession(){
    const p=await buildPlanForDay();
    const ordered=[
      ...p.reviews.map(i=>({kind:'review',item:i})),
      ...p.stabilizing.map(i=>({kind:'stabilize',item:i})),
      ...(p.newRange?[{kind:'new',item:p.newRange}]:[])
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
      sessionModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>أنجزت مهام اليوم ✓</h3><p class="mem-help">${resume?'تم حفظ تقدم جلستك.':''} لا توجد مهام أخرى مستحقة الآن.</p><div class="mem-quick-actions"><button class="btn" data-close>إغلاق</button></div></div>`;
      document.body.appendChild(sessionModal);sessionModal.querySelector('[data-close]').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-close').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(sessionModal);return;
    }
    sessionModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-session-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>مهمتك اليوم</h3><p class="mem-help">المراجعة أولًا، ثم التثبيت، ثم الحفظ الجديد. لا يوجد مؤقت؛ توقف عندما تتقن ما عليك.</p><div class="mem-session-task-list">${tasks.map((t,i)=>{const id=String(t.item.id||`${t.kind}:${rangeLabel(t.item)}`);return `<article class="mem-session-task" data-task="${esc(id)}"><b>${i+1}</b><div><strong>${t.kind==='new'?'حفظ جديد':t.kind==='stabilize'?'تثبيت':'مراجعة مستحقة'}</strong><span>${esc(rangeLabel(t.item))}</span><small>${t.kind==='new'?'احفظه بهدوء ثم سجّل أنك أتقنته':t.kind==='stabilize'?`جلسة تثبيت ${((t.item.stabilizationHistory||[]).length)+1} من 7`:`${formatNext(t.item)}`}</small></div><div class="mem-task-buttons">${t.kind==='new'?'<button type="button" data-action="record">سجل أنني أتقنته</button>':'<button type="button" data-action="recite">سمّع</button><button type="button" data-action="study">دراسة المقطع</button><button type="button" data-action="play">استماع</button><button type="button" data-action="snooze">غدًا</button>'}</div></article>`}).join('')}</div><div class="mem-session-footer">يمكنك الخروج والعودة لاحقًا؛ التقدم سيبقى محفوظًا.</div></div>`;
    document.body.appendChild(sessionModal);
    sessionModal.querySelector('.mem-modal-close').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(sessionModal);
    sessionModal.querySelectorAll('.mem-session-task').forEach(row=>row.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=async()=>{
      const task=tasks.find(t=>String(t.item.id||`${t.kind}:${rangeLabel(t.item)}`)===row.dataset.task);if(!task)return;const action=btn.dataset.action;
      if(action==='record'){const created=recordExplicitNew(task.item);if(created){active.done.push(String(created.id));save();row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ تم</span>';render();}}
      else if(action==='recite')openRecitation(task.item,task.kind,active,row);
      else if(action==='study'){window.openAyahStudy?.(task.item.start.s,task.item.start.a)}
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
    modal.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const result=grade(item.id,b.dataset.grade);if(result){if(activeSession){activeSession.done=activeSession.done||[];if(!activeSession.done.includes(String(item.id)))activeSession.done.push(String(item.id));save();}modal.querySelector('#reciteNextPreview').textContent=`المراجعة القادمة: ${result.next}`;setTimeout(()=>{close();if(row)row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ تم</span>';render();},900)}});
  }

  function setInput(id,v){const e=$(id);if(e)e.value=String(v??'')}
  function populateSurahs(select){if(!select||!quran.length)return;select.innerHTML=quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('')}
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
  function addGoal(range){data.plan.goalRange=range?{start:range.start,end:range.end}:null;save();render();toast(range?`الهدف: ${rangeLabel(range)}`:'تم إلغاء الهدف.');}

  async function savePlan(){
    const unit=$('#planUnit')?.value||'ayahs',amount=Math.max(1,Number($('#planAmount')?.value||1));
    if(unit==='ayahs'){
      data.plan={...data.plan,unit,amount,startSurah:Number($('#planStartSurah')?.value||1),startAyah:Number($('#planStartAyah')?.value||1),cursor:null};
    }else if(unit==='surah'){
      data.plan={...data.plan,unit,amount,startIndex:Number($('#planStartIndex')?.value||1)};
    }else{
      data.plan={...data.plan,unit,amount,startIndex:Number($('#planStartIndex')?.value||1)};
    }
    setReviewMode($('#planReviewMode')?.value||data.plan.reviewMode);const r=await resolvePlanRange(); if(r)toast(`تم حفظ الخطة: ${unitLabel(unit,Number($('#planStartIndex')?.value||1),amount)||rangeLabel(r)}.`); else if(unit!=='ayahs')toast('تم حفظ الخطة. سيحتاج اختيار هذا المقدار اتصالًا مرة واحدة حتى نحدد مقطعه بدقة.'); render();
  }
  function renderPlanInputs(){
    const p=data.plan,unitSelect=$('#planUnit');if(!unitSelect)return;unitSelect.value=p.unit||'ayahs';setInput('#planAmount',p.amount||10);populateSurahs($('#planStartSurah'));setInput('#planStartSurah',p.startSurah||1);setInput('#planStartAyah',p.startAyah||1);setInput('#planStartIndex',p.startIndex||1);const ayahFieldsEl=$('#planAyahFields');if(ayahFieldsEl)ayahFieldsEl.hidden=p.unit!=='ayahs';const indexFieldsEl=$('#planIndexFields');if(indexFieldsEl)indexFieldsEl.hidden=p.unit==='ayahs';
    const name=$('#planStartUnitText');if(name){const labels={surah:'أول سورة',page:'أول صفحة',quarter:'أول ربع',juz:'أول جزء'};name.textContent=labels[p.unit]||'البداية'}
    const idx=$('#planStartIndex');if(idx){idx.max=String(p.unit==='page'?604:p.unit==='quarter'?240:p.unit==='juz'?30:114);idx.min='1'}
  }
  function render(){
    const host=$('#memCoreHost');if(!host)return;
    renderPlanInputs();
    buildPlanForDay().then(p=>{
      const todayNew=p.newRange?rangeLabel(p.newRange):'—';
      const tomorrowText=data.plan.unit==='ayahs'?`غدًا: نفس المقدار من الموضع التالي`:`غدًا: مقدار ${unitLabel(data.plan.unit,Number(data.plan.startIndex||1)+Number(data.plan.amount||1),Number(data.plan.amount||1))}`;
      setText('#memNewToday',todayNew);setText('#memNewDesc',p.newRange?'سجّله بعد الإتقان':'حدّد مقدارك أو اتصل مرة واحدة لتحديده');setText('#memStabilizeToday',p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+rangeCount(x),0)} آية`:'لا يوجد');setText('#memReviewToday',p.reviews.length?`${p.reviews.reduce((n,x)=>n+rangeCount(x),0)} آية`:'لا يوجد');const overdue=p.reviews.filter(i=>diffDays(i.dueKey,today())<0).length;setText('#memBacklog',overdue?`${overdue} متأخر`:'لا يوجد');setText('#memTomorrow',tomorrowText);
      setText('#memPlanSummary',planSummary());setText('#memReturnNote',isPlanPaused()?'مرحبًا بعودتك. رفيق القرآن سيعيد توزيع ما فاتك بدل كسر خطتك.':'');
      const counts=allItems().reduce((acc,i)=>{acc.total+=rangeCount(i);if(i.phase==='stabilizing')acc.active++;if(i.phase==='review'&&i.dueKey&&diffDays(i.dueKey,today())>=0)acc.due++;return acc},{total:0,active:0,due:0});
      setText('#memSavedCount',`${counts.total.toLocaleString('ar-EG')} آية`);setText('#memActiveCount',`${counts.active} مقاطع تحت التثبيت`);setText('#memDueCount',`${counts.due} مقاطع مستحقة`);setText('#memWeakCount',`${activeWeak().length} مقاطع تحتاج دعمًا`);
      renderWeek();renderUpcoming();renderWeak();renderSaved();renderGaps();renderHistory();
    });
  }
  function setText(id,v){const e=$(id);if(e)e.textContent=v}
  function planSummary(){const p=data.plan;const names={ayahs:'آيات',surah:'سور',page:'صفحات',quarter:'أرباع',juz:'أجزاء'};return`${p.amount} ${names[p.unit]||'وحدة'} يوميًا · ${p.reviewMode==='weekly'?'مراجعة كل 7 أيام':'تكرار متباعد ذكي'}`}
  async function renderWeek(){const box=$('#memWeekGrid');if(!box)return;const arr=[];for(let i=0;i<7;i++){const k=addDays(today(),i),p=await buildPlanForDay(k);arr.push(`<article class="mem-week-card ${i===0?'today':''}"><header><b>${i===0?'اليوم':i===1?'غدًا':new Intl.DateTimeFormat('ar-EG',{weekday:'short'}).format(keyDate(k))}</b><span>${humanDate(k)}</span></header><div><small>حفظ جديد</small><strong>${p.newRange?esc(rangeLabel(p.newRange)):'—'}</strong></div><div><small>تثبيت</small><strong>${p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+rangeCount(x),0)} آية`:'—'}</strong></div><div><small>مراجعة</small><strong>${p.reviews.length?`${p.reviews.reduce((n,x)=>n+rangeCount(x),0)} آية`:'—'}</strong></div></article>`)}box.innerHTML=arr.join('')}
  function renderUpcoming(){const box=$('#memUpcomingList');if(!box)return;const rows=allItems().filter(i=>i.phase==='stabilizing'||i.phase==='review').sort((a,b)=>String((a.dueKey||'')).localeCompare(String(b.dueKey||''))).slice(0,8);box.innerHTML=rows.length?rows.map(i=>`<article><b>${esc(rangeLabel(i))}</b><span>${i.phase==='stabilizing'?`تثبيت ${(new Set((i.stabilizationHistory||[]).map(x=>x.key))).size}/7 · باقي ${Math.max(0,7-(new Set((i.stabilizationHistory||[]).map(x=>x.key))).size)} جلسات`:formatNext(i)}</span></article>`).join(''):`<div class="mem-empty">لا توجد مواعيد مؤجلة حاليًا.</div>`}
  function renderWeak(){const box=$('#memWeakList');if(!box)return;const rows=activeWeak();box.innerHTML=rows.length?rows.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${Number(i.lapses||0)} مرات إعادة تثبيت · صعوبة ${Math.round(Number(i.difficulty||5))/10}</small></div><button class="btn" data-weak="${i.id}">سمّع الآن</button></article>`).join(''):`<div class="mem-empty">لا توجد نقاط ضعف مسجلة حتى الآن.</div>`;box.querySelectorAll('[data-weak]').forEach(b=>b.onclick=()=>{const i=allItems().find(x=>x.id===b.dataset.weak);if(i)openRecitation(i,'review')})}
  function renderSaved(){const box=$('#memSavedList');if(!box)return;const rows=[...data.items,...data.priorRanges].sort((a,b)=>String(b.createdKey||'').localeCompare(String(a.createdKey||''))).slice(0,8);box.innerHTML=rows.length?rows.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${i.phase==='stabilizing'?`تثبيت · ${new Set((i.stabilizationHistory||[]).map(x=>x.key)).size}/7`:`موعد المراجعة: ${formatNext(i)}`}</small></div></article>`).join(''):`<div class="mem-empty">لم تضف محفوظًا بعد.</div>`}
  function renderGaps(){const box=$('#memGapsList');if(!box)return;const gaps=[];for(let s=1;s<=114&&gaps.length<10;s++){const ranges=allItems().filter(i=>i.start?.s<=s&&i.end?.s>=s).map(i=>({a:i.start.s===s?i.start.a:1,b:i.end.s===s?i.end.a:count(s)})).sort((a,b)=>a.a-b.a);if(!ranges.length)continue;let end=0;for(const r of ranges){if(r.a>end+1)gaps.push({s,a:end+1,b:r.a-1});end=Math.max(end,r.b)}if(end<count(s))gaps.push({s,a:end+1,b:count(s)})}box.innerHTML=gaps.length?gaps.slice(0,8).map(g=>`<article class="mem-range-row"><div><strong>${esc(surah(g.s)?.name||'')}</strong><small>الآيات ${g.a}–${g.b} غير مضافة إلى المحفوظ</small></div><button class="btn" data-gap="${g.s}:${g.a}:${g.b}">إضافة للحفظ</button></article>`).join(''):`<div class="mem-empty">لا توجد فجوات بين المقاطع التي سجلتها.</div>`;box.querySelectorAll('[data-gap]').forEach(b=>b.onclick=()=>{const [ss,aa,bb]=b.dataset.gap.split(':').map(Number);addPrior({start:point(ss,aa),end:point(ss,bb)})})}
  function renderHistory(){const box=$('#memHistoryList');if(!box)return;const rows=data.history.slice(-12).reverse();box.innerHTML=rows.length?rows.map(h=>`<article class="mem-upcoming-list article"><b>${h.type==='memorized'?'حفظ':h.type==='review'?'مراجعة':h.type==='stabilization'?'تثبيت':h.type==='stabilization_failed'?'تعثر':'نشاط'}</b><span>${humanDate(h.key)} · ${h.grade||''}</span></article>`).join(''):`<div class="mem-empty">سيظهر هنا سجل رحلتك أولًا بأول.</div>`}


  function injectUI(){
    const view=$('#view-plan'); if(!view||$('#memCoreRoot'))return;
    const root=document.createElement('section');root.id='memCoreRoot';root.className='mem-core-root';
    root.innerHTML=`<div class="mem-core-head"><div><span class="mem-kicker">الحفظ والمراجعة</span><h2>مهمتك اليوم واضحة</h2><p>الحفظ ثم التثبيت ثم المراجعة. لا يوجد مؤقت؛ أنجز ما تستطيع حتى تتقنه.</p><span class="mem-return-note" id="memReturnNote"></span></div><div class="mem-core-actions"><button class="btn primary" id="memStartSession" type="button">ابدأ جلسة اليوم</button></div></div>
      <div class="mem-today-grid"><article class="mem-today-card new"><small>حفظ جديد</small><strong id="memNewToday">—</strong><span id="memNewDesc">—</span></article><article class="mem-today-card"><small>تثبيت</small><strong id="memStabilizeToday">—</strong><span>جلسات التثبيت المتبقية</span></article><article class="mem-today-card review"><small>مراجعة مستحقة</small><strong id="memReviewToday">—</strong><span id="memTomorrow">—</span></article></div>
      <section class="mem-panel mem-plan-main"><div class="mem-panel-head"><div><h3>خطتك</h3><p id="memPlanSummary">—</p></div><button class="btn" id="coreSavePlan" type="button">حفظ</button></div><div class="simple-plan-grid"><label>مقدار الحفظ اليومي<select id="planUnit"><option value="ayahs">آيات</option><option value="page">صفحات</option><option value="quarter">أرباع</option><option value="juz">أجزاء</option><option value="surah">سور</option></select></label><label>العدد<input id="planAmount" type="number" min="1" value="1"></label><div id="planAyahFields" class="plan-fields"><label>تبدأ من سورة<select id="planStartSurah"></select></label><label>من آية<input id="planStartAyah" type="number" min="1" value="1"></label></div><div id="planIndexFields" class="plan-fields" hidden><label id="planStartUnitLabel">بداية المقطع<input id="planStartIndex" type="number" min="1" value="1"></label><small class="plan-unit-note">الصفحة والربع والجزء تُحوَّل تلقائيًا إلى مقطع من المصحف.</small></div></div><div class="mem-plan-main-actions"><button class="btn" id="planSelectUnit" type="button">اختيار المقطع من المصحف</button><button class="btn" id="memSetGoal" type="button">تحديد هدف اختياري</button></div><details class="mem-collapse advanced-plan"><summary>خيارات متقدمة</summary><div class="mem-collapse-body"><label class="plan-review-label">نظام المراجعة<select id="planReviewMode"><option value="spaced">مراجعة ذكية تلقائية</option><option value="weekly">مراجعة كل 7 أيام</option></select></label><p class="mem-plan-help">المراجعة الذكية هي نظام متباعد شبيه بـFSRS ويحدد الموعد القادم من أدائك. لا تحتاج لمعرفة أي تفاصيل تقنية.</p></div></details></section>
      <section class="mem-grid-2"><section class="mem-panel"><div class="mem-panel-head"><div><h3>حفظت شيئًا خارج الخطة؟</h3><p>سجّل المقطع الذي أتقنته فعلًا.</p></div></div><button class="btn primary" id="memRecordNew" type="button">تحديد ما حفظته</button></section><section class="mem-panel"><div class="mem-panel-head"><div><h3>محفوظ سابق</h3><p>أضف ما كنت حافظًا له قبل استخدام رفيق القرآن.</p></div></div><button class="btn primary" id="memAddPrior" type="button">إضافة محفوظ سابق</button></section></section>
      <section class="mem-panel"><div class="mem-panel-head"><div><h3>ملخصك</h3><p>أرقام قليلة تكفي لمعرفة حالتك.</p></div></div><div class="mem-stat-row"><div><small>المحفوظ</small><b id="memSavedCount">0 آية</b></div><div><small>قيد التثبيت</small><b id="memActiveCount">0 مقاطع</b></div><div><small>مستحق اليوم</small><b id="memDueCount">0 مقاطع</b></div><div><small>يحتاج تثبيتًا</small><b id="memWeakCount">0 مقاطع</b></div></div></section>
      <details class="mem-collapse"><summary>هذا الأسبوع</summary><div class="mem-collapse-body"><div class="mem-week-grid" id="memWeekGrid"></div></div></details>
      <details class="mem-collapse"><summary>المواعيد القادمة</summary><div class="mem-collapse-body"><div class="mem-upcoming-list" id="memUpcomingList"></div></div></details>
      <details class="mem-collapse"><summary>تحتاج تثبيتًا</summary><div class="mem-collapse-body"><div class="mem-range-list" id="memWeakList"></div></div></details>
      <details class="mem-collapse"><summary>فجوات في المحفوظ</summary><div class="mem-collapse-body"><div class="mem-range-list" id="memGapsList"></div></div></details>
      <details class="mem-collapse"><summary>سجل الحفظ والمراجعة</summary><div class="mem-collapse-body"><div class="mem-range-list" id="memHistoryList"></div></div></details>`
    $('#memCoreHost')?.appendChild(root);
    $('#planUnit')?.addEventListener('change',()=>{const u=$('#planUnit').value;$('#planAyahFields').hidden=u!=='ayahs';$('#planIndexFields').hidden=u==='ayahs';const text=$('#planStartUnitText');if(text)text.textContent=u==='surah'?'أول سورة':u==='page'?'أول صفحة':u==='quarter'?'أول ربع':'أول جزء';const idx=$('#planStartIndex');if(idx)idx.max=String(u==='page'?604:u==='quarter'?240:u==='juz'?30:114)});
    $('#planReviewMode')?.addEventListener('change',()=>setReviewMode($('#planReviewMode').value));
    $('#memSetGoal')?.addEventListener('click',()=>openRangePicker({title:'تحديد هدف الحفظ',mode:'goal',onDone:r=>addGoal(r)}));
    $('#memStartSession')?.addEventListener('click',startSession);
    $('#coreSavePlan')?.addEventListener('click',savePlan);
    $('#planSelectUnit')?.addEventListener('click',()=>openRangePicker({title:'اختيار مقدار الحفظ',mode:'new',onDone:(r,m)=>{if(!r)return;data.plan.unit=m.unit;data.plan.amount=m.amount;if(m.unit==='ayahs'){data.plan.startSurah=r.start.s;data.plan.startAyah=r.start.a;data.plan.cursor=null}else if(m.unit==='surah'||m.unit==='page'||m.unit==='quarter'||m.unit==='juz'){data.plan.startIndex=m.index}save();syncPlanInputs();render();toast(`تم اعتماد ${rangeLabel(r)} كمقدار الخطة.`)}}));
    $('#memRecordNew')?.addEventListener('click',()=>openRangePicker({title:'ماذا حفظت اليوم؟',mode:'new',onDone:r=>{if(r)recordExplicitNew(r);}}));
    $('#memAddPrior')?.addEventListener('click',()=>openRangePicker({title:'إضافة محفوظ سابق',mode:'prior',onDone:r=>{if(r)addPrior(r);}}));
  }

  function syncPlanInputs(){
    const p=data.plan;populateSurahs($('#planStartSurah'));setInput('#planUnit',p.unit||'ayahs');setInput('#planAmount',p.amount||10);setInput('#planStartSurah',p.startSurah||1);setInput('#planStartAyah',p.startAyah||1);setInput('#planStartIndex',p.startIndex||1);setInput('#planReviewMode',p.reviewMode||'spaced');
    const u=p.unit||'ayahs';if($('#planAyahFields'))$('#planAyahFields').hidden=u!=='ayahs';if($('#planIndexFields'))$('#planIndexFields').hidden=u==='ayahs';
  }

  function renderHomeCore(){const host=$('#todayList');if(!host)return;buildPlanForDay().then(p=>{host.innerHTML=`<article class="today-row core-today-row"><b>حفظ اليوم</b><span>${p.newRange?esc(rangeLabel(p.newRange)):'—'}</span><em>حتى تتقنه</em></article><article class="today-row core-today-row"><b>التثبيت</b><span>${p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+rangeCount(x),0)} آية`:'لا يوجد'}</span><em>7 جلسات ناجحة</em></article><article class="today-row core-today-row"><b>المراجعة</b><span>${p.reviews.length?`${p.reviews.reduce((n,x)=>n+rangeCount(x),0)} آية`:'لا يوجد'}</span><em>${p.reviews.length?'مستحقة الآن':'ممتاز، لا يوجد متأخر'}</em></article><article class="today-row core-today-row"><b>جلسة اليوم</b><span>لا يوجد مؤقت</span><button class="inline-cta" id="homeMemSessionBtn" type="button">ابدأ الآن</button></article>`;$('#homeMemSessionBtn')?.addEventListener('click',startSession)})}

  function bindGlobal(){document.addEventListener('rafiq-memorization-change',()=>{render();renderHomeCore()});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){data=load();render();renderHomeCore()}})}
  function onReady(){if(ready)return;ready=true;loadQuran().then(()=>{injectUI();syncPlanInputs();bindGlobal();render();renderHomeCore()});}
  window.RAFIQ_MEM={getData:()=>clone(data),plan:async()=>await buildPlanForDay(),startSession,grade:(id,g)=>grade(id,g),addPrior:(s,a,es,ea)=>addPrior({start:point(s,a),end:point(es||s,ea||a)}),markNew:(s,a,es,ea)=>recordExplicitNew({start:point(s,a),end:point(es||s,ea||a)}),setReviewMode,addGoal,setPlanPreset:({amount=5,startSurah=1,startAyah=1,unit='ayahs'}={})=>{data.plan={...data.plan,unit,amount:Math.max(1,Number(amount)||1),startSurah:Math.max(1,Number(startSurah)||1),startAyah:Math.max(1,Number(startAyah)||1),cursor:null};save();render();renderHomeCore();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
})();
