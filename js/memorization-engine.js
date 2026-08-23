/* Rafiq Quran — Memorization Core v3
 * A simple user-facing plan on top of one local memorization/review engine.
 * Review modes: weekly (7-day cycle) or FSRS-like spaced repetition.
 */
(() => {
  'use strict';
  const STORAGE_KEY='rafiq-memorization-core-v3';
  const LEGACY_KEYS=['rafiq-memorization-core-v2','rafiq-memorization-core-v1','rafiq-state-v85'];
  const $=s=>document.querySelector(s);
  const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
  const toast=m=>window.rafiqToast?.(m);
  const DEFAULT={version:3,plan:{unit:'ayahs',amount:10,startSurah:1,startAyah:1,startIndex:1,cursor:null,reviewMode:'spaced'},items:[],priorRanges:[],history:[],sessions:[],unitCache:{}};
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
    d.plan={...d.plan,...(raw.plan||{}),unit:raw.plan?.unit||'ayahs',amount:Math.max(1,Number(raw.plan?.amount||10)),reviewMode:raw.plan?.reviewMode||'spaced'};
    d.items=Array.isArray(raw.items)?raw.items:[]; d.priorRanges=Array.isArray(raw.priorRanges)?raw.priorRanges:[];
    d.history=Array.isArray(raw.history)?raw.history:[]; d.sessions=Array.isArray(raw.sessions)?raw.sessions:[];
    d.unitCache=raw.unitCache&&typeof raw.unitCache==='object'?raw.unitCache:{};
    return d;
  }
  function migrateLegacy(raw){
    const d=clone(DEFAULT);
    if(raw.settings){d.plan.amount=Math.max(1,Number(raw.settings.newPerDay||10));d.plan.startSurah=Math.max(1,Number(raw.settings.startSurah||1));d.plan.startAyah=Math.max(1,Number(raw.settings.startAyah||1));d.plan.reviewMode=raw.settings.reviewMode==='weekly'?'weekly':'spaced';}
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
  function dueItems(k=today()){return allItems().filter(i=>i.phase==='review'&&(!i.dueKey||diffDays(i.dueKey,k)>=0))}
  function stabilizationDue(k=today()){return data.items.filter(i=>i.phase==='stabilizing'&&!(i.stabilizationHistory||[]).some(x=>x.key===k)&&(!i.snoozedUntil||i.snoozedUntil<=k))}
  function nextDue(item){return item.dueKey||today()}
  function formatNext(item){const d=nextDue(item);const n=diffDays(today(),d);return n<=0?'مستحق اليوم':n===1?'غدًا':`بعد ${n} يوم · ${humanDate(d)}`}
  function activeWeak(){return allItems().filter(i=>(Number(i.lapses)||0)>0||Number(i.difficulty||5)>=7).sort((a,b)=>(Number(b.lapses)||0)-(Number(a.lapses)||0)).slice(0,8)}

  function createNew(range,key=today()){
    if(data.items.some(i=>i.origin==='new'&&i.createdKey===key))return data.items.find(i=>i.origin==='new'&&i.createdKey===key);
    const item={id:makeId('new'),origin:'new',start:point(range.start.s,range.start.a),end:point(range.end.s,range.end.a),createdKey:key,phase:'stabilizing',stabilizationHistory:[],mode:data.plan.reviewMode,history:[],stability:3,difficulty:5,interval:1,lapses:0,snoozedUntil:null,dueKey:key};
    data.items.push(item);advancePlanCursor(item);save();return item;
  }
  function recordExplicitNew(range,key=today()){
    if(allItems().some(i=>overlap(i,range))){toast('هذا المقطع موجود بالفعل في سجل الحفظ.');return null}
    const item=createNew({...range},key);toast(`تم تسجيل ${rangeLabel(item)} كمحفوظ.`);render();return item;
  }
  function addPrior(range){if(allItems().some(i=>overlap(i,range))){toast('هذا المقطع مسجل بالفعل.');return null} const item={id:makeId('prior'),origin:'prior',start:range.start,end:range.end,createdKey:today(),phase:'review',mode:data.plan.reviewMode,dueKey:today(),interval:7,stability:7,difficulty:5,history:[],lapses:0,snoozedUntil:null};data.priorRanges.push(item);save();toast(`تمت إضافة ${rangeLabel(item)} إلى المحفوظ السابق.`);render();return item}

  function noteStabilization(item,grade,key){
    if(grade==='relearn'){
      item.stabilizationHistory=[];item.lapses=(Number(item.lapses)||0)+1;item.snoozedUntil=null;item.history.push({key,grade,phase:'stabilizing'});toast('نرجع التثبيت من اليوم الأول لأن الاسترجاع لم يثبت بعد.');return;
    }
    const done=new Set((item.stabilizationHistory||[]).map(x=>x.key)); if(!done.has(key))item.stabilizationHistory.push({key,grade});
    item.snoozedUntil=null;item.history.push({key,grade,phase:'stabilizing'});
    if(new Set(item.stabilizationHistory.map(x=>x.key)).size>=7){item.phase='review';item.stability=7;item.interval=7;item.difficulty=grade==='easy'?4:grade==='hard'?6:5;item.dueKey=addDays(key,data.plan.reviewMode==='weekly'?7:7);toast(`تم تثبيت ${rangeLabel(item)} لمدة 7 أيام وانتقل إلى المراجعة.`)}
  }
  function scheduleSpaced(item,grade,key){
    const prevDue=item.dueKey||key,elapsed=Math.max(0,diffDays(prevDue,key)),stability=Math.max(1,Number(item.stability||7));
    const retrievability=Math.exp(Math.log(.9)*elapsed/stability);
    const d0=Math.max(1,Math.min(10,Number(item.difficulty||5)));
    const delta={relearn:1.1,hard:.45,good:-.15,easy:-.5}[grade];
    item.difficulty=Math.max(1,Math.min(10,d0+delta));
    let nextStability;
    if(grade==='relearn'){item.lapses=(Number(item.lapses)||0)+1;nextStability=1}
    else if(grade==='hard')nextStability=Math.max(2,stability*.72*Math.max(.75,retrievability));
    else if(grade==='good')nextStability=Math.max(3,stability*(1.35+(10-item.difficulty)*.04)*Math.max(.9,retrievability));
    else nextStability=Math.max(5,stability*(1.9+(10-item.difficulty)*.06)*Math.max(.95,retrievability));
    item.stability=Math.round(nextStability*10)/10;
    item.interval=grade==='relearn'?1:Math.max(1,Math.round(item.stability));
    item.dueKey=addDays(key,item.interval);
  }
  function grade(itemId,grade,key=today()){
    const item=allItems().find(i=>i.id===itemId);if(!item)return null;grade=['relearn','hard','good','easy'].includes(grade)?grade:'good';
    item.history=item.history||[];item.snoozedUntil=null;
    if(item.phase==='stabilizing')noteStabilization(item,grade,key);else{item.history.push({key,grade,phase:'review'});if(data.plan.reviewMode==='weekly'){item.interval=grade==='relearn'?1:7;item.dueKey=addDays(key,item.interval);if(grade==='relearn')item.lapses=(Number(item.lapses)||0)+1}else scheduleSpaced(item,grade,key)}
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
    pickerModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-picker-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">${mode==='prior'?'المحفوظ السابق':'الحفظ الجديد'}</div><h3>${esc(title)}</h3><p class="mem-help">اختار المقطع بالطريقة الأسهل لك. يمكنك اختيار سورة كاملة أو صفحات أو أرباع أو جزء أو عدد آيات.</p><div class="picker-tabs" role="tablist"><button type="button" data-unit="surah">سورة</button><button type="button" data-unit="ayahs">آيات</button><button type="button" data-unit="page">صفحات</button><button type="button" data-unit="quarter">أرباع</button><button type="button" data-unit="juz">أجزاء</button></div><div id="pickerFields"></div><div class="mem-picker-note" id="pickerNote"></div><div class="mem-quick-actions"><button class="btn" type="button" data-cancel>إلغاء</button><button class="btn primary" type="button" data-confirm>تأكيد المقطع</button></div></div>`;
    document.body.appendChild(pickerModal);
    const fields=pickerModal.querySelector('#pickerFields'),note=pickerModal.querySelector('#pickerNote'); let unit=mode==='prior'?'ayahs':'ayahs';
    function surahOptions(){return quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('')}
    function renderFields(){
      const commonStart=`<label>تبدأ من<select id="pickStartSurah">${surahOptions()}</select></label><label>آية البداية<input id="pickStartAyah" type="number" min="1" value="1"></label>`;
      if(unit==='surah')fields.innerHTML=`<div class="mem-form-grid"><label>السورة<select id="pickSurah">${surahOptions()}</select></label></div>`;
      else if(unit==='ayahs')fields.innerHTML=`<div class="mem-form-grid">${commonStart}<label>عدد الآيات<input id="pickAmount" type="number" min="1" value="10"></label></div>`;
      else if(unit==='page')fields.innerHTML=`<div class="mem-form-grid"><label>أول صفحة<input id="pickIndex" type="number" min="1" max="604" value="1"></label><label>عدد الصفحات<input id="pickAmount" type="number" min="1" max="604" value="1"></label></div>`;
      else if(unit==='quarter')fields.innerHTML=`<div class="mem-form-grid"><label>أول ربع<input id="pickIndex" type="number" min="1" max="240" value="1"></label><label>عدد الأرباع<input id="pickAmount" type="number" min="1" max="240" value="1"></label></div>`;
      else fields.innerHTML=`<div class="mem-form-grid"><label>أول جزء<input id="pickIndex" type="number" min="1" max="30" value="1"></label><label>عدد الأجزاء<input id="pickAmount" type="number" min="1" max="30" value="1"></label></div>`;
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
        if(unit==='surah'){const s=Number($('#pickSurah')?.value||1);range={start:{s,a:1},end:{s,a:count(s)},label:`${surah(s).name} · سورة كاملة`}}
        else if(unit==='ayahs'){const s=Number($('#pickStartSurah')?.value||1),a=Number($('#pickStartAyah')?.value||1),amt=Math.max(1,Number($('#pickAmount')?.value||1));let cur=point(s,a);const all=[];while(cur&&all.length<amt){all.push(cur);cur=nextPoint(cur)}range={start:all[0],end:all[all.length-1]}}
        else{const idx=Number($('#pickIndex')?.value||1),amt=Math.max(1,Number($('#pickAmount')?.value||1));note.textContent='جارٍ تحديد بداية ونهاية المقطع بدقة من تقسيم المصحف…';range=await resolveUnit(unit,idx,amt);if(!range){note.textContent='هذا الاختيار يحتاج اتصالًا مرة واحدة لتحديده بدقة.';return}}
        closeModal(pickerModal);onDone?.(range,{unit,index:unit==='surah'?Number($('#pickSurah')?.value||1):Number($('#pickIndex')?.value||1),amount:unit==='surah'?1:Math.max(1,Number($('#pickAmount')?.value||1))});
      }catch{note.textContent='تعذر تحديد المقطع. جرّب مرة أخرى.'}
    };
    renderFields();
  }

  async function startSession(){
    const p=await buildPlanForDay();
    const tasks=[];
    if(p.newRange)tasks.push({kind:'new',item:p.newRange});
    p.stabilizing.forEach(i=>tasks.push({kind:'stabilize',item:i}));
    p.reviews.forEach(i=>tasks.push({kind:'review',item:i}));
    closeModal(sessionModal);
    sessionModal=document.createElement('div');sessionModal.className='mem-modal';
    if(!tasks.length){
      sessionModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>لا توجد مراجعات مستحقة الآن</h3><p class="mem-help">هذا لا يعني أن عليك التوقف. يمكنك تسجيل ما حفظته اليوم، أو الانتقال لما بعده في خطة الحفظ.</p><div class="mem-quick-actions"><button class="btn primary" data-record-now>سجل ما حفظته اليوم</button><button class="btn" data-close>إغلاق</button></div></div>`;
      document.body.appendChild(sessionModal);sessionModal.querySelector('[data-record-now]').onclick=()=>{closeModal(sessionModal);openRangePicker({title:'ماذا حفظت اليوم؟',mode:'new',onDone:r=>{recordExplicitNew(r);render()}})};
      sessionModal.querySelector('[data-close]').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-close').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(sessionModal);return;
    }
    sessionModal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-session-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">جلسة اليوم</div><h3>اعمل المطلوب، على مهلك</h3><p class="mem-help">لا يوجد مؤقت. أكمل الحفظ أو التسميع بإتقان، ثم انتقل لما بعده.</p><div class="mem-session-task-list">${tasks.map((t,i)=>`<article class="mem-session-task" data-task="${esc(t.item.id||'planned')}"><b>${i+1}</b><div><strong>${t.kind==='new'?'الحفظ الجديد':t.kind==='stabilize'?'التثبيت':'المراجعة المستحقة'}</strong><span>${esc(rangeLabel(t.item))}</span><small>${t.kind==='new'?'سجّل المقطع بعد أن تحفظه جيدًا':t.kind==='stabilize'?`جلسة تثبيت ${((t.item.stabilizationHistory||[]).length)+1} من 7`:`الموعد: ${formatNext(t.item)}`}</small></div><div class="mem-task-buttons">${t.kind==='new'?'<button type="button" data-action="record">سجل أنني حفظت</button>':'<button type="button" data-action="recite">سمّع</button><button type="button" data-action="study">دراسة الآية</button><button type="button" data-action="play">استماع</button><button type="button" data-action="snooze">غدًا</button>'}</div></article>`).join('')}</div><div class="mem-session-footer">الجلسة مفتوحة حتى تنتهي من المطلوب — لا يوجد مؤقت.</div></div>`;
    document.body.appendChild(sessionModal);
    sessionModal.querySelector('.mem-modal-close').onclick=()=>closeModal(sessionModal);sessionModal.querySelector('.mem-modal-backdrop').onclick=()=>closeModal(sessionModal);
    sessionModal.querySelectorAll('.mem-session-task').forEach(row=>row.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=async()=>{
      const task=tasks.find(t=String(t.item.id||'planned')===row.dataset.task);if(!task)return;const action=btn.dataset.action;
      if(action==='record'){if(task.kind==='new'){const created=recordExplicitNew(task.item);if(created)row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ تم التسجيل</span>'}} else if(action==='recite')openRecitation(task.item,task.kind); else if(action==='study'){window.openAyahStudy?.(task.item.start.s,task.item.start.a)} else if(action==='play'){await playRange(task.item)} else if(action==='snooze'){snooze(task.item.id);row.querySelector('.mem-task-buttons').innerHTML='<span class="mem-done">✓ غدًا</span>'}
    }));
  }
  async function playRange(r){const audio=document.querySelector('#quranAudio');if(!audio)return toast('مشغل التلاوة غير متاح هنا.');const p=point(r.start.s,r.start.a);const url=`https://everyayah.com/data/Husary_128kbps/${String(p.s).padStart(3,'0')}${String(p.a).padStart(3,'0')}.mp3`;const playable=await window.RAFIQ_CONTENT?.getPlayableAudio(url)||url;audio.src=playable;audio.currentTime=0;audio.play().catch(()=>toast('التلاوة تحتاج اتصالًا أو تنزيلًا مسبقًا.'))}
  function openRecitation(item,phase){
    const modal=document.createElement('div');modal.className='mem-modal';const verses=points(item.start,item.end,3000).map(p=>({p,text:surah(p.s)?.verses?.[p.a-1]?.text||''}));
    modal.innerHTML=`<div class="mem-modal-backdrop"></div><div class="mem-modal-card mem-recite-card" role="dialog" aria-modal="true"><button class="mem-modal-close" type="button">×</button><div class="mem-modal-kicker">التسميع</div><h3>${esc(rangeLabel(item))}</h3><div class="mem-recall-state"><span>النص مخفي. استرجعه من الذاكرة.</span><span>${verses.length} آية</span></div><div class="mem-recite-hints"><button type="button" data-hint="first">إظهار أول آية</button><button type="button" data-hint="firstword">إظهار أول كلمة</button><button type="button" data-hint="all">إظهار النص</button></div><div class="mem-recite-text" id="reciteText" hidden></div><div class="mem-grade-grid"><button type="button" data-grade="relearn"><b>لم أتذكر</b><small>احتجت للنص أو توقفت.</small></button><button type="button" data-grade="hard"><b>صعب</b><small>أكملت مع أخطاء أو تلميح.</small></button><button type="button" data-grade="good"><b>جيد</b><small>استرجاع صحيح مع تردد بسيط.</small></button><button type="button" data-grade="easy"><b>سهل</b><small>استرجاع كامل من الذاكرة.</small></button></div><p class="mem-next-preview" id="reciteNextPreview">اختر تقييمك بعد التسميع لمعرفة الموعد القادم.</p></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove();modal.querySelector('.mem-modal-close').onclick=close;modal.querySelector('.mem-modal-backdrop').onclick=close;
    const text=modal.querySelector('#reciteText');
    modal.querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>{const h=b.dataset.hint;if(h==='first'){text.hidden=false;text.innerHTML=`<p>${esc(verses[0]?.text||'')}</p>`}else if(h==='firstword'){text.hidden=false;const first=(verses[0]?.text||'').trim().split(/\s+/)[0]||'';text.innerHTML=`<p>${esc(first)} …</p>`}else{text.hidden=false;text.innerHTML=verses.map(v=>`<p><span class="recite-ayah-num">${v.p.a}</span> ${esc(v.text)}</p>`).join('')}});
    modal.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const result=grade(item.id,b.dataset.grade);if(result){modal.querySelector('#reciteNextPreview').textContent=`المراجعة القادمة: ${result.next}`;setTimeout(close,900)}});
  }

  function setInput(id,v){const e=$(id);if(e)e.value=String(v??'')}
  function populateSurahs(select){if(!select||!quran.length)return;select.innerHTML=quran.map(s=>`<option value="${s.s}">${s.s}. ${esc(s.name)}</option>`).join('')}
  async function savePlan(){
    const unit=$('#planUnit')?.value||'ayahs',amount=Math.max(1,Number($('#planAmount')?.value||1));
    if(unit==='ayahs'){
      data.plan={...data.plan,unit,amount,startSurah:Number($('#planStartSurah')?.value||1),startAyah:Number($('#planStartAyah')?.value||1),cursor:null};
    }else if(unit==='surah'){
      data.plan={...data.plan,unit,amount,startIndex:Number($('#planStartIndex')?.value||1)};
    }else{
      data.plan={...data.plan,unit,amount,startIndex:Number($('#planStartIndex')?.value||1)};
    }
    save();const r=await resolvePlanRange(); if(r)toast(`تم حفظ الخطة: ${unitLabel(unit,Number($('#planStartIndex')?.value||1),amount)||rangeLabel(r)}.`); else if(unit!=='ayahs')toast('تم حفظ الخطة. سيحتاج اختيار هذا المقدار اتصالًا مرة واحدة حتى نحدد مقطعه بدقة.'); render();
  }
  function renderPlanInputs(){
    const p=data.plan,unitSelect=$('#planUnit');if(!unitSelect)return;unitSelect.value=p.unit||'ayahs';setInput('#planAmount',p.amount||10);populateSurahs($('#planStartSurah'));setInput('#planStartSurah',p.startSurah||1);setInput('#planStartAyah',p.startAyah||1);setInput('#planStartIndex',p.startIndex||1);$('#planAyahFields')&&(('#planAyahFields').hidden=p.unit!=='ayahs');$('#planIndexFields')&&(('#planIndexFields').hidden=p.unit==='ayahs');
    const name=$('#planStartUnitText');if(name){const labels={surah:'أول سورة',page:'أول صفحة',quarter:'أول ربع',juz:'أول جزء'};name.textContent=labels[p.unit]||'البداية'}
    const idx=$('#planStartIndex');if(idx){idx.max=String(p.unit==='page'?604:p.unit==='quarter'?240:p.unit==='juz'?30:114);idx.min='1'}
  }
  function render(){
    const host=$('#memCoreHost');if(!host)return;
    renderPlanInputs();
    buildPlanForDay().then(p=>{
      const todayNew=p.newRange?rangeLabel(p.newRange):'—';
      const tomorrowText=data.plan.unit==='ayahs'?`غدًا: نفس المقدار من الموضع التالي`:`غدًا: مقدار ${unitLabel(data.plan.unit,Number(data.plan.startIndex||1)+Number(data.plan.amount||1),Number(data.plan.amount||1))}`;
      setText('#memNewToday',todayNew);setText('#memNewDesc',p.newRange?'سجّله بعد الإتقان':'حدّد مقدارك أو اتصل مرة واحدة لتحديده');setText('#memStabilizeToday',p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+rangeCount(x),0)} آية`:'لا يوجد');setText('#memReviewToday',p.reviews.length?`${p.reviews.reduce((n,x)=>n+rangeCount(x),0)} آية`:'لا يوجد');setText('#memBacklog',Math.max(0,p.reviews.length-Number(data.plan.reviewLimit||999))?`${Math.max(0,p.reviews.length-Number(data.plan.reviewLimit||999))} متأخر`:'لا يوجد');setText('#memTomorrow',tomorrowText);
      setText('#memPlanSummary',planSummary());
      const counts=allItems().reduce((acc,i)=>{acc.total+=rangeCount(i);if(i.phase==='stabilizing')acc.active++;if(i.phase==='review'&&i.dueKey&&diffDays(i.dueKey,today())>=0)acc.due++;return acc},{total:0,active:0,due:0});
      setText('#memSavedCount',`${counts.total.toLocaleString('ar-EG')} آية`);setText('#memActiveCount',`${counts.active} مقاطع تحت التثبيت`);setText('#memDueCount',`${counts.due} مقاطع مستحقة`);setText('#memWeakCount',`${activeWeak().length} مقاطع تحتاج دعمًا`);
      renderWeek();renderUpcoming();renderWeak();renderSaved();
    });
  }
  function setText(id,v){const e=$(id);if(e)e.textContent=v}
  function planSummary(){const p=data.plan;const names={ayahs:'آيات',surah:'سور',page:'صفحات',quarter:'أرباع',juz:'أجزاء'};return`${p.amount} ${names[p.unit]||'وحدة'} يوميًا · ${p.reviewMode==='weekly'?'مراجعة كل 7 أيام':'تكرار متباعد ذكي'}`}
  async function renderWeek(){const box=$('#memWeekGrid');if(!box)return;const arr=[];for(let i=0;i<7;i++){const k=addDays(today(),i),p=await buildPlanForDay(k);arr.push(`<article class="mem-week-card ${i===0?'today':''}"><header><b>${i===0?'اليوم':i===1?'غدًا':new Intl.DateTimeFormat('ar-EG',{weekday:'short'}).format(keyDate(k))}</b><span>${humanDate(k)}</span></header><div><small>حفظ جديد</small><strong>${p.newRange?esc(rangeLabel(p.newRange)):'—'}</strong></div><div><small>تثبيت</small><strong>${p.stabilizing.length?`${p.stabilizing.reduce((n,x)=>n+rangeCount(x),0)} آية`:'—'}</strong></div><div><small>مراجعة</small><strong>${p.reviews.length?`${p.reviews.reduce((n,x)=>n+rangeCount(x),0)} آية`:'—'}</strong></div></article>`)}box.innerHTML=arr.join('')}
  function renderUpcoming(){const box=$('#memUpcomingList');if(!box)return;const rows=allItems().filter(i=>i.phase==='stabilizing'||i.phase==='review').sort((a,b)=>String((a.dueKey||'')).localeCompare(String(b.dueKey||''))).slice(0,8);box.innerHTML=rows.length?rows.map(i=>`<article><b>${esc(rangeLabel(i))}</b><span>${i.phase==='stabilizing'?`تثبيت ${(new Set((i.stabilizationHistory||[]).map(x=>x.key))).size}/7 · باقي ${Math.max(0,7-(new Set((i.stabilizationHistory||[]).map(x=>x.key))).size)} جلسات`:formatNext(i)}</span></article>`).join(''):`<div class="mem-empty">لا توجد مواعيد مؤجلة حاليًا.</div>`}
  function renderWeak(){const box=$('#memWeakList');if(!box)return;const rows=activeWeak();box.innerHTML=rows.length?rows.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${Number(i.lapses||0)} مرات إعادة تثبيت · صعوبة ${Math.round(Number(i.difficulty||5))/10}</small></div><button class="btn" data-weak="${i.id}">سمّع الآن</button></article>`).join(''):`<div class="mem-empty">لا توجد نقاط ضعف مسجلة حتى الآن.</div>`;box.querySelectorAll('[data-weak]').forEach(b=>b.onclick=()=>{const i=allItems().find(x=>x.id===b.dataset.weak);if(i)openRecitation(i,'review')})}
  function renderSaved(){const box=$('#memSavedList');if(!box)return;const rows=[...data.items,...data.priorRanges].sort((a,b)=>String(b.createdKey||'').localeCompare(String(a.createdKey||''))).slice(0,8);box.innerHTML=rows.length?rows.map(i=>`<article class="mem-range-row"><div><strong>${esc(rangeLabel(i))}</strong><small>${i.phase==='stabilizing'?`تثبيت · ${new Set((i.stabilizationHistory||[]).map(x=>x.key)).size}/7`:`موعد المراجعة: ${formatNext(i)}`}</small></div></article>`).join(''):`<div class="mem-empty">لم تضف محفوظًا بعد.</div>`}

  function injectUI(){
    const view=$('#view-plan'); if(!view||$('#memCoreRoot'))return;
    const root=document.createElement('section');root.id='memCoreRoot';root.className='mem-core-root';
    root.innerHTML=`<div class="mem-core-head"><div><span class="mem-kicker">الحفظ والمراجعة</span><h2>خطة واحدة، واضحة وبسيطة</h2><p>اختَر مقدارًا يناسبك، وسيتولى رفيق تنظيم الحفظ والتثبيت والمراجعة. لا يوجد مؤقت؛ أكمل حتى تتقن المقطع.</p></div><div class="mem-core-actions"><button class="btn primary" id="memStartSession" type="button">ابدأ جلسة اليوم</button></div></div>
      <div class="mem-today-grid"><article class="mem-today-card new"><small>حفظ اليوم</small><strong id="memNewToday">—</strong><span id="memNewDesc">—</span></article><article class="mem-today-card"><small>التثبيت</small><strong id="memStabilizeToday">—</strong><span>تثبيت يومي لمدة 7 جلسات</span></article><article class="mem-today-card review"><small>المراجعة</small><strong id="memReviewToday">—</strong><span id="memTomorrow">—</span></article><article class="mem-today-card alert"><small>المتأخر</small><strong id="memBacklog">—</strong><span>يظهر فقط إذا فاتتك مراجعات</span></article></div>
      <section class="mem-panel mem-plan-main"><div class="mem-panel-head"><div><h3>خطتك</h3><p id="memPlanSummary">—</p></div><button class="btn" id="coreSavePlan" type="button">حفظ الخطة</button></div><div class="simple-plan-grid"><label>مقدار الحفظ يوميًا<select id="planUnit"><option value="ayahs">آيات</option><option value="page">صفحات</option><option value="quarter">أرباع</option><option value="juz">أجزاء</option><option value="surah">سور</option></select></label><label>العدد<input id="planAmount" type="number" min="1" value="10"></label><div id="planAyahFields" class="plan-fields"><label>تبدأ من سورة<select id="planStartSurah"></select></label><label>من آية<input id="planStartAyah" type="number" min="1" value="1"></label></div><div id="planIndexFields" class="plan-fields" hidden><label id="planStartUnitLabel">أول صفحة<input id="planStartIndex" type="number" min="1" value="1"></label><small class="plan-unit-note">للصفحات والأرباع والأجزاء: يحدد التطبيق المقطع بدقة من تقسيم المصحف.</small></div></div><div class="mem-quick-actions"><button class="btn" id="planSelectUnit" type="button">اختيار مقدار من المصحف</button><label class="plan-review-label">نظام المراجعة<select id="planReviewMode"><option value="spaced">تكرار متباعد ذكي</option><option value="weekly">مراجعة كل 7 أيام</option></select></label></div></section>
      <section class="mem-grid-2"><section class="mem-panel"><div class="mem-panel-head"><div><h3>حفظت اليوم؟</h3><p>سجّل المقطع الذي أتقنته فعلًا، حتى لو كان مختلفًا عن الخطة.</p></div></div><button class="btn primary" id="memRecordNew" type="button">تحديد ما حفظته اليوم</button></section><section class="mem-panel"><div class="mem-panel-head"><div><h3>محفوظ سابق</h3><p>أضف ما كنت حافظًا له من قبل مرة واحدة.</p></div></div><button class="btn primary" id="memAddPrior" type="button">إضافة محفوظ سابق</button></section></section>
      <section class="mem-panel"><div class="mem-panel-head"><div><h3>لمحة الحفظ</h3><p>صورة سريعة عن مكانك الآن.</p></div></div><div class="mem-stat-row"><div><small>إجمالي المحفوظ</small><b id="memSavedCount">0 آية</b></div><div><small>تحت التثبيت</small><b id="memActiveCount">0 مقاطع</b></div><div><small>مستحقة اليوم</small><b id="memDueCount">0 مقاطع</b></div><div><small>تحتاج دعمًا</small><b id="memWeakCount">0 مقاطع</b></div></div></section>
      <section class="mem-panel"><div class="mem-panel-head"><div><h3>الأسبوع القادم</h3><p>الحفظ والتثبيت والمراجعة، يومًا بيوم.</p></div></div><div class="mem-week-grid" id="memWeekGrid"></div></section>
      <section class="mem-panel"><div class="mem-panel-head"><div><h3>ما سيأتي لاحقًا</h3><p>متى تنتقل المقاطع من التثبيت إلى المراجعة التالية.</p></div></div><div class="mem-upcoming-list" id="memUpcomingList"></div></section>
      <section class="mem-panel"><div class="mem-panel-head"><div><h3>تثبيت إضافي ونقاط الضعف</h3><p>المقاطع الصعبة أو المتكررة في الأخطاء، بدل «مراجعة شاملة» مبهمة.</p></div></div><div class="mem-range-list" id="memWeakList"></div></section>
      <section class="mem-panel"><div class="mem-panel-head"><div><h3>المحفوظ المسجل</h3><p>آخر المقاطع التي أضفتها أو حفظتها.</p></div></div><div class="mem-range-list" id="memSavedList"></div></section>`;
    $('#memCoreHost')?.appendChild(root);
    $('#planUnit')?.addEventListener('change',()=>{const u=$('#planUnit').value;$('#planAyahFields').hidden=u!=='ayahs';$('#planIndexFields').hidden=u==='ayahs';const text=$('#planStartUnitText');if(text)text.textContent=u==='surah'?'أول سورة':u==='page'?'أول صفحة':u==='quarter'?'أول ربع':'أول جزء';const idx=$('#planStartIndex');if(idx)idx.max=String(u==='page'?604:u==='quarter'?240:u==='juz'?30:114)});
    $('#planReviewMode')?.addEventListener('change',()=>{data.plan.reviewMode=$('#planReviewMode').value;save();render()});
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
  window.RAFIQ_MEM={getData:()=>clone(data),plan:async()=>await buildPlanForDay(),startSession,grade:(id,g)=>grade(id,g),addPrior:(s,a,es,ea)=>addPrior({start:point(s,a),end:point(es||s,ea||a)}),markNew:(s,a,es,ea)=>recordExplicitNew({start:point(s,a),end:point(es||s,ea||a)})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
})();
