// Rafiq Quran — application engine
// Refactored from the working monolithic build without removing feature logic.

import { stateManager, state } from './state.js';
import { $, esc, fmt, toast, haptic, beep, particles, addDays, diffDays, hijri, greeting } from './utils.js';
import { surahs, dailyVerses, method, reminders, asbab, wordMeanings, tazkiyah, tajRules, adhkar, TAZKIYAH_DAYS, DEEP, ARCHIVE_META, ARCHIVE_EXTRA, STUDY_GUIDES } from './data.js';

const save = () => stateManager.save();
const dayKey = (d = new Date()) => stateManager.getDayKey(d);
function ritualDayIndex(){const first=state.firstActiveBoundary||dayKey();return Math.max(1,diffDays(first,dayKey())+1)}
function ritualDayIndex(){const first=state.firstActiveBoundary||dayKey();return Math.max(1,diffDays(first,dayKey())+1)}


function ritualKey(d=new Date()){const p=state.prayerToday?.Maghrib;const now=new Date(d);if(p){const [h,m]=String(p).split(':').map(Number);const mg=new Date(now);mg.setHours(h||0,m||0,0,0);if(now>=mg)return dayKey(addDays(now,1));}return dayKey(now)}
function requestNotifications(){if(!('Notification' in window))return toast('الإشعارات غير مدعومة في هذا المتصفح');Notification.requestPermission().then(p=>{state.notify=p==='granted';save();toast(p==='granted'?'تم تفعيل الإشعارات ✅':'لم يتم السماح بالإشعارات')}).catch(()=>toast('تعذر طلب الإذن'))}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function diffDays(a,b){return Math.floor((new Date(b)-new Date(a))/86400000)}
function hijri(d=new Date()){try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{day:'numeric',month:'long',year:'numeric'}).format(d)}catch{return ''}}
function greeting(){const h=new Date().getHours(),n=state.name||'يا صديقي';if(h>=2&&h<5)return`وقت الخلوات يا ${n} 🌌`;if(h<6)return`صباح الهمة والبركة يا ${n} 🌅`;if(h<12)return`صباح الخير يا ${n} ☀️`;if(h<17)return`طاب يومك يا ${n} 🌤️`;if(h<22)return`مساء الهدوء يا ${n} 🌙`;return`ليلة مباركة يا ${n} 🌌`}
function setTimeGlow(){const h=new Date().getHours();const c=h<6?'rgba(92,133,86,.08)':h<12?'rgba(212,175,55,.10)':h<17?'rgba(220,155,70,.08)':h<21?'rgba(90,180,150,.08)':'rgba(51,82,55,.10)';document.documentElement.style.setProperty('--timeGlow',c)}
function applyGraphics(){
  const cores=navigator.hardwareConcurrency||8;
  const mem=navigator.deviceMemory||8;
  const compact=window.innerWidth<700;
  const coarse=matchMedia('(pointer:coarse)').matches;
  const lowPower=cores<=4 || mem<=4;
  document.body.classList.remove('mode-1','mode-2','mode-3');
  document.body.classList.add(`mode-${state.graphics}`);
  document.body.dataset.theme=state.theme;
  document.body.dataset.perf=(lowPower||state.graphics===1)?'lite':'full';
  document.body.classList.toggle('lite-mobile',compact||coarse||lowPower||state.graphics===1);
  document.body.dataset.graphics=String(state.graphics);
  createStars();
  createOceanBubbles();
  createGlobalOceanBubbles();
  const g=$('graphicsSelect');if(g)g.value=String(state.graphics);
  const t=$('themeSelect');if(t)t.value=state.theme;
}
function createStars(){const box=$('starsLayer');if(!box)return;box.innerHTML='';if(state.graphics===1)return;const n=state.graphics===3?(window.innerWidth>1400?28:window.innerWidth>1000?20:12):(window.innerWidth>1000?14:8);const f=document.createDocumentFragment();for(let i=0;i<n;i++){const s=document.createElement('span');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.setProperty('--dur',(20+Math.random()*18)+'s');s.style.setProperty('--dx',(-18+Math.random()*36)+'px');s.style.setProperty('--dy',(-18+Math.random()*36)+'px');f.appendChild(s)}box.appendChild(f)}
function toast(text){const t=document.createElement('div');t.textContent=text;t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;padding:10px 15px;border:1px solid var(--border);border-radius:999px;background:var(--surface2);color:var(--text);box-shadow:var(--shadow);font-weight:800';document.body.appendChild(t);setTimeout(()=>t.remove(),2400)}
function haptic(kind='light'){if(!navigator.vibrate)return;try{navigator.vibrate(kind==='done'?[12,25,12]:10)}catch{}}
function beep(kind='click'){if(!state.soundEnabled)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;window.__audio=window.__audio||new A();const c=window.__audio;if(c.state==='suspended')c.resume();const fs=kind==='shine'?[740,988,1319]:kind==='done'?[440,660,880]:kind==='ok'?[520,760]:[180];const type=kind==='shine'?'triangle':'sine';fs.forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;g.gain.value=.0001;g.gain.exponentialRampToValueAtTime(kind==='shine'?.055:.09,c.currentTime+.01+i*.06);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.13+i*.06);o.connect(g).connect(c.destination);o.start(c.currentTime+i*.06);o.stop(c.currentTime+.16+i*.06)})}
function particles(x,y){if(state.graphics===1)return;for(let i=0;i<10;i++){const p=document.createElement('span');p.className='particle';p.style.left=x+'px';p.style.top=y+'px';p.style.width=p.style.height=(4+Math.random()*5)+'px';p.style.background=Math.random()>.5?'var(--gold)':'var(--success)';const a=Math.random()*Math.PI*2,d=25+Math.random()*45;p.style.setProperty('--dx',Math.cos(a)*d+'px');p.style.setProperty('--dy',Math.sin(a)*d+'px');document.body.appendChild(p);setTimeout(()=>p.remove(),900)}}
function logActivity(k,n=1){const t=dayKey();state.dailyLog[t] ||= {save:0,review:0,rep:0,focus:0};state.dailyLog[t][k]=(state.dailyLog[t][k]||0)+n;save()}
function markActive(){const t=dayKey();if(state.lastActive===t)return;const old=state.streak||0;state.streak=!state.lastActive?1:(diffDays(state.lastActive,t)===1?old+1:1);state.lastActive=t;if(!state.firstDate)state.firstDate=t;if(state.streak>old&&state.streak%7===0)state.streakFreezes=Math.min(3,(state.streakFreezes||0)+1);save()}
function getDailyVerse(){return dailyVerses[Math.floor(Date.now()/86400000)%dailyVerses.length]}
function recitationUrl(s,a,r=state.reciter){return`https://everyayah.com/data/${r}/${String(s).padStart(3,'0')}${String(a).padStart(3,'0')}.mp3`}
function showDailySplash(force=false){if(!state.name)return;const key=ritualKey();if(!force&&localStorage.getItem('rafiq-splash-boundary')===key)return;const a=getDailyVerse();const ay=$('splashAyah'),ref=$('splashRef'),audio=$('splashAudio'),panel=$('dailySplash');if(!ay||!ref||!audio||!panel)return;ay.textContent=a.text;ref.textContent=`${a.ref} — بصوت ${a.name}`;audio.pause();audio.src=recitationUrl(a.s,a.a,a.reciter||state.reciter);audio.volume=Math.max(0,Math.min(1,state.volume||.85));audio.currentTime=0;panel.classList.add('show');const play=$('splashPlay');if(play)play.textContent='▶ تشغيل الآية';}
function closeSplash(mark=true){const a=$('splashAudio');if(a){a.pause();a.currentTime=0}$('dailySplash')?.classList.remove('show');if(mark)localStorage.setItem('rafiq-splash-boundary',ritualKey())}
function openModal(id){$(id)?.classList.add('show')};function closeModal(id){$(id)?.classList.remove('show')}
function switchView(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(id)?.classList.add('active');document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));document.body.classList.toggle('ocean-world',id==='spiritual');document.body.classList.toggle('view-spiritual',id==='spiritual');if($('globalZadOcean'))$('globalZadOcean').style.display=id==='spiritual'?'none':'block';if(id!=='spiritual')document.body.classList.remove('space-world');if(id==='spiritual'){const o=$('ocean'),s=$('spaceView');if(o){o.style.display='block';o.classList.remove('ocean-dive')}if(s)s.classList.remove('show')}window.scrollTo({top:0,behavior:'auto'});if(id==='home')renderHome();if(id==='planning')renderPlanning();if(id==='study')renderStudy();if(id==='mushaf')mushafInit();if(id==='spiritual'){renderSpiritual();createOceanBubbles()}else if(oceanSound)stopOceanSound();if(id==='progress')renderProgress();if(id==='settings')renderSettings();setTimeGlow()}
function profileSave(name,age){state.name=String(name||'').trim();state.age=age||'';state.role='';save();}
function saveWelcome(){const n=$('welcomeName').value.trim();const age=+$('welcomeAge').value||'';if(!n)return toast('اكتب اسمك أولًا');if(age&& (age<3||age>110))return toast('العمر من 3 إلى 110 سنة');profileSave(n,age);const style=$('welcomeStyle').value;if(style==='lite'||style==='auto')state.graphics=1;else if(style==='balanced')state.graphics=2;else if(style==='ultra')state.graphics=3;applyGraphics();save();closeModal('welcomeModal');renderAll();setTimeout(()=>showDailySplash(true),180)}
function renderHome(){
  const greg=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const g=$('greeting'); if(g) g.textContent=greeting();
  const dl=$('dateLine'); if(dl) dl.textContent=greg;
  const hl=$('hijriLine'); if(hl) hl.textContent=`التاريخ الهجري: ${hijri()}`;
  const t=dayKey();const log=state.dailyLog[t]||{};const due=state.entries.filter(e=>e.nextReviewDate<=t&&e.hasBeenEvaluated);const fresh=state.entries.filter(e=>e.date===t&&!e.hasBeenEvaluated);const old=state.entries.filter(e=>e.date!==t);const pct=state.goal?Math.min(100,estimateProgress()/state.goal*100):0;$('heroPct').textContent=`${pct.toFixed(0)}%`;$('heroRing').style.setProperty('--pct',pct+'%');$('missionReviewText').textContent=`${log.review||0}/${state.dailyReviewTarget||3}`;$('missionRepText').textContent=`${log.rep||0}/${state.dailyRepTarget||10}`;$('missionFocusText').textContent=`${Math.round(log.focus||0)}/${state.dailyFocusTarget||20}د`;$('missionReviewBar').style.width=Math.min(100,(log.review||0)/(state.dailyReviewTarget||3)*100)+'%';$('missionRepBar').style.width=Math.min(100,(log.rep||0)/(state.dailyRepTarget||10)*100)+'%';$('missionFocusBar').style.width=Math.min(100,(log.focus||0)/(state.dailyFocusTarget||20)*100)+'%';$('homePriority').textContent=due.length?`ابدأ بـ ${due.length} مراجعة مستحقة الآن، ثم الحفظ الجديد، ثم 10 تكرارات غيبًا.`:fresh.length?`ابدأ بالحفظ الجديد: ${fresh.length} ورد، ثم أكمل 10 تكرارات غيبًا وسجّل تقييم اليوم.`:'لا توجد مراجعات طارئة الآن. نفّذ خطة اليوم أو أضف حفظًا جديدًا.';$('homeNewList').innerHTML=fresh.length?fresh.map(entryCard).join(''):'<div class="muted">لا يوجد حفظ جديد اليوم.</div>';$('homeDueList').innerHTML=due.length?due.map(entryCard).join(''):'<div class="muted">🎉 لا توجد مراجعات مستحقة الآن.</div>';$('homeOldSummary').textContent=old.length?`لديك ${old.length} وردًا محفوظًا سابقًا. المستحق الآن: ${old.filter(e=>e.nextReviewDate<=t).length}. خلال 7 أيام: ${old.filter(e=>e.nextReviewDate>t&&e.nextReviewDate<=dayKey(addDays(new Date(),7))).length}.`:'أضف محفوظك السابق مرة واحدة ليبني لك التطبيق مراجعاته.';$('homeOldList').innerHTML=old.slice(0,5).map(entryMini).join('')||'<div class="muted">لا يوجد محفوظ سابق مضاف بعد.</div>';$('homeSchedule').innerHTML=buildNextDays();$('homeMethod').innerHTML=method.slice(0,3).map(m=>`<div class="schedule-day"><strong>${m[0]} — ${m[1]}</strong><div class="small">${m[2]}</div></div>`).join('');$('todaySpiritualNote').textContent=tazkiyah[Math.floor(Date.now()/86400000)%tazkiyah.length];renderPrayerChecklist();const a=getDailyVerse();$('dailyVerseHome').textContent=a.text;$('dailyVerseRef').textContent=a.ref;}
function estimateProgress(){return state.entries.reduce((n,e)=>n+(e.hasBeenEvaluated?Math.max(0,e.baseUnits||1):0),0)}
function buildNextDays(){let h='';for(let i=0;i<7;i++){const d=addDays(new Date(),i),k=dayKey(d),due=state.entries.filter(e=>e.nextReviewDate<=k&&e.hasBeenEvaluated).length,newN=state.entries.filter(e=>e.date===k&&!e.hasBeenEvaluated).length;h+=`<div class="schedule-day"><strong>${d.toLocaleDateString('ar-EG',{weekday:'long'})}</strong><div class="small">${k} — مراجعة ${due} • جديد ${newN|| (i===0?state.dailyPlan:0)}</div></div>`}return h}
function entryCard(e){const t=dayKey(),due=e.hasBeenEvaluated&&e.nextReviewDate<=t,phase=e.phaseDays?.length||0,reps=e.sessionReps||0;const reviewButtons=phase<7?`<div class="qbtns"><button class="success" onclick="reviewEntry('${e.id}','pass')">✅ أتممت اليوم</button><button class="danger" onclick="reviewEntry('${e.id}','fail')">🔄 لم أتقن</button></div>`:state.evalMode==='weekly'?`<div class="qbtns"><button class="success" onclick="reviewEntry('${e.id}','pass')">✅ ممتازة — 7 أيام</button><button class="danger" onclick="reviewEntry('${e.id}','fail')">🔴 أعد غدًا</button></div>`:`<div class="qbtns"><button class="info" onclick="reviewEntry('${e.id}',4)">🔵 سهل</button><button class="success" onclick="reviewEntry('${e.id}',3)">🟢 تذكرته</button><button class="warning" onclick="reviewEntry('${e.id}',2)">🟡 بصعوبة</button><button class="danger" onclick="reviewEntry('${e.id}',1)">🔴 نسيت</button></div>`;return`<div class="item ${due?'due':''} ${e.intensive?'focus':''}"><div class="item-header"><div><div class="quran-title">${esc(e.label)} ${e.isExactLetters?'🎯':''}</div>${e.note?`<div class="note-txt">📌 ${esc(e.note)}</div>`:''}</div><div class="row"><button class="action info" onclick="openStudy('${e.id}')">✨</button><button class="action danger" onclick="openRecorder('${e.id}')">🎤</button><button class="action" onclick="deleteEntry('${e.id}')">✕</button></div></div><div class="item-meta"><div>${!e.hasBeenEvaluated?'✨ ورد جديد':due?'⏰ مستحق الآن':`📅 القادم ${e.nextReviewDate}`}</div><div class="phase"><span class="badge gold">${phase<7?`تثبيت ${phase}/7`:'استدامة'}</span>${phase<7?Array.from({length:7},(_,i)=>`<span class="dot ${i<phase?'on':''}"></span>`).join(''):''}</div></div><div class="links"><a href="https://quran.com/${smartPath(e.label)}" target="_blank" rel="noopener">📖 المصحف</a><button class="action" onclick="openStudy('${e.id}')">📚 دراسة الورد</button></div><div class="rep-box"><div class="rep-row"><b>${phase<7&&!e.hasBeenEvaluated?'هدف التثبيت: 10 تكرارات غيبًا':'تكرار إضافي'}</b><button class="rep-btn ${reps>=10?'done':''}" onclick="addRep('${e.id}',this)">📿 كررت (${reps})</button></div><div class="small">إجمالي التكرارات: ${e.totalReps||0}</div></div>${(!e.hasBeenEvaluated||due)?reviewButtons:''}</div>`}
function entryMini(e){return`<div class="old-row"><div><b>${esc(e.label)}</b><div class="small">${e.nextReviewDate<=dayKey()?'مستحق الآن':'المراجعة '+e.nextReviewDate}</div></div><span class="badge ${e.nextReviewDate<=dayKey()?'red':'gold'}">${e.nextReviewDate<=dayKey()?'⏰ مستحق':'📅 مجدول'}</span><button class="action" onclick="openStudy('${e.id}')">دراسة</button></div>`}
function smartPath(label){const m=label.match(/(?:صفحة|صفحه|ص)\s*(\d+)/);if(m)return`page/${m[1]}`;let s=-1;surahs.forEach((x,i)=>{if(s<0&&label.includes(x))s=i+1});const a=label.match(/(?:آية|ايه|آيه|اية)\s*(\d+)/);return s>0?(a?`${s}/${a[1]}`:`${s}`):`search?q=${encodeURIComponent(label)}`}
function saveEntry(label,note,intensive,baseLetters,old=false){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());const e={id,label,note,intensive:!!intensive,isExactLetters:false,date:dayKey(),nextReviewDate:dayKey(),hasBeenEvaluated:false,phaseDays:old?['old1','old2','old3','old4','old5','old6','old7']:[],reviewCount:0,reviewReads:0,manualReps:0,totalReps:0,sessionReps:0,lastRepDate:dayKey(),interval:old?7:0,ease:2.5,srsLevel:old?1:0,failCount:0,baseLetters,baseUnits:Math.max(.1,baseLetters/500)};state.entries.push(e);logActivity('save');markActive();save();renderAll();particles(innerWidth/2,innerHeight/2);beep('done');haptic('done')}
async function resolveLetters(label,count,unit){try{const ref=parseRef(label);if(!ref)return count*unit;const url=ref.page?`https://api.alquran.cloud/v1/page/${ref.page}/quran-uthmani`:`https://api.alquran.cloud/v1/ayah/${ref.sura}:${ref.aya}/quran-uthmani`;const r=await fetch(url);if(!r.ok)throw 0;const j=await r.json();const text=j?.data?.ayahs?j.data.ayahs.map(a=>a.text).join(''):(j?.data?.text||'');const n=text.replace(/[^\u0621-\u064A]/g,'').length;return n||count*unit}catch{return count*unit}}
function parseRef(label){const page=label.match(/(?:صفحة|صفحه|ص)\s*(\d+)/);if(page)return{page:+page[1]};let s=-1;surahs.forEach((x,i)=>{if(s<0&&label.includes(x))s=i+1});const a=label.match(/(?:آية|ايه|آيه|اية)\s*(\d+)/);return s>0&&a?{sura:s,aya:+a[1]}:null}
async function addNew(){const label=$('newLabel').value.trim();if(!label)return toast('اكتب الورد أولًا');const count=+$('newUnitCount').value||1,unit=+$('newUnit').value||500;$('saveNewBtn').disabled=true;const letters=await resolveLetters(label,count,unit);saveEntry(label,$('newNote').value.trim(),$('intensiveCheck').checked,letters,false);closeModal('addNewModal');$('newLabel').value='';$('newNote').value='';$('intensiveCheck').checked=false;$('saveNewBtn').disabled=false}
async function addOld(){const label=$('oldLabel').value.trim();if(!label)return toast('اكتب اسم المحفوظ');const count=+$('oldCount').value||1,unit=+$('oldUnit').value||500;const letters=await resolveLetters(label,count,unit);saveEntry(label,'',false,letters,true);closeModal('addOldModal');$('oldLabel').value=''}
function deleteEntry(id){const e=state.entries.find(x=>x.id===id);if(!e)return;if(!confirm(`حذف «${e.label}»؟`))return;state.entries=state.entries.filter(x=>x.id!==id);save();renderAll()}
function addRep(id,btn){const e=state.entries.find(x=>x.id===id);if(!e)return;if(e.lastRepDate!==dayKey())e.sessionReps=0;e.sessionReps++;e.manualReps++;e.totalReps=e.manualReps+e.reviewReads;e.lastRepDate=dayKey();logActivity('rep');markActive();save();renderAll();if(btn){const r=btn.getBoundingClientRect();particles(r.left+r.width/2,r.top+r.height/2)}beep(e.sessionReps>=10?'done':'click');haptic(e.sessionReps>=10?'done':'light')}
function reviewEntry(id,q){const e=state.entries.find(x=>x.id===id);if(!e)return;const t=dayKey();const phase=e.phaseDays?.length||0;if(phase<7){if((e.sessionReps||0)<10&&q==='pass'&&!confirm('لم تكمل 10 تكرارات. هل تريد التقييم الآن؟'))return;if(q==='pass'){if(e.phaseDays.includes(t))return toast('سجلت مراجعة اليوم بالفعل');if(e.phaseDays.length&&e.phaseDays.at(-1).match(/^\d{4}-\d{2}-\d{2}$/)&&diffDays(e.phaseDays.at(-1),t)>1)e.phaseDays=[];e.phaseDays.push(t);e.interval=1}else{e.phaseDays=[];e.interval=1;e.failCount++}}else{if(state.evalMode==='weekly')e.interval=q==='pass'?7:1;else if(q===4){e.srsLevel++;e.ease+=.15;e.interval=e.srsLevel===1?4:Math.max(1,Math.round((e.interval||1)*e.ease*1.3))}else if(q===3){e.srsLevel++;e.interval=e.srsLevel===1?1:Math.max(1,Math.round((e.interval||1)*e.ease))}else if(q===2){e.ease=Math.max(1.3,e.ease-.15);e.interval=Math.max(1,Math.round((e.interval||1)*1.2))}else{e.srsLevel=0;e.interval=1;e.failCount++}}e.hasBeenEvaluated=true;e.reviewCount++;e.reviewReads++;e.totalReps=e.manualReps+e.reviewReads;e.sessionReps=0;const d=addDays(new Date(),e.interval);e.nextReviewDate=dayKey(d);logActivity('review');markActive();save();renderAll();beep((q==='pass'||q===3||q===4||e.phaseDays.length>=7)?'done':'click');haptic((q==='pass'||q===3||q===4)?'done':'light')}
function renderPlanning(){const t=dayKey();$('weeklyPlan').innerHTML=buildPlan(7);$('monthlyPlan').innerHTML=buildPlan(30);const arr=[...state.entries].sort((a,b)=>a.nextReviewDate.localeCompare(b.nextReviewDate));$('poolList').innerHTML=arr.length?arr.map(entryCard).join(''):'<div class="muted">لم تضف أورادًا بعد.</div>';const f=state.entries.filter(e=>e.intensive);$('focusList').innerHTML=f.length?f.map(entryCard).join(''):'<div class="muted">لا توجد أوراد في المتابعة المكثفة.</div>';renderPlanPreview()}
function buildPlan(days){let h='';for(let i=0;i<days;i++){const d=addDays(new Date(),i),k=dayKey(d),due=state.entries.filter(e=>e.hasBeenEvaluated&&e.nextReviewDate<=k).length,newN=i===0?state.dailyPlan:state.dailyPlan;h+=`<div class="schedule-day"><strong>${d.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'short'})}</strong><div class="small">جديد: ${newN} ${state.goalUnit} • مراجعة: ${due}</div></div>`}return h}
function renderPlanPreview(){const d=state.planDays||30,qty=state.planMode==='auto'?Math.max(1,Math.ceil((state.goal||604)/d)):state.dailyPlan;$('planPreview').innerHTML=`الخطة الحالية: <b>${qty}</b> ${state.goalUnit} يوميًا لمدة <b>${d}</b> يومًا، مع مراجعة تقارب <b>${state.reviewRatio}</b> وحدات مراجعة لكل وحدة جديد.`}
function savePlan(){state.planMode=$('planMode').value;state.dailyPlan=Math.max(1,Math.round(+$('planDaily').value||state.dailyPlan||2));state.planDays=Math.max(1,Math.round(+$('planDays').value||state.planDays||30));state.reviewRatio=Math.max(1,Math.min(20,Math.round(+$('planReviewRatio').value||3)));if(state.planMode==='auto')state.dailyPlan=Math.max(1,Math.ceil((state.goal||604)/state.planDays));state.planStart=dayKey();save();renderAll();toast('تم حفظ خطة الحفظ والمراجعة ✅')}
function calculateReverse(){const n=+$('reverseAmount').value;const d=$('reverseDate').value;if(!n||!d)return toast('أدخل البيانات');const days=Math.max(1,diffDays(dayKey(),d));const per=n/days;$('reverseResult').innerHTML=`تحتاج تقريبًا إلى <b>${per.toFixed(2)}</b> ${esc($('reverseUnit').value)} يوميًا لمدة <b>${days}</b> يومًا.`}
function prayerCacheKey(){return `prayer:${dayKey()}:${state.city}:${state.lat||''}:${state.lon||''}:${state.calcMethod}:${state.asrMethod}`}
async function prayerTimes(){const key=prayerCacheKey(),local=JSON.parse(localStorage.getItem(key)||'null');if(local)return local;if(!navigator.onLine)return null;let url='';if(Number.isFinite(state.lat)&&Number.isFinite(state.lon))url=`https://api.aladhan.com/v1/timings/${dayKey()}?latitude=${state.lat}&longitude=${state.lon}&method=${state.calcMethod}&school=${state.asrMethod}`;else url=`https://api.aladhan.com/v1/timingsByCity/${dayKey()}?city=${encodeURIComponent(state.city)}&country=Egypt&method=${state.calcMethod}&school=${state.asrMethod}`;try{const r=await fetch(url);if(!r.ok)throw 0;const j=await r.json();const data=j?.data?.timings||null;if(data)localStorage.setItem(key,JSON.stringify(data));return data}catch{return null}}
function renderPrayerChecklist(){const names=['الفجر','الظهر','العصر','المغرب','العشاء'];const t=dayKey();const box=$('prayerChecklist');box.innerHTML=names.map(n=>`<label class="schedule-day"><span class="row"><input type="checkbox" data-prayer="${n}" style="width:18px" ${state.prayers[t]?.[n]?'checked':''}><strong>${n}</strong></span></label>`).join('');box.querySelectorAll('input').forEach(i=>i.onchange=()=>{state.prayers[t] ||= {};state.prayers[t][i.dataset.prayer]=i.checked;save();});const times=state.prayerToday;$('nextReminder').textContent=nextReminderText(times)}
function nextReminderText(times){if(!times)return'فعّل مواقيت الصلاة في الإعدادات لربط التذكيرات باليوم الشرعي.';const now=new Date();const order=[['Fajr','الفجر'],['Dhuhr','الظهر'],['Asr','العصر'],['Maghrib','المغرب'],['Isha','العشاء']];for(const [k,n] of order){const tt=times[k];if(!tt)continue;const [h,m]=tt.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);if(d>now)return`القادم: ${n} الساعة ${tt}`;}return'بعد العشاء: الشفع والوتر، ثم بعد منتصف الليل تذكير بقيام الليل والاستغفار والدعاء.'}
async function refreshPrayer(){const p=await prayerTimes();state.prayerToday=p;save();renderHome();if(p)toast('تم تحديث مواقيت الصلاة ✅')}
function renderSettings(){$('graphicsSelect').value=state.graphics;$('themeSelect').value=state.theme;$('profileName').value=state.name;$('profileAge').value=state.age;$('reciterSelect').value=state.reciter;$('volumeRange').value=state.volume;$('notifyToggle').checked=state.notify;$('notifyHour').value=state.notifyHour;$('calcMethod').value=state.calcMethod;$('asrMethod').value=state.asrMethod;$('cityInput').value=state.city;$('prayerSettingsStatus').textContent=state.prayerToday?`آخر مواقيت محفوظة: ${state.city}`:'لم تحفظ مواقيت اليوم بعد.';$('installStatus').textContent=deferredInstall?'التثبيت متاح الآن.':'يمكن التثبيت من قائمة المتصفح إذا لم يظهر الزر.'}
function renderSpiritual(){const idx=Math.floor(Date.now()/86400000);$('tazkiyahText').textContent=tazkiyah[idx%tazkiyah.length]}
function dayScore(k){const l=state.dailyLog[k]||{};return(l.save||0)*3+(l.review||0)*2+(l.rep||0)*.12+(l.focus||0)*.05}
function renderProgress(){const ev=state.entries.filter(e=>e.hasBeenEvaluated).length;const letters=state.entries.reduce((n,e)=>n+(e.baseLetters||0)*(e.totalReps||0),0);$('pStreak').textContent=state.streak;$('pEntries').textContent=state.entries.length;$('pReviews').textContent=state.entries.reduce((n,e)=>n+(e.reviewCount||0),0);$('pLetters').textContent=fmt(letters);const pct=state.goal?Math.min(100,ev/state.goal*100):0;$('goalProgress').style.width=pct+'%';$('goalText').textContent=`إنجاز ${ev} من ${state.goal} ${state.goalUnit} (${pct.toFixed(1)}%)`;renderCalendar();drawChart();renderHeatmap();renderConstellation();renderAnalytics();renderMistakes()}
function renderCalendar(){const y=chartMonth.getFullYear(),m=chartMonth.getMonth();$('calTitle').textContent=new Date(y,m,1).toLocaleDateString('ar-EG',{month:'long',year:'numeric'});const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let h='<div class="cal">';['أحد','اثن','ثلا','أرب','خمي','جمع','سبت'].forEach(x=>h+=`<div class="calcell calhead">${x}</div>`);for(let i=0;i<first;i++)h+='<div class="calcell"></div>';for(let d=1;d<=days;d++){const k=dayKey(new Date(y,m,d)),s=dayScore(k),cls=s>=6?'dg':s>0?'dy':k<dayKey()?'dr':'';h+=`<div class="calcell ${cls}"><b>${d}</b><span>${s.toFixed(1)}</span></div>`}h+='</div>';$('calendar').innerHTML=h}
function drawChart(){const c=$('activityChart'),r=c.getBoundingClientRect(),w=Math.max(320,r.width),h=260,dpr=devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);const vals=[];for(let i=29;i>=0;i--)vals.push(dayScore(dayKey(addDays(new Date(),-i))));const max=Math.max(8,...vals);ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--gold');ctx.lineWidth=3;ctx.beginPath();vals.forEach((v,i)=>{const x=18+i*(w-36)/29,y=h-25-(v/max)*(h-45);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
function renderHeatmap(){const box=$('heatmap');box.innerHTML='';for(let i=363;i>=0;i--){const s=dayScore(dayKey(addDays(new Date(),-i))),d=document.createElement('div');d.className='heat '+(s>=10?'l4':s>=6?'l3':s>=2?'l2':s>0?'l1':'');d.title=dayKey(addDays(new Date(),-i));box.appendChild(d)}}
function renderConstellation(){const done=new Set();state.entries.forEach(e=>{if(!e.hasBeenEvaluated)return;surahs.forEach((s,i)=>{if(e.label.includes(s))done.add(i)})});$('constellation').innerHTML=surahs.map((s,i)=>`<div class="cstar ${done.has(i)?'on':''}" title="${s}">★</div>`).join('')}
function renderAnalytics(){const days=Object.keys(state.dailyLog),reviews=days.reduce((n,k)=>n+(state.dailyLog[k]?.review||0),0),focus=state.focusMin||0;$('analytics').innerHTML=`<div class="schedule-day">متوسط التركيز لكل ورد<br><b>${(focus/Math.max(1,state.entries.length)).toFixed(1)} دقيقة</b></div><div class="schedule-day">إجمالي المراجعات<br><b>${reviews}</b></div><div class="schedule-day">أيام النشاط<br><b>${days.length}</b></div><div class="schedule-day">أفضل سلسلة<br><b>${state.streak} يوم</b></div>`}
function renderMistakes(){const list=state.mistakes||[];$('mistakesList').innerHTML=list.length?list.map((m,i)=>`<div class="schedule-day"><div class="row" style="justify-content:space-between"><strong>${esc(m.title)}</strong><button class="action danger" onclick="deleteMistake(${i})">✕</button></div><div class="small">${esc(m.text)}</div></div>`).join(''):'<div class="muted">لا توجد ملاحظات بعد.</div>';$('mistakeFormList').innerHTML=list.map((m,i)=>`<div class="schedule-day"><strong>${esc(m.title)}</strong><div class="small">${esc(m.text)}</div></div>`).join('')}
function deleteMistake(i){state.mistakes.splice(i,1);save();renderProgress()}
function saveMistake(){const t=$('mistakeTitle').value.trim(),x=$('mistakeText').value.trim();if(!t||!x)return toast('اكتب العنوان والملاحظة');state.mistakes.unshift({title:t,text:x,type:'ملاحظة',date:dayKey()});save();$('mistakeTitle').value='';$('mistakeText').value='';renderMistakes()}
async function fetchStudyVerses(refs){const cache=state.studyCache||{};const out=[];for(const ref of refs){const key=ref.page?`page:${ref.page}`:`ayah:${ref.sura}:${ref.aya}`;let j=cache[key];if(!j&&navigator.onLine){try{const url=ref.page?`https://api.alquran.cloud/v1/page/${ref.page}/quran-uthmani`:`https://api.alquran.cloud/v1/ayah/${ref.sura}:${ref.aya}/quran-uthmani`;const r=await fetch(url);j=await r.json();cache[key]=j;state.studyCache=cache;save()}catch{}}if(j?.data?.ayahs)j.data.ayahs.slice(0,30).forEach(a=>out.push({sura:a.surah.number,aya:a.numberInSurah,text:a.text,ref:`${a.surah.name} — ${a.numberInSurah}`}));else if(j?.data)out.push({sura:j.data.surah?.number||ref.sura,aya:j.data.numberInSurah||ref.aya,text:j.data.text,ref:`${surahs[(j.data.surah?.number||ref.sura)-1]||'السورة'}: ${j.data.numberInSurah||ref.aya}`})}return out}
function parseStudyRefs(label){const s=label.replace(/[أإآ]/g,'ا');let sura=-1;surahs.forEach((x,i)=>{if(sura<0&&s.includes(x.replace(/[أإآ]/g,'ا')))sura=i+1});const range=s.match(/(?:آيات|ايات|اية|آية)\s*(\d+)\s*(?:-|–|—|الى|إلى)\s*(\d+)/);if(range)return Array.from({length:Math.min(12,Math.abs(+range[2]-+range[1])+1)},(_,i)=>({sura,aya:Math.min(+range[1],+range[2])+i}));const one=s.match(/(?:آية|اية|آيه|ايه)\s*(\d+)/);if(one&&sura>0)return[{sura,aya:+one[1]}];const page=s.match(/(?:صفحة|صفحه|ص)\s*(\d+)/);if(page)return[{page:+page[1]}];return sura>0?[{sura,aya:1}]:[]}
const LTR='ءابةتثجحخدذرزسشصضطظعغفقكلمنهويٱ';const heavy=new Set('خصضغطقظ'.split(''));const qalq=new Set('قطبجد'.split(''));function splitGraphemes(text){const out=[];let cur=null;for(const ch of String(text||'')){if(/[ء-يٱ]/.test(ch)){cur={b:ch,m:[],raw:ch};out.push(cur)}else if(/[ًٌٍَُِّْٰ]/.test(ch)&&cur){cur.m.push(ch);cur.raw+=ch}else if(/\s/.test(ch))out.push({space:true,raw:ch});else out.push({punct:true,raw:ch})}return out}
function prevG(t,i){for(let j=i-1;j>=0;j--)if(!t[j].space&&!t[j].punct)return j;return -1}function nextG(t,i){for(let j=i+1;j<t.length;j++)if(!t[j].space&&!t[j].punct)return j;return -1}
function haraka(m){
if(m.includes('َ'))return'فتحة — صوت قصير «ـَ»';
if(m.includes('ُ'))return'ضمة — صوت قصير «ـُ»';
if(m.includes('ِ'))return'كسرة — صوت قصير «ـِ»';
if(m.includes('ْ'))return'سكون — لا حركة بعد الحرف';
if(m.includes('ّ'))return'شدة — الحرف يُنطق قويًا/مكرر البنية';
if(m.includes('ٰ'))return'علامة ألف صغيرة فوق الحرف — مدّ صوت الألف في النطق';
if(m.includes('ً'))return'تنوين فتح — صوت «ـً» في الوصل';
if(m.includes('ٌ'))return'تنوين ضم — صوت «ـٌ» في الوصل';
if(m.includes('ٍ'))return'تنوين كسر — صوت «ـٍ» في الوصل';
return'لا حركة مكتوبة على هذا الحرف';}

function firstNonSpace(t,start){for(let j=start;j<t.length;j++)if(!t[j].space&&!t[j].punct)return j;return-1}
function nextWordStart(t,i){let seen=false;for(let j=i+1;j<t.length;j++){if(t[j].space){seen=true;continue}if(t[j].punct)continue;if(seen)return j;}return-1}
function wordRanges(text){const t=splitGraphemes(text),ranges=[];let s=-1;for(let i=0;i<t.length;i++){if(t[i].space||t[i].punct){if(s>=0){ranges.push([s,i-1]);s=-1}}else if(s<0)s=i}if(s>=0)ranges.push([s,t.length-1]);return{t,ranges}}
function connectedRule(prevWord,lastIndex,nextWord,firstIndex,t){const rules=[];const add=x=>{if(!rules.includes(x))rules.push(x)};const a=t[lastIndex],b=t[firstIndex];if(!a||!b)return rules;const nb=b.b;const isTan=a.m.some(x=>['ً','ٌ','ٍ'].includes(x));
if(a.b==='ن'&&(a.m.includes('ْ')||isTan)){if('ءأإٱهـعحغخ'.includes(nb))add('الإظهار الحلقي');else if('ينمو'.includes(nb))add('الإدغام بغنة');else if('لر'.includes(nb))add('الإدغام بغير غنة');else if(nb==='ب')add('الإقلاب');else if('تثجدذزسشصضطظفقك'.includes(nb))add('الإخفاء الحقيقي')}
if(a.b==='م'&&a.m.includes('ْ')){if(nb==='ب')add('الإخفاء الشفوي');else if(nb==='م')add('الإدغام الشفوي');else add('الإظهار الشفوي')}
if(nb==='ٱ')add('همزة الوصل');
if(a.b==='ه'&&/[ُِ]/.test(a.m) && !a.m.includes('ْ'))add('صلة هاء الضمير — تحقق من شروط الصلة في هذا الموضع');
return rules}
function simpleLetterInstruction(g,rules){
const base=g.b;const h=haraka(g.m);let action=`انطق «${base}» مع ${h}.`;
if(g.m.includes('ّ'))action+=' الشدة تعني أن الحرف أقوى وفيه تكرار بنيوي للحرف، فلا تفكك النطق إلى حرفين منفصلين.';
if(g.m.includes('ٰ'))action+=' لا تقل «ألف خنجرية» أثناء القراءة؛ هذه فقط اسم العلامة. اقرأ صوت الألف الطويل كما تسمعه في التلاوة.';
if(rules.includes('غنة النون المشددة')||rules.includes('غنة الميم المشددة'))action+=' هنا يوجد صوت غنة من الخيشوم بمقدار حركتين.';
if(rules.includes('القلقلة'))action+=' أظهر ارتداد الحرف الساكن من غير إضافة حركة جديدة.';
if(rules.some(r=>r.includes('مد')))action+=' اجعل المد ممتدًا بالقدر الخاص بالحكم، وتعلّم المقدار بالسماع والتلقي.';
return action}
function simpleConnectionInstruction(word,nextWord,rules){
if(!nextWord)return`لا توجد كلمة بعدها داخل هذا المقطع. عند الوقف هنا: اقرأ نهاية الكلمة بحسب علامة الوقف وحكم الوقف.`;
if(!rules.length)return`عند الوصل: أكمل آخر صوت من «${word}» إلى أول صوت من «${nextWord}» من غير قطع بين الكلمتين. اسمع النموذج ثم قلده ببطء مرة، ثم بسرعة طبيعية.`;
return`عند الوصل بين «${word}» و«${nextWord}»: ${rules.map(r=>tajRules[r]||r).join(' ')} اسمع الكلمتين معًا، ثم قلدهما ببطء، ثم أعدهما بالنطق الطبيعي.`}
function renderBeginnerWordStudy(text){const {t,ranges}=wordRanges(text);let inspector='';const rows=ranges.map((rg,wi)=>{const word=t.slice(rg[0],rg[1]+1).map(x=>x.raw).join('');const nextRg=ranges[wi+1];const nextWord=nextRg?t.slice(nextRg[0],nextRg[1]+1).map(x=>x.raw).join(''):'';const bridge=nextRg?connectedRule(word,rg[1],nextWord,nextRg[0],t):[];const letters=t.slice(rg[0],rg[1]+1);let chips=letters.map((g,li)=>{const idx=rg[0]+li;const rs=tajweedFor(t,idx);const data=`data-gidx="${idx}" data-word-index="${wi}" data-next-word="${esc(nextWord)}" data-letter="${esc(g.b)}" data-haraka="${esc(haraka(g.m))}" data-rules="${esc(rs.join('، '))}"`;return`<button type="button" class="taj-letter-chip" ${data}>${esc(g.raw)}</button>`}).join('');return`<div class="taj-word-line"><div class="taj-word-main">${esc(word)}<small>اضغط على أي حرف داخل الكلمة</small></div><div class="taj-word-explain"><div><b>النطق كلمةً كلمة:</b> ابدأ من أول حرف بالحركة الموجودة عليه، ثم أكمل بقية الحروف كما تظهر أمامك.</div><div class="taj-letter-grid">${chips}</div>${nextWord?`<div class="connection"><b>الوصل مع الكلمة التالية «${esc(nextWord)}»:</b><br>${esc(simpleConnectionInstruction(word,nextWord,bridge))}</div>`:''}</div></div>`}).join('');return `<div class="taj-word-study">${rows}</div><div id="tajInspector" class="taj-inspector-panel"><h4>👂 شرح الحرف والنطق</h4><div class="muted">اضغط على حرف من أي كلمة، وسيظهر هنا: ما هو الحرف، حركته، كيف تنطقه ببساطة، وما الحكم التجويدي الذي رصده محلل التطبيق.</div></div>`}
function tajweedFor(t,i){const g=t[i],rules=[];if(!g||g.space||g.punct)return rules;const p=prevG(t,i),n=nextG(t,i),nb=n>=0?t[n].b:'';const add=x=>{if(!rules.includes(x))rules.push(x)};if(g.b==='ن'&&(g.m.includes('ْ')||g.m.some(x=>['ً','ٌ','ٍ'].includes(x)))){if('ءأإٱهـعحغخ'.includes(nb))add('الإظهار الحلقي');else if('ينمو'.includes(nb))add('الإدغام بغنة');else if('لر'.includes(nb))add('الإدغام بغير غنة');else if(nb==='ب')add('الإقلاب');else if('تثجدذزسشصضطظفقك'.includes(nb))add('الإخفاء الحقيقي')}
if(g.b==='م'&&g.m.includes('ْ')){if(nb==='ب')add('الإخفاء الشفوي');else if(nb==='م')add('الإدغام الشفوي');else add('الإظهار الشفوي')}
if(g.b==='ن'&&g.m.includes('ّ'))add('غنة النون المشددة');if(g.b==='م'&&g.m.includes('ّ'))add('غنة الميم المشددة');if(qalq.has(g.b)&&g.m.includes('ْ'))add('القلقلة');if(g.b==='ل'&&p<0){}if(heavy.has(g.b))add('تفخيم حروف الاستعلاء');if(g.b==='ٱ')add('همزة الوصل');if('أإؤئ'.includes(g.b))add('همزة القطع');if(g.m.includes('ٰ'))add('الألف الخنجرية');if(g.b==='و'||g.b==='ي'){if(g.m.includes('ْ')&&p>=0&&t[p].m.includes('َ'))add('مد اللين');if(g.b==='و'&&p>=0&&t[p].m.includes('ُ'))add('المد الطبيعي');if(g.b==='ي'&&p>=0&&t[p].m.includes('ِ'))add('المد الطبيعي')}if(g.b==='ا'&&p>=0&&t[p].m.includes('َ'))add('المد الطبيعي');if(g.b==='ر'){if(g.m.includes('ِ'))add('ترقيق الراء');else if(g.m.includes('َ')||g.m.includes('ُ'))add('تفخيم الراء')}return rules}
function renderStudy(){if(!currentStudy)return;const byTab=currentStudyTab;const tabs=[['all','✨ الكل'],['tajweed','🎙️ جوّد حفظك'],['tafsir','📖 التفسير'],['words','🔎 الكلمات'],['asbab','🕊️ أسباب النزول']];let html=`<div class="study-panel"><b style="color:var(--gold)">${esc(currentStudy.label)}</b><div class="muted">اختر أي حرف أو كلمة للتفصيل. التحليل الآلي إرشادي، ولا يغني عن التلقي الصحيح.</div></div>`;if(byTab==='all'||byTab==='tajweed')html+=renderTajweedHTML();if(byTab==='all'||byTab==='tafsir')html+=renderTafsirHTML();if(byTab==='all'||byTab==='words')html+=renderWordsHTML();if(byTab==='all'||byTab==='asbab')html+=renderAsbabHTML();html+=renderRecitationHTML();$('studyBody').innerHTML=html;bindTajweedClicks()}
function renderTajweedHTML(){if(!currentVerses.length)return'';const all=new Set();const verseHTML=currentVerses.map(v=>{const t=splitGraphemes(v.text);let h='';t.forEach((g,i)=>{if(g.space||g.punct){h+=esc(g.raw);return}const rules=tajweedFor(t,i);rules.forEach(r=>all.add(r));const next=nextG(t,i),m=haraka(g.m);h+=`<span class="taj-letter" data-gidx="${i}" data-char="${esc(g.b)}" data-h="${esc(m)}" data-pron="${esc(simpleLetterInstruction(g,rules))}" data-rules="${esc(rules.join('، '))}">${esc(g.raw)}</span>`});return`<div class="study-panel"><div class="study-compare-ref">${esc(v.ref)}</div><div class="taj-character-verse">${h}</div><div style="margin-top:12px"><b style="color:var(--gold)">الكلمات والوصلة بينها</b>${renderBeginnerWordStudy(v.text)}</div></div>`}).join('');return`<section class="study-panel"><h3 style="color:var(--gold)">🎙️ تعلّم التجويد خطوة بخطوة</h3><div class="taj-beginner-guide"><h4>نبدأ من الصفر — من الحرف إلى الآية</h4><p>لا تحتاج أن تعرف أسماء القواعد مسبقًا. اضغط على الحرف لتعرف <b>الحركة → طريقة النطق → الحكم → ماذا تفعل بصوتك</b>.</p><div class="taj-flow"><div class="taj-flow-step"><b>١ — الحرف</b><span>انظر للحرف وحده ومعه حركته، وقل صوته ببطء.</span></div><div class="taj-flow-step"><b>٢ — الكلمة</b><span>اضغط أحرف الكلمة بالترتيب، ثم اقرأ الكلمة كاملة بلا تقطيع.</span></div><div class="taj-flow-step"><b>٣ — الوصل</b><span>اقرأ الكلمة مع التي بعدها؛ التطبيق يوضح الحكم عند نقطة الانتقال بينهما.</span></div></div><div class="taj-source-line">تنبيه: التحليل الآلي يساعدك على رؤية المواضع، لكنه لا يثبت صحة الأداء وحده. التجويد علم أداء، وأصل التلقي فيه المشافهة والسماع من قارئ متقن.</div></div>${verseHTML}<div class="study-panel" style="margin-top:10px"><h3 style="color:var(--gold)">📚 ماذا رأيت في هذه الآية؟</h3><div class="study-rule-grid">${[...all].map(r=>`<div class="taj-rule-card"><b>${esc(r)}</b><p>${esc(tajRules[r]||'شرح مبسط متاح لهذا الحكم.')}</p></div>`).join('')||'<div class="muted">لم يظهر حكم آلي إضافي في هذا المقطع.</div>'}</div></div></section>`}

function showTajInspector(el){const idx=Number(el.dataset.gidx||-1);const p=el.closest('.study-panel');const verseEl=el.closest('.taj-character-verse');const text=currentVerses.find(v=>verseEl?.parentElement?.querySelector('.study-compare-ref')?.textContent?.includes(v.ref))?.text||'';const t=splitGraphemes(text);const g=t[idx];if(!g)return;const rules=tajweedFor(t,idx);const next=nextG(t,idx),nextWordIdx=nextWordStart(t,idx);let nextWord='';if(nextWordIdx>=0){let arr=[];for(let j=nextWordIdx;j<t.length&&!t[j].space&&!t[j].punct;j++)arr.push(t[j].raw);nextWord=arr.join('')}const wordStart=(()=>{for(let j=idx;j>=0;j--){if(t[j]?.space||t[j]?.punct)return j+1}return 0})();let wordEnd=idx;while(wordEnd+1<t.length&&!t[wordEnd+1].space&&!t[wordEnd+1].punct)wordEnd++;const word=t.slice(wordStart,wordEnd+1).map(x=>x.raw).join('');const bridge=nextWord?connectedRule(word,wordEnd,nextWord,nextWordIdx,t):[];const box=p?.querySelector('#tajInspector');if(!box)return;box.innerHTML=`<h4>👂 حرف «${esc(g.raw)}»</h4><div class="big">${esc(g.raw)}</div><div class="simple"><b>الحركة:</b> ${esc(haraka(g.m))}</div><div class="simple"><b>كيف تنطقه؟</b> ${esc(simpleLetterInstruction(g,rules))}</div><div class="simple"><b>الحكم الذي ظهر هنا:</b> ${esc(rules.join('، ')||'لا يظهر حكم إضافي واضح من التحليل الآلي')}</div>${rules.length?`<div class="connection"><b>شرح بسيط:</b><br>${esc(rules.map(r=>tajRules[r]||r).join(' '))}</div>`:''}${nextWord?`<div class="connection"><b>وعند الوصل بـ «${esc(nextWord)}»:</b><br>${esc(simpleConnectionInstruction(word,nextWord,bridge))}</div>`:''}`;p.querySelectorAll('.taj-letter,.taj-letter-chip').forEach(x=>x.classList.remove('selected','active'));el.classList.add(el.classList.contains('taj-letter-chip')?'active':'selected')}
function bindTajweedClicks(){document.querySelectorAll('.taj-letter').forEach(el=>el.onclick=()=>showTajInspector(el));document.querySelectorAll('.taj-letter-chip').forEach(el=>el.onclick=()=>showTajInspector(el));document.querySelectorAll('.study-tab').forEach(b=>b.onclick=()=>{currentStudyTab=b.dataset.tab;renderStudy();});document.querySelectorAll('[data-play-study]').forEach(b=>b.onclick=()=>{const [s,a]=b.dataset.playStudy.split(':').map(Number);playAyahByReciter(s,a)})}

function recommend(){const feel=$('feelSelect').value,age=$('ageGroup').value,role=$('roleSelect').value;const map={'أشعر بالتشتت':'ابدأ بجلسة تركيز 15 دقيقة + آية واحدة + مراجعة ورد واحد فقط.','متأخر وأريد الاستدراك':'ابدأ من اليوم؛ لا تنتظر الإجازة. خفّف مقدار الجديد وارفع جودة المراجعة.','أحتاج تثبيت الحفظ':'ارجع إلى 10 تكرارات غيبًا + التثبيت اليومي 7 أيام + كشكول المتشابهات.','أريد أن أتعلم التجويد':'ابدأ بالإظهار والإدغام والإخفاء والقلقلة والمد الطبيعي، ثم طبّق على وردك حرفًا حرفًا.','أريد فقهًا أساسيًا':'ابدأ بمالا يسع المسلم جهله وبفقه الطهارة والصلاة وحقوق الناس.','أحتاج دافعًا':'لا تحاول أن تحفظ صفحة كاملة في جلسة واحدة؛ آية ثابتة كل يوم خير من خطة مثالية متروكة.'};$('recommendation').innerHTML=`<b>مناسب لك كـ${age} ${role}</b><p>${map[feel]||map['أحتاج دافعًا']}</p><div class="small">اقتراح بحث: ${feel} القرآن حفظ ${role}</div>`}
function playAmbient(){const a=$('splashAudio');const v=getDailyVerse();a.src=recitationUrl(v.s,v.a,state.reciter);a.loop=true;a.volume=state.volume;a.play().then(()=>{state.ambient=true;save();$('ambientQuranBtn').textContent='⏹ إيقاف القرآن الهادئ'}).catch(()=>toast('اضغط تشغيل بعد السماح للصوت'));}
function stopAmbient(){const a=$('splashAudio');a.pause();a.loop=false;state.ambient=false;save();$('ambientQuranBtn').textContent='▶ قرآن هادئ'}
function noiseStart(type){if(noise){noise.close();noise=null;return}const A=window.AudioContext||window.webkitAudioContext;if(!A)return;noise=new A();const b=noise.createBuffer(1,noise.sampleRate*2,noise.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;last=type==='brown'?last+.06*w:w;d[i]=type==='brown'?last*.45:w*.16}const s=noise.createBufferSource();s.buffer=b;s.loop=true;const f=noise.createBiquadFilter();f.type='lowpass';f.frequency.value=type==='brown'?500:1800;const g=noise.createGain();g.gain.value=type==='brown'?.06:.025;s.connect(f).connect(g).connect(noise.destination);s.start()}
function startFocus(){if(timeLeft<=0)return toast('اختر مدة أولًا');$('breathBox').style.display='block';$('timerBox').style.display='none';$('breatheCircle').style.animation='breatheIn 2s forwards';$('breathText').textContent='شهيق…';setTimeout(()=>{$('breatheCircle').style.animation='breatheOut 2s forwards';$('breathText').textContent='زفير…'},2000);setTimeout(()=>{$('breathText').textContent='استعن بالله';setTimeout(()=>{$('breathBox').style.display='none';$('timerBox').style.display='block';runTimer()},3500)},4000)}
function runTimer(){clearInterval(timer);focusStarted=Date.now();timer=setInterval(()=>{timeLeft--;renderTimer();if(timeLeft<=0){clearInterval(timer);const mins=Math.max(1,Math.round((Date.now()-focusStarted)/60000));state.focusMin+=mins;logActivity('focus',mins);markActive();save();beep('done');haptic('done');toast('انتهت جلسة التركيز ✅');closeModal('focusModal')}},1000);}
function renderTimer(){$('timer').textContent=`${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(timeLeft%60).padStart(2,'0')}`}
function shareImage(){const c=$('shareCanvas'),ctx=c.getContext('2d');c.width=1200;c.height=760;const g=ctx.createLinearGradient(0,0,1200,760);g.addColorStop(0,'#07100b');g.addColorStop(1,'#193025');ctx.fillStyle=g;ctx.fillRect(0,0,1200,760);ctx.fillStyle='#d4af37';ctx.textAlign='center';ctx.font='700 58px Tajawal';ctx.fillText('فضل الله عليّ',600,120);ctx.fillStyle='#fff';ctx.font='700 46px Tajawal';ctx.fillText(state.name||'رفيق القرآن',600,210);ctx.fillText(`🔥 ${state.streak} يوم التزام`,600,320);ctx.fillText(`📖 ${fmt(state.entries.reduce((n,e)=>n+(e.baseLetters||0)*(e.totalReps||0),0))} حرف مقروء`,600,400);ctx.fillStyle='#9aa99c';ctx.font='30px Tajawal';ctx.fillText('رحلة مستمرة مع كتاب الله',600,520);ctx.fillStyle='#d4af37';ctx.font='700 28px Tajawal';ctx.fillText('رفيق القرآن',600,660);openModal('shareModal')}
function downloadShare(){const a=document.createElement('a');a.href=$('shareCanvas').toDataURL('image/png');a.download=`Rafiq_${dayKey()}.png`;a.click()}
async function nativeShare(){if(!navigator.share)return downloadShare();try{const b=await new Promise(r=>$('shareCanvas').toBlob(r,'image/png'));await navigator.share({title:'رفيق القرآن',text:'فضل الله عليّ 🤲',files:[new File([b],`Rafiq_${dayKey()}.png`,{type:'image/png'})]})}catch{}}
function printReport(){const pct=state.goal?Math.min(100,estimateProgress()/state.goal*100):0;const stars=[...Array(36)].map((_,i)=>`<span class="paper-star" style="left:${(i*37)%96}%;top:${(i*53)%92}%;font-size:${8+(i%4)*2}px">✦</span>`).join('');const entries=state.entries.slice(0,40).map(e=>`<div class="paper-werd"><div><b style="color:#f0d77a">${esc(e.label)}</b><div style="color:#93a097;font-size:10px">التالي: ${esc(e.nextReviewDate)}</div></div><div class="paper-mini">تكرارات ${e.totalReps||0}</div><div class="paper-mini">مراجعات ${e.reviewCount||0}</div></div>`).join('')||'<div class="small">لا توجد أوراد.</div>';$('printSheet').innerHTML=`<div class="paper-bg">${stars}<div class="paper-mist" style="width:440px;height:440px;right:-100px;top:-130px;background:radial-gradient(circle,rgba(212,175,55,.14),transparent 68%)"></div><div class="paper-mist" style="width:360px;height:360px;left:-100px;bottom:-120px;background:radial-gradient(circle,rgba(73,167,92,.08),transparent 68%)"></div><div class="paper-lamp" style="right:7%;top:-3%"><span class="wire"></span><span class="body">💡</span><span class="light"></span></div><div class="paper-lamp" style="left:10%;top:6%;transform:scale(.7);opacity:.55"><span class="wire"></span><span class="body">💡</span><span class="light"></span></div></div><div class="paper-page"><div class="paper-title">رفيق القرآن</div><div class="paper-subtitle">نسخة ورقية ثابتة بنفس الهوية البصرية</div><div class="paper-user">${esc(state.name||'مستخدم رفيق القرآن')}</div><div class="paper-section"><h3>🎯 الهدف</h3><div class="grid2"><div><div class="paper-grid"><div class="paper-stat"><b>${state.streak}</b>🔥 يوم</div><div class="paper-stat"><b>${state.entries.length}</b>📋 ورد</div><div class="paper-stat"><b>${state.entries.reduce((n,e)=>n+(e.reviewCount||0),0)}</b>✅ مراجعة</div><div class="paper-stat"><b>${fmt(state.entries.reduce((n,e)=>n+(e.baseLetters||0)*(e.totalReps||0),0))}</b>📖 حرف</div></div><div style="margin-top:10px">الهدف: <b style="color:#e8d37b">${state.goal} ${esc(state.goalUnit)}</b></div></div><div><div class="paper-ring" style="--pct:${pct}%"><span>${pct.toFixed(0)}%</span></div></div></div></div><div class="paper-section"><h3>📋 قائمة اليوم</h3><div class="paper-checks"><div class="paper-check">□ مراجعات مستحقة اليوم</div><div class="paper-check">□ الحفظ الجديد</div><div class="paper-check">□ 10 تكرارات غيبًا</div><div class="paper-check">□ تثبيت اليوم</div><div class="paper-check">□ فهم المعنى والتفسير</div><div class="paper-check">□ التسميع والمقارنة</div></div></div><div class="paper-section"><h3>📚 سجل الأوراد</h3>${entries}</div><div class="paper-section"><h3>🌿 المنهجية</h3><div class="paper-method">${method.map(m=>`<div><strong>${m[0]} — ${m[1]}</strong><p>${m[2]}</p></div>`).join('')}</div></div><div class="paper-section"><h3>🕌 اليوم الإيماني</h3><div class="paper-checks"><div class="paper-check">□ الفجر</div><div class="paper-check">□ الظهر</div><div class="paper-check">□ العصر</div><div class="paper-check">□ المغرب</div><div class="paper-check">□ العشاء</div><div class="paper-check">□ الشفع والوتر</div><div class="paper-check">□ قيام الليل / الاستغفار</div><div class="paper-check">□ دعاء وخلوة مع القرآن</div></div></div><div class="paper-section"><h3>🧩 المتشابهات والزلات</h3>${state.mistakes.length?state.mistakes.map(m=>`<div class="paper-check"><b>${esc(m.title)}</b><br>${esc(m.text)}</div>`).join(''):'لا توجد ملاحظات محفوظة.'}</div><div class="paper-footer">هذا الإصدار الورقي مصمم للاستخدام اليدوي. الأرقام الخاصة بالحروف والحسنات تقديرية للتحفيز، والقبول والأجر عند الله والله أعلم بهما.</div></div>`;window.print()}
function openRecorder(id){const e=state.entries.find(x=>x.id===id);if(!e)return;$('recordTarget').textContent=e.label;$('recordPlayback').style.display='none';$('recordStatus').textContent='اضغط للبدء';$('recordBtn').textContent='🎤';openModal('recorderModal')}
async function toggleRecorder(){if(recording?.state==='recording'){recording.stop();return}if(!navigator.mediaDevices?.getUserMedia)return toast('التسجيل يحتاج HTTPS أو localhost');try{const s=await navigator.mediaDevices.getUserMedia({audio:true});recording=new MediaRecorder(s);const chunks=[];recording.ondataavailable=e=>e.data.size&&chunks.push(e.data);recording.onstop=()=>{const b=new Blob(chunks,{type:recording.mimeType||'audio/webm'});if(recordUrl)URL.revokeObjectURL(recordUrl);recordUrl=URL.createObjectURL(b);$('recordPlayback').src=recordUrl;$('recordPlayback').style.display='block';$('recordStatus').textContent='استمع لتسجيلك ثم قارن بالمصحف';s.getTracks().forEach(t=>t.stop());$('recordBtn').textContent='🎤'};recording.start();$('recordBtn').textContent='⏹';$('recordStatus').textContent='جارٍ التسجيل…'}catch{toast('اسمح للمتصفح باستخدام الميكروفون')}
}
function exportJSON(){const a=document.createElement('a');a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(state));a.download=`Rafiq_Backup_${dayKey()}.json`;a.click();toast('تم أخذ النسخة الاحتياطية ✅')}
function importJSON(file){const r=new FileReader();r.onload=e=>{try{stateManager.replace(JSON.parse(e.target.result));location.reload()}catch{toast('ملف غير صالح')}};r.readAsText(file)}
function resetApp(){if(prompt('اكتب مسح للتأكيد:')!=='مسح')return;localStorage.clear();location.reload()}
async function locate(){if(!navigator.geolocation)return toast('الموقع غير مدعوم');navigator.geolocation.getCurrentPosition(p=>{state.lat=p.coords.latitude;state.lon=p.coords.longitude;save();refreshPrayer()},()=>toast('تعذر الحصول على موقعك'))}

/* V26 — Full Mushaf engine: bundled Uthmani text, cached tafsir/word meanings, verse study */
let quranBook=null, mushafSura=1, mushafSelected=null, mushafTab='overview';
const quranCache={tafseer:{},words:{}};
const QURAN_BASE='quran-uthmani.json';
function normalizeQuranText(s){return String(s||'').replace(/ٱ/g,'ا').replace(/ـ/g,'');}
async function loadQuranBook(){
  if(quranBook)return quranBook;
  const sources=[QURAN_BASE,'https://api.alquran.cloud/v1/quran/quran-uthmani'];
  for(const url of sources){
    try{
      const r=await fetch(url,{cache:url===QURAN_BASE?'force-cache':'no-store'});
      if(!r.ok)continue;
      const raw=await r.json();
      const data=raw?.data?.surahs||raw?.surahs||raw;
      if(Array.isArray(data)&&data.length){
        quranBook=data.map((s,i)=>({s:s.number||s.s||i+1,name:s.name||surahs[i],type:s.revelationType||s.type||'',count:s.numberOfAyahs||s.count||s.ayahs?.length||0,verses:(s.ayahs||s.verses||[]).map((a,j)=>({a:a.numberInSurah||a.verse_number||a.a||j+1,text:a.text||a.text_uthmani||''}))}));
        return quranBook;
      }
    }catch{}
  }
  toast('تعذر تحميل بيانات المصحف؛ تحقق من الاتصال بالإنترنت.');
  return null;
}
function quranStorageKey(type,s,a){return `rq-${type}-${s}-${a}`}
function loadCache(type,s,a){try{return localStorage.getItem(quranStorageKey(type,s,a))||''}catch{return ''}}
function saveCache(type,s,a,text){try{localStorage.setItem(quranStorageKey(type,s,a),text)}catch{}}
function tajweedRulesForText(text){const t=splitGraphemes(text),out=[];for(let i=0;i<t.length;i++){if(t[i].space||t[i].punct){out.push([]);continue}out.push(tajweedFor(t,i))}return {graphemes:t,rules:out}}
function tajRuleDetail(r){return tajRules[r]||'حكم تجويدي يحتاج إلى ضبط الموضع وسياق الحرف، ويُفضّل سماعه من قارئ متقن.'}
function mushafSurahButton(s){return `<button class="mushaf-surah-btn ${mushafSura===s.s?'active':''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${s.type} • ${s.count}</span></button>`}
async function renderMushafList(){const b=await loadQuranBook();if(!b)return;const q=($('mushafSearch')?.value||'').trim();const list=b.filter(s=>!q||s.name.includes(q)||String(s.s)===q);$('mushafSurahList').innerHTML=list.map(mushafSurahButton).join('');document.querySelectorAll('.mushaf-surah-btn').forEach(x=>x.onclick=()=>{mushafSura=+x.dataset.sura;renderMushafList();renderMushafSurah()})}
function mushafSourceLinks(s,a){return `<div class="source-badges"><a href="https://quranenc.com/ar/browse/arabic_moyassar/${s}/${a}" target="_blank" rel="noopener">📖 التفسير الميسر — QuranEnc</a><a href="https://quranenc.com/ar/browse/arabic_seraj/${s}/${a}" target="_blank" rel="noopener">🔎 معاني الكلمات — السراج</a><a href="https://corpus.quran.com/wordbyword.jsp?chapter=${s}&verse=${a}" target="_blank" rel="noopener">🧩 التحليل اللغوي — Quranic Corpus</a></div>`}
function renderMushafSurah(){if(!quranBook)return;const s=quranBook.find(x=>x.s===mushafSura)||quranBook[0];mushafSelected=null;$('mushafSurahTitle').textContent=s.name;$('mushafSurahMeta').textContent=`${s.s} • ${s.type} • ${s.count} آيات`;$('mushafPrev').disabled=s.s===1;$('mushafNext').disabled=s.s===114;$('mushafVerses').innerHTML=s.verses.map(v=>`<article class="mushaf-ayah" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${s.name} — الآية ${v.a} — رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button class="action info" data-study-ayah="${v.a}">🔍 دراسة الآية</button><button class="action" data-audio-ayah="${v.a}">🔊 استماع</button></div></article>`).join('');document.querySelectorAll('[data-study-ayah]').forEach(b=>b.onclick=()=>openAyahStudy(s.s,+b.dataset.studyAyah));document.querySelectorAll('[data-audio-ayah]').forEach(b=>b.onclick=()=>playAyahByReciter(s.s,+b.dataset.audioAyah));}
async function playAyahByReciter(s,a){const au=new Audio(recitationUrl(s,a,state.reciter));au.volume=state.volume;await au.play().catch(()=>toast('اضغط مرة أخرى لتشغيل الصوت'))}
async function fetchVerseMeta(s,a){const key=`${s}:${a}`;let taf=loadCache('tafseer',s,a),word=loadCache('words',s,a);if(taf&&word)return {taf,word};$('mushafLoading').style.display='block';try{if(!taf){const r=await fetch(`https://quranenc.com/api/v1/translation/aya/arabic_moyassar/${s}/${a}`,{cache:'no-store'});if(r.ok){const j=await r.json();taf=j?.result?.translation||j?.data?.translation||j?.translation||'';if(taf)saveCache('tafseer',s,a,taf)}}if(!word){const r=await fetch(`https://quranenc.com/api/v1/translation/aya/arabic_seraj/${s}/${a}`,{cache:'no-store'});if(r.ok){const j=await r.json();word=j?.result?.translation||j?.data?.translation||j?.translation||'';if(word)saveCache('words',s,a,word)}}}catch{}finally{$('mushafLoading').style.display='none'}return {taf:taf||'التفسير الميسر يحتاج اتصالًا لأول تحميل لهذه الآية؛ بعد التحميل يمكن الاحتفاظ به محليًا.',word:word||'معاني الكلمات تحتاج اتصالًا لأول تحميل لهذه الآية؛ بعد التحميل يمكن الاحتفاظ بها محليًا.'}}
function splitWordsArabic(text){return text.replace(/[ۖۗۚۙۛۜ۝﴿﴾]/g,'').split(/\s+/).filter(Boolean)}
async function openAyahStudy(s,a){const book=quranBook.find(x=>x.s===s),v=book?.verses.find(x=>x.a===a);if(!v)return;document.querySelectorAll('.mushaf-ayah').forEach(x=>x.classList.toggle('selected',+x.dataset.ayah===a));const meta=await fetchVerseMeta(s,a);const jt=tajweedRulesForText(v.text);const words=splitWordsArabic(v.text);const letterHtml=jt.graphemes.map((g,i)=>{if(g.space||g.punct)return esc(g.raw);const rs=jt.rules[i]||[];return `<span class="ayah-taj-letter" data-char="${esc(g.b)}" data-haraka="${esc(haraka(g.m))}" data-pron="${esc(g.b+(g.m.includes('َ')?'َ':g.m.includes('ُ')?'ُ':g.m.includes('ِ')?'ِ':''))}" data-rules="${esc(rs.join('، '))}" title="اضغط للتفصيل">${esc(g.raw)}</span>`}).join('');
$('ayahStudyPanel').style.display='block';$('ayahStudyPanel').innerHTML=`<div class="row" style="justify-content:space-between;gap:8px"><div><h3>📚 ${esc(book.name)} — الآية ${a}</h3><div class="muted">موسوعة الآية داخل المصحف: حرفًا حرفًا، كلمةً كلمةً، ثم الوصل بين الكلمات والمعنى والتفسير.</div></div><button class="action" id="closeAyahStudy">✕ إغلاق</button></div><div class="ayah-study-tabs"><button class="ayah-study-tab active" data-at="overview">✨ نظرة كاملة</button><button class="ayah-study-tab" data-at="taj">🎙️ التجويد الحرفي</button><button class="ayah-study-tab" data-at="words">🔎 الكلمات</button><button class="ayah-study-tab" data-at="tafsir">📖 التفسير</button><button class="ayah-study-tab" data-at="asbab">🕊️ أسباب النزول</button></div><div id="ayahStudyInner"></div>`;
$('closeAyahStudy').onclick=()=>{$('ayahStudyPanel').style.display='none';document.querySelectorAll('.mushaf-ayah').forEach(x=>x.classList.remove('selected'))};
const renderTab=()=>{const tab=mushafTab;let inner='';if(tab==='overview'){inner=`<div class="mushaf-note">📌 التصنيف المكي/المدني هنا مبني على التصنيف المشهور وقد توجد مسائل خلافية في بعض السور. أما سبب النزول فلا يُذكر إلا إذا توفر نقل موثق أو يُصرّح بعدم توفره.</div><div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(meta.taf)}</p></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>${esc(meta.word)}</p></section><section class="ayah-detail"><h4>🕊️ أسباب النزول</h4><p>${esc(asbab[`${s}:${a}`]||'لا توجد في قاعدة التطبيق المحلية رواية خاصة بهذه الآية. عدم وجود رواية هنا لا يعني الجزم بعدم وجود بحث في المصادر المتخصصة؛ يُرجع إلى كتب أسباب النزول عند الحاجة.')}</p></section><section class="ayah-detail"><h4>🏷️ معلومات السورة</h4><p>سورة ${esc(book.name)} — ${book.type} — عدد آياتها ${book.count}. ويمكن دراسة موضوعاتها من خلال التفسير المعتبر.</p></section></div><div style="margin-top:12px"><h4 style="color:#f0d77a">🎙️ التجويد</h4><div class="ayah-taj-verse">${letterHtml}</div></div>${mushafSourceLinks(s,a)}`;}
if(tab==='taj'){inner=`<div class="mushaf-note">🎙️ ابدأ من الحرف، ثم الكلمة، ثم الكلمتين معًا. اضغط على أي حرف لترى الحركة والنطق البسيط والحكم الذي رصده المحلل. لا تحتاج إلى حفظ أسماء القواعد قبل أن تفهم طريقة الأداء.</div><div class="taj-beginner-guide"><h4>كيف تدرس الآية؟</h4><p>١) اقرأ الحرف بالحركة. ٢) اقرأ الكلمة كاملة. ٣) صِلها بالكلمة التي بعدها. ٤) اسمع القارئ ثم قلد الأداء.</p></div><div class="ayah-taj-verse">${letterHtml}</div>${renderBeginnerWordStudy(v.text)}<div class="grid2" style="margin-top:12px">${[...new Set(jt.rules.flat())].map(r=>`<div class="ayah-detail"><h4>${esc(r)}</h4><p>${esc(tajRuleDetail(r))}</p></div>`).join('')||'<div class="muted">لا يظهر حكم آلي إضافي.</div>'}</div>`}
if(tab==='words'){inner=`<div class="mushaf-note">🔎 المصدر المعجمي العربي في QuranEnc هو «معاني الكلمات» من كتاب السراج في بيان غريب القرآن. يعرض التطبيق النص المتاح عند الاتصال ويحفظه محليًا للمشاهدة لاحقًا. </div><div class="word-list">${words.map((w,i)=>`<button class="word-chip" type="button" data-word="${esc(w)}" data-i="${i}">${esc(w)}</button>`).join('')}</div><div id="wordDetail" class="ayah-detail" style="margin-top:12px"><h4>اختر كلمة</h4><p>اضغط على أي كلمة لرؤية معناها من المادة المتاحة، ويمكن فتح التحليل اللغوي التفصيلي.</p></div>${mushafSourceLinks(s,a)}`}
if(tab==='tafsir'){inner=`<section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(meta.taf)}</p></section><div class="ayah-detail" style="margin-top:12px"><h4>📚 مصدر التفسير</h4><p>التفسير الميسر صادر عن مجمع الملك فهد لطباعة المصحف الشريف، كما يصفه QuranEnc في فهرسه العربي.</p>${mushafSourceLinks(s,a)}</div>`}
if(tab==='asbab'){inner=`<section class="ayah-detail"><h4>🕊️ أسباب النزول</h4><p>${esc(asbab[`${s}:${a}`]||'لا توجد رواية خاصة محفوظة محليًا لهذه الآية في النسخة الحالية. لا نختلق سبب نزول؛ يُرجع إلى كتب أسباب النزول ومصادر التخريج عند الحاجة.')}</p></section><div class="mushaf-note" style="margin-top:12px">⚠️ سبب النزول مسألة توثيقية: لا نثبت رواية خاصة بلا سند أو نقل معتبر.</div><div class="source-badges"><a href="https://tafsir.app/" target="_blank" rel="noopener">📚 موسوعة التفسير</a><a href="https://dorar.net/" target="_blank" rel="noopener">🔎 الدرر السنية</a></div>`}
$('ayahStudyInner').innerHTML=inner;document.querySelectorAll('.ayah-study-tab').forEach(b=>b.classList.toggle('active',b.dataset.at===tab));document.querySelectorAll('.ayah-study-tab').forEach(b=>b.onclick=()=>{mushafTab=b.dataset.at;renderTab()});document.querySelectorAll('.ayah-taj-letter').forEach(x=>x.onclick=()=>{const rs=(x.dataset.rules||'').split('،').filter(Boolean);const nextText='';const msg=`الحرف: ${x.dataset.char}\nالحركة: ${x.dataset.haraka}\nكيف تنطقه؟ ${x.dataset.pron}\nالحكم: ${rs.join('، ')||'لا حكم إضافي ظاهر آليًا'}`;toast(msg)});document.querySelectorAll('.word-chip').forEach(x=>x.onclick=()=>{const wd=$('wordDetail');if(wd)wd.innerHTML=`<h4>${esc(x.dataset.word)}</h4><p>المعنى المحلي لهذه الكلمة يعتمد على بيانات «معاني الكلمات» المحملة للآية. للمزيد من التحليل الصرفي والنحوي افتح Quranic Arabic Corpus للآية.</p><div class="source-badges"><a target="_blank" rel="noopener" href="https://corpus.quran.com/wordbyword.jsp?chapter=${s}&verse=${a}">🧩 التحليل كلمة بكلمة</a><a target="_blank" rel="noopener" href="https://quranenc.com/ar/browse/arabic_seraj/${s}/${a}">📚 معاني الكلمات</a></div>`});};renderTab();$('ayahStudyPanel').scrollIntoView({behavior:'smooth',block:'start'});}
function mushafInit(){const root=$('mushaf');if(!root)return;if(root.dataset.ready==='1'){loadQuranBook().then(()=>{renderMushafList();renderMushafSurah()});return}root.dataset.ready='1';loadQuranBook().then(()=>{renderMushafList();renderMushafSurah()});$('mushafSearch')?.addEventListener('input',renderMushafList);$('mushafPrev')?.addEventListener('click',()=>{if(mushafSura>1){mushafSura--;renderMushafList();renderMushafSurah();window.scrollTo({top:0,behavior:'smooth'})}});$('mushafNext')?.addEventListener('click',()=>{if(mushafSura<114){mushafSura++;renderMushafList();renderMushafSurah();window.scrollTo({top:0,behavior:'smooth'})}});$('mushafResetBtn')?.addEventListener('click',()=>{mushafSura=1;renderMushafList();renderMushafSurah();window.scrollTo({top:0,behavior:'smooth'})});$('mushafCacheBtn')?.addEventListener('click',async()=>{const s=quranBook?.find(x=>x.s===mushafSura);if(!s)return;for(const v of s.verses){await fetchVerseMeta(s.s,v.a)}toast(`تم حفظ بيانات التفسير ومعاني الكلمات للسورة: ${s.name} ✅`);$('mushafCacheStatus').textContent='محفوظ محليًا'});}

function setupEvents(){
  const bind=(id,event,fn)=>{const el=$(id);if(el)el[event]=fn;};
  document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  bind('welcomeStartBtn','onclick',saveWelcome);
  bind('themeBtn','onclick',()=>{state.theme=state.theme==='dark'?'light':state.theme==='light'?'sepia':'dark';save();applyGraphics();renderAll()});
  bind('methodBtn','onclick',()=>{renderMethod();openModal('methodModal')});
  bind('openMethod2','onclick',()=>{renderMethod();openModal('methodModal')});
  bind('addNewBtn','onclick',()=>openModal('addNewModal'));
  bind('addOldBtn','onclick',()=>openModal('addOldModal'));
  bind('saveNewBtn','onclick',addNew);
  bind('saveOldBtn','onclick',addOld);
  bind('reverseBtn','onclick',()=>openModal('reverseModal'));
  bind('calcReverseBtn','onclick',calculateReverse);
  bind('savePlanBtn','onclick',savePlan);
  bind('startTodayBtn','onclick',()=>{const e=state.entries.find(x=>(x.nextReviewDate<=dayKey()&&x.hasBeenEvaluated)||!x.hasBeenEvaluated);if(e)openFocus(e.label);else openModal('addNewModal')});
  document.querySelector('#focusModal .focus-actions')?.querySelectorAll('[data-min]').forEach(b=>b.onclick=()=>{timeLeft=+b.dataset.min*60;renderTimer()});
  bind('customMinBtn','onclick',()=>{const m=+$('customMin').value;if(m>0){timeLeft=m*60;renderTimer()}});
  bind('startFocusBtn','onclick',startFocus);
  bind('stopFocusBtn','onclick',()=>closeModal('focusModal'));
  bind('rainBtn','onclick',()=>noiseStart('rain'));
  bind('brownBtn','onclick',()=>noiseStart('brown'));
  bind('sadaqahFab','onclick',()=>{renderAdhkar();openModal('sadaqahModal')});
  bind('splashClose','onclick',()=>closeSplash(true));
  bind('splashPlay','onclick',async()=>{const a=$('splashAudio');if(!a)return;try{await a.play()}catch{toast('اضغط تشغيل مرة أخرى أو اسمح بالصوت في المتصفح')}});
  bind('splashStudy','onclick',()=>{closeSplash(false);switchView('mushaf')});
  bind('resetAdhkarBtn','onclick',resetAdhkar);
  bind('splashClose','onclick',()=>closeSplash(true));
  bind('splashPlay','onclick',()=>$('splashAudio')?.play().catch(()=>{}));
  bind('splashStudy','onclick',()=>{closeSplash(false);openDailyStudy()});
  bind('playDailyVerseBtn','onclick',()=>{const a=getDailyVerse();const audio=$('splashAudio');if(!audio)return;audio.src=recitationUrl(a.s,a.a,state.reciter);audio.play().catch(()=>{})});
  bind('studyDailyVerseBtn','onclick',openDailyStudy);
  bind('themeSelect','onchange',e=>{state.theme=e.target.value;save();applyGraphics()});
  bind('graphicsSelect','onchange',e=>{state.graphics=Math.max(1,Math.min(3,+e.target.value||1));save();applyGraphics();renderAll();toast(`الجرافيك: المستوى ${state.graphics} ✅`)});
  bind('saveProfileBtn','onclick',()=>{const age=+$('profileAge')?.value||'';if(age&&(age<3||age>110))return toast('العمر من 3 إلى 110 سنة');profileSave($('profileName')?.value||'',age);toast('تم حفظ الملف ✅');renderAll()});
  bind('reciterSelect','onchange',e=>{state.reciter=e.target.value;save()});
  bind('volumeRange','oninput',e=>{state.volume=+e.target.value;save()});
  bind('ambientQuranBtn','onclick',()=>state.ambient?stopAmbient():playAmbient());
  bind('testSoundBtn','onclick',()=>beep('shine'));
  bind('notifyToggle','onchange',e=>{state.notify=e.target.checked;save()});
  bind('saveNotifyBtn','onclick',()=>{state.notifyHour=Math.max(0,Math.min(23,+$('notifyHour')?.value||20));save();requestNotifications()});
  bind('locBtn','onclick',locate);
  bind('calcMethod','onchange',e=>{state.calcMethod=+e.target.value;save();refreshPrayer()});
  bind('asrMethod','onchange',e=>{state.asrMethod=+e.target.value;save();refreshPrayer()});
  bind('cityInput','onchange',e=>{state.city=e.target.value.trim()||'أسيوط';state.lat=null;state.lon=null;save();refreshPrayer()});
  bind('backupBtn','onclick',exportJSON);
  bind('restoreInput','onchange',e=>e.target.files[0]&&importJSON(e.target.files[0]));
  bind('resetBtn','onclick',resetApp);
  bind('installBtn','onclick',()=>installApp());
  bind('shareBtn','onclick',shareImage);
  bind('downloadShareBtn','onclick',downloadShare);
  bind('nativeShareBtn','onclick',nativeShare);
  bind('printBtn','onclick',printReport);
  bind('prevMonth','onclick',()=>{chartMonth.setMonth(chartMonth.getMonth()-1);renderProgress()});
  bind('nextMonth','onclick',()=>{chartMonth.setMonth(chartMonth.getMonth()+1);renderProgress()});
  bind('recommendBtn','onclick',recommend);
  bind('saveMistakeBtn','onclick',saveMistake);
  document.addEventListener('click',e=>{const c=e.target.closest('.floating-card');if(!c)return;e.preventDefault();e.stopPropagation();openSpace(c.dataset.space)},{passive:false});
  bind('backToOcean','onclick',ev=>{ev?.preventDefault();ev?.stopPropagation();const tr=$('sceneTransition');tr?.classList.remove('play');void tr?.offsetWidth;tr?.classList.add('play');document.body.classList.remove('space-world');document.body.classList.add('ocean-world');$('spaceView')?.classList.remove('show');const o=$('ocean');if(o){o.style.display='block';o.classList.remove('ocean-dive');void o.offsetWidth}window.scrollTo({top:0,behavior:'auto'})});
  bind('recordBtn','onclick',toggleRecorder);
  document.querySelectorAll('.modal,.splash').forEach(m=>m.addEventListener('click',e=>{if(e.target===m&&m!==$('dailySplash'))m.classList.remove('show')}));
}
function createOceanBubbles(){const box=$('oceanBubbles');if(!box)return;if(document.body.dataset.perf==='lite'||state.graphics===1){box.innerHTML='';return}box.innerHTML='';const count=state.graphics>=3?(window.innerWidth>1100?14:9):(state.graphics===2?7:0);for(let i=0;i<count;i++){const b=document.createElement('span');b.className='bubble';const size=(3+Math.random()*10).toFixed(1)+'px';b.style.setProperty('--size',size);b.style.left=(Math.random()*100).toFixed(2)+'%';b.style.setProperty('--dur',(9+Math.random()*13).toFixed(2)+'s');b.style.setProperty('--delay',(-Math.random()*12).toFixed(2)+'s');b.style.setProperty('--drift',(Math.random()*90-45).toFixed(1)+'px');box.appendChild(b)}}
function createGlobalOceanBubbles(){const box=$('globalOceanBubbles');if(!box)return;if(document.body.dataset.perf==='lite'||state.graphics===1){box.innerHTML='';return}box.innerHTML='';const count=state.graphics>=3?(innerWidth>1200?16:10):(innerWidth>900?9:6);for(let i=0;i<count;i++){const b=document.createElement('span');b.style.left=(Math.random()*100).toFixed(2)+'%';b.style.setProperty('--sz',(3+Math.random()*9).toFixed(1)+'px');b.style.setProperty('--dur',(9+Math.random()*12).toFixed(1)+'s');b.style.setProperty('--delay',(-Math.random()*10).toFixed(1)+'s');b.style.setProperty('--dx',(Math.random()*90-45).toFixed(1)+'px');box.appendChild(b)}}
function initGlobalOcean(){createGlobalOceanBubbles();const btn=$('globalOceanSoundBtn');if(btn)btn.onclick=()=>oceanSound?stopOceanSound():startOceanSound();}
function startOceanSound(){if(oceanSound)return;const A=window.AudioContext||window.webkitAudioContext;if(!A){toast('الصوت غير مدعوم في هذا المتصفح');return}oceanSound=new A();if(oceanSound.state==='suspended')oceanSound.resume();const sr=oceanSound.sampleRate;const buffer=oceanSound.createBuffer(1,sr*3,sr);const d=buffer.getChannelData(0);let brown=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;brown=brown*.985+w*.15;d[i]=brown*.30+w*.035}oceanSoundSource=oceanSound.createBufferSource();oceanSoundSource.buffer=buffer;oceanSoundSource.loop=true;const low=oceanSound.createBiquadFilter();low.type='lowpass';low.frequency.value=900;const band=oceanSound.createBiquadFilter();band.type='bandpass';band.frequency.value=650;band.Q.value=.55;oceanSoundGain=oceanSound.createGain();oceanSoundGain.gain.value=.0001;oceanSoundSource.connect(low).connect(band).connect(oceanSoundGain).connect(oceanSound.destination);const lfo=oceanSound.createOscillator(),lg=oceanSound.createGain();lfo.frequency.value=.085;lg.gain.value=.018;lfo.connect(lg).connect(oceanSoundGain.gain);lfo.start();oceanSoundSource.start();oceanSound.__rafiqLfo=lfo;$('oceanStatusText')&&($('oceanStatusText').textContent='صوت البحر يعمل — استمتع بالهدوء');const btn=$('oceanSoundBtn');if(btn){btn.textContent='🌊 صوت البحر يعمل';btn.classList.add('ambient-playing')}}
function stopOceanSound(){if(!oceanSound)return;try{oceanSound.__rafiqLfo?.stop();oceanSoundSource?.stop();oceanSound.close()}catch{}oceanSound=null;oceanSoundGain=null;oceanSoundSource=null;const t=$('oceanStatusText');if(t)t.textContent='المشهد حي — الصوت اختياري';const btn=$('oceanSoundBtn');if(btn){btn.textContent='🌊 تشغيل صوت البحر';btn.classList.remove('ambient-playing')}}
function initOceanExplorer(){createOceanBubbles();const sound=$('oceanSoundBtn'),silence=$('oceanSilenceBtn');if(sound)sound.onclick=()=>oceanSound?stopOceanSound():startOceanSound();if(silence)silence.onclick=stopOceanSound;document.querySelectorAll('.floating-card').forEach(card=>{card.addEventListener('pointerenter',()=>{if(state.soundEnabled)beep('shine')},{passive:true});card.addEventListener('pointermove',e=>{if(window.matchMedia('(max-width:800px)').matches||state.graphics<3)return;const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.setProperty('--mx',(x*8).toFixed(1)+'px');card.style.setProperty('--my',(y*6).toFixed(1)+'px')},{passive:true});card.addEventListener('pointerleave',()=>{card.style.setProperty('--mx','0px');card.style.setProperty('--my','0px')},{passive:true})})}
  const scene=$('ocean'); if(scene){scene.addEventListener('pointermove',e=>{if(state.graphics<3||window.matchMedia('(max-width:800px)').matches)return;const r=scene.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;scene.style.setProperty('--sceneX',(px*18).toFixed(1)+'px');scene.style.setProperty('--sceneY',(py*14).toFixed(1)+'px')},{passive:true});scene.addEventListener('pointerleave',()=>{scene.style.setProperty('--sceneX','0px');scene.style.setProperty('--sceneY','0px')},{passive:true})}




function openSpace(key){
  const meta=ARCHIVE_META[key]||ARCHIVE_META.resources;
  const base=DEEP[key]||{intro:'',sections:[]};
  const extras=(ARCHIVE_EXTRA[key]||[]).map(x=>({t:x[0],p:x[1],note:x[2],list:x[3]?[x[3]]:[]}));
  const mergedSections=[...extras,...(base.sections||[])];
  const isTazkiyah=key==='tazkiyah';
  const coreStudy=['tafsir','asbab','words','practice'].includes(key);
  const topics=mergedSections.map((c,i)=>({idx:i,title:c.t,kicker:i<extras.length?'باب موسوعي':(coreStudy?'قسم متقدم':'قسم تأسيسي'),data:c}));
  $('spaceTitle').textContent=`${meta.icon} ${meta.title}`;
  $('spaceIntro').textContent=meta.intro;
  const chapterCount=topics.length;
  const sources=[
    ['القرآن الكريم — Quran.com','https://quran.com/','النص القرآني وقراءة السور والآيات.'],
    ['التفسير الميسر — QuranEnc','https://quranenc.com/ar/browse/arabic_moyassar/','نقطة دخول لفهم المعنى الإجمالي للآية.'],
    ['الموسوعة الحديثية — الدرر السنية','https://dorar.net/hadith','التحقق من تخريج الحديث وحكم المحدثين.'],
    ['Sunnah.com — كتب الحديث','https://sunnah.com/','الوصول إلى كتب الحديث المترجمة/المفهرسة.'],
    ['Quranic Arabic Corpus','https://corpus.quran.com/documentation/','تحليل صرفي ونحوي وكلمة بكلمة.'],
    ['إسلام ويب — الفقه والفتاوى','https://www.islamweb.net/ar/fatwa/','مراجعة المسائل الفقهية والفتاوى المنشورة.'],
    ['المكتبة الشاملة','https://shamela.ws/','الكتب التراثية والمصادر الموسعة للبحث.']
  ];
  const sourceFor=title=>{
    const t=title.toLowerCase();
    if(t.includes('لغة')||t.includes('كلمة')||t.includes('جذر')||t.includes('إعراب'))return sources.filter((_,i)=>[0,1,4,6].includes(i));
    if(t.includes('حديث')||t.includes('ذكر')||t.includes('جمعة')||t.includes('الفطرة'))return sources.filter((_,i)=>[0,2,3].includes(i));
    if(t.includes('فقه')||t.includes('طهارة')||t.includes('حقوق'))return sources.filter((_,i)=>[0,2,5,6].includes(i));
    return sources.filter((_,i)=>[0,1,2,3,6].includes(i));
  };
  const daily= isTazkiyah ? TAZKIYAH_DAYS[(ritualDayIndex()-1)%TAZKIYAH_DAYS.length] : null;
  function renderArticle(index){
    const item=topics[index]||topics[0]; if(!item)return;
    const d=item.data||{};
    const details=[];
    details.push(`<section class="ency-section lead-study"><div class="ency-section-head"><span>🎓</span><div><b>ماذا ستتعلم في هذا الباب؟</b><small>خريطة دراسة مختصرة</small></div></div><p>هذا الباب ليس مجرد معلومة عابرة. اقرأ الشرح، ثم الدليل، ثم التطبيق، ثم ارجع إلى المراجع عند الحاجة. وفي المسائل الفقهية والعقدية والخلافية لا تتعامل مع هذا العرض المختصر بوصفه فتوى شخصية.</p></section>`);
    if(d.p)details.push(`<section class="ency-section"><div class="ency-section-head"><span>📖</span><div><b>الشرح التفصيلي</b><small>المفهوم، السياق، وما الذي ينبغي فهمه</small></div></div><p>${esc(d.p)}</p></section>`);
    if(d.list?.length)details.push(`<section class="ency-section"><div class="ency-section-head"><span>🧭</span><div><b>منهج الدراسة والعمل</b><small>حوّل المعرفة إلى خطوات</small></div></div><ol>${d.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>`);
    if(d.note)details.push(`<section class="ency-section highlight"><div class="ency-section-head"><span>💡</span><div><b>تطبيق عملي</b><small>شيء يمكن فعله اليوم</small></div></div><p>${esc(d.note)}</p></section>`);
    if(d.q)details.push(`<section class="ency-section evidence"><div class="ency-section-head"><span>📜</span><div><b>الدليل أو النص</b><small>نص مختصر مرتبط بالباب</small></div></div><div class="ency-quote">${esc(d.q)}</div></section>`);
    const src=sourceFor(item.title).map(a=>`<a href="${a[1]}" target="_blank" rel="noopener"><b>🔗 ${esc(a[0])}</b><span>${esc(a[2])}</span></a>`).join('');
    const related=topics.map((t,i)=>i===index?'':`<button type="button" data-rel="${i}">${esc(t.title)}</button>`).join('');
    const guide=STUDY_GUIDES[key]||STUDY_GUIDES.resources;
    const discipline=`<section class="ency-section study-method"><div class="ency-section-head"><span>🧠</span><div><b>${esc(guide.label)}</b><small>${esc(guide.intro)}</small></div></div><ol>${guide.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="method-outcome"><b>🎯 ناتج الدراسة</b><p>${esc(guide.output)}</p></div></section>`;
    const closing=(key==='knowledge')?`<section class="ency-section final-note"><div class="ency-section-head"><span>⚠️</span><div><b>تنبيه منهجي مهم</b><small>هذا الباب بداية وليس نهاية</small></div></div><p>هذه الموسوعة <b>مدخل تأسيسي</b> يساعدك على معرفة ما تحتاج إلى تعلمه وترتيب الطريق، لكنها لا تغني عن طلب العلم الشرعي ولا عن دراسة القرآن والسنة والفقه والعقيدة على أيدي أهل العلم، ولا تجعل من المستخدم مفتيًا لمجرد أنه قرأ ملخصًا هنا. تعلّم، واسأل، وتثبّت، واعرف حدود علمك.</p></section>`:'';
    $('spaceArticle').innerHTML=`
      <div class="ency-breadcrumb">${meta.icon} ${esc(meta.title)} <span>›</span> <b>${esc(item.title)}</b></div>
      <div class="ency-title-row"><div><div class="ency-kicker">${esc(item.kicker)}</div><h3>${esc(item.title)}</h3><p class="ency-intro">تدرّج في القراءة: تمهيد → شرح → دليل → تطبيق → مراجع → أبواب مرتبطة.</p></div><div class="ency-counter">الباب ${index+1} من ${chapterCount}</div></div>
      <div class="ency-progress"><div style="width:${((index+1)/chapterCount*100).toFixed(1)}%"></div></div>
      ${details.join('')}
      ${discipline}
      ${closing}
      <section class="ency-section sources"><div class="ency-section-head"><span>📚</span><div><b>مراجع الباب</b><small>المعلومة معروضة هنا أولًا، وهذه المراجع للتثبت والتوسع</small></div></div><div class="source-list">${src}</div></section>
      <section class="ency-related"><div class="ency-related-title">أبواب مرتبطة داخل هذه الموسوعة</div><div class="ency-related-list">${related}</div></section>`;
    $('spaceArticle').querySelectorAll('[data-rel]').forEach(b=>b.onclick=()=>renderArticle(+b.dataset.rel));
    document.querySelectorAll('.space-topic-btn').forEach(b=>b.classList.toggle('active',+b.dataset.idx===index));
    $('spaceArticle').scrollIntoView({behavior:'auto',block:'start'});
  }
  const dailyHtml=isTazkiyah?`<section class="daily-tazkiyah"><div class="daily-kicker">🌱 رحلة التزكية اليومية</div><h3>اليوم ${daily.day}: ${esc(daily.title)}</h3><div class="daily-grid"><div><b>خواطر اليوم</b><p>${esc(daily.reflection)}</p></div><div><b>تطبيق اليوم</b><p>${esc(daily.action)}</p></div><div><b>سؤال للنفس</b><p>${esc(daily.question)}</p></div><div><b>آية اليوم</b><p class="quran daily-ayah">${esc(daily.ayah)}</p></div></div><div class="daily-archive">${TAZKIYAH_DAYS.map(x=>`<button type="button" class="daily-pill ${x.day===daily.day?'active':''}" data-day="${x.day}">اليوم ${x.day}</button>`).join('')}</div></section>`:'';
  const buttons=topics.map((t,i)=>`<button type="button" class="space-topic-btn ${i===0?'active':''}" data-idx="${i}"><span class="topic-num">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(t.title)}</strong><small>${esc(t.kicker)}</small></span></button>`).join('');
  const generalNote=coreStudy?`<section class="ency-disclaimer"><b>📚 تنبيه منهجي:</b> هذا الباب جزء أساسي من دراسة القرآن في التطبيق، لذلك نوسّع فيه قدر الإمكان. ومع ذلك فالمادة الرقمية ليست بديلًا عن كتب العلم الأصلية ولا عن سؤال أهل الاختصاص في المسائل الدقيقة أو المختلف فيها.</section>`:`<section class="ency-disclaimer"><b>📚 تنبيه علمي:</b> هذا الباب مدخل منظم ومبسّط لبناء الطريق، وليس منهجًا كاملًا يغني عن كتب العلم أو أهل الاختصاص. عند المسائل الدقيقة أو الخلافية ارجع إلى مصدر معتبر أو عالم موثوق.</section>`;
  $('spaceContent').innerHTML=`<div class="archive-head ${coreStudy?'core-study':''}"><div><div class="archive-icon">${meta.icon}</div><div><div class="archive-label">🗂️ ${coreStudy?'موسوعة قرآنية أساسية':'أرشيف موسوعي'}</div><h2>${esc(meta.title)}</h2><p>${esc(meta.intro)}</p>${coreStudy?'<span class="core-badge">📚 قسم أساسي في رحلة حفظ القرآن — دراسة موسعة</span>':''}</div></div><button type="button" class="space-internal-back" id="internalBackBtn">🌊 العودة إلى البحر</button></div>${dailyHtml}${generalNote}<div class="archive-shell"><aside class="archive-index"><div class="archive-index-title">فهرس الأبواب (${chapterCount})</div><div class="archive-index-list">${buttons}</div></aside><main id="spaceArticle" class="archive-article"></main></div>`;
  document.querySelectorAll('.space-topic-btn').forEach(b=>b.onclick=()=>renderArticle(+b.dataset.idx));
  $('internalBackBtn')?.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();if(typeof switchView==='function'){switchView('spiritual')}else{$('spaceView')?.classList.remove('show');$('ocean')?.style.setProperty('display','block');document.body.classList.remove('space-world');document.body.classList.add('ocean-world')}});
  document.querySelectorAll('.daily-pill').forEach(b=>b.onclick=()=>{const day=+b.dataset.day;const x=TAZKIYAH_DAYS.find(d=>d.day===day);if(!x)return;toast(`اليوم ${x.day}: ${x.title} — ${x.action}`)});
  renderArticle(0);
  const ocean=$('ocean');if(!ocean)return;const tr=$('sceneTransition');tr?.classList.remove('play');void tr?.offsetWidth;tr?.classList.add('play');ocean.classList.remove('ocean-dive');void ocean.offsetWidth;ocean.classList.add('ocean-dive');setTimeout(()=>{ocean.style.display='none';$('spaceView').classList.add('show');$('spaceView').scrollIntoView({block:'start',behavior:'auto'})},360);
}


// ==========================================
// Compatibility + missing UI helpers restored
// ==========================================

function renderMethod(){
  const box=$('methodList');
  if(!box)return;
  box.innerHTML=method.map(([n,t,p])=>`<div class="schedule-day"><div class="row" style="justify-content:space-between;gap:10px"><b style="color:var(--gold)">${esc(n)} — ${esc(t)}</b></div><p class="muted" style="margin:6px 0 0">${esc(p)}</p></div>`).join('');
}

function renderAdhkar(){
  const box=$('adhkarBox');
  if(!box)return;
  box.innerHTML=adhkar.map(([label,key,target])=>{
    const count=Number(state.dhikr?.[key]||0);
    return `<div class="schedule-day" style="margin-bottom:10px"><div class="row" style="justify-content:space-between;gap:10px"><div><b class="quran">${esc(label)}</b><div class="small">الهدف: ${target}</div></div><button class="action ${count>=target?'success':''}" data-dhikr="${esc(key)}">${count>=target?'✓ تم':`تسبيح (${count}/${target})`}</button></div></div>`;
  }).join('');
  box.querySelectorAll('[data-dhikr]').forEach(btn=>btn.onclick=()=>{
    const key=btn.dataset.dhikr;
    const item=adhkar.find(x=>x[1]===key);
    if(!item)return;
    state.dhikr ||= {};
    const target=item[2];
    state.dhikr[key]=Math.min(target,Number(state.dhikr[key]||0)+1);
    save();
    renderAdhkar();
    beep(state.dhikr[key]>=target?'done':'click');
    haptic(state.dhikr[key]>=target?'done':'light');
  });
}

function resetAdhkar(){
  if(!confirm('تصفير عدادات الأذكار؟'))return;
  state.dhikr={};
  save();
  renderAdhkar();
  toast('تم تصفير العدادات');
}

function installApp(){
  if(!deferredInstall){toast('التثبيت غير متاح الآن؛ يمكنك استخدام خيار التثبيت من قائمة المتصفح.');return;}
  const p=deferredInstall;
  deferredInstall=null;
  p.prompt();
  p.userChoice?.finally(()=>renderSettings());
}

function openFocus(label){
  const target=$('focusTarget');
  if(target)target.textContent=label||'جلسة تركيز';
  timeLeft=timeLeft||15*60;
  renderTimer();
  $('breathBox')?.style && ($('breathBox').style.display='none');
  $('timerBox')?.style && ($('timerBox').style.display='block');
  openModal('focusModal');
}

async function prepareStudyVerses(){
  const limited=currentVerses.slice(0,12);
  await Promise.all(limited.map(async v=>{
    if(v.sura&&v.aya){
      try{v.meta=await fetchVerseMeta(v.sura,v.aya)}catch{v.meta={taf:'',word:''}}
    }
  }));
}

async function openStudy(id){
  const e=state.entries.find(x=>x.id===id);
  if(!e)return;
  currentStudy=e;
  currentStudyTab='all';
  currentVerses=[];
  const refs=parseStudyRefs(e.label);
  if(!refs.length){
    toast('لم أستطع تحديد الآيات من اسم الورد؛ افتح المصحف أو اكتب السورة والآية.');
    return;
  }
  switchView('study');
  $('studyEmpty')?.style && ($('studyEmpty').style.display='none');
  $('studyContent')?.style && ($('studyContent').style.display='block');
  const body=$('studyBody');
  if(body)body.innerHTML='<div class="schedule-day">جاري تجهيز دراسة الورد…</div>';
  currentVerses=await fetchStudyVerses(refs);
  await prepareStudyVerses();
  renderStudy();
}

async function openDailyStudy(){
  const a=getDailyVerse();
  currentStudy={id:'daily',label:a.ref,note:'آية اليوم'};
  currentStudyTab='all';
  currentVerses=[{sura:a.s,aya:a.a,text:a.text,ref:a.ref}];
  switchView('study');
  $('studyEmpty')?.style && ($('studyEmpty').style.display='none');
  $('studyContent')?.style && ($('studyContent').style.display='block');
  await prepareStudyVerses();
  renderStudy();
}

function renderTafsirHTML(){
  if(!currentVerses.length)return'';
  return `<section class="study-panel"><h3 style="color:var(--gold)">📖 التفسير والمعنى</h3>${currentVerses.map(v=>`<div class="ayah-detail" style="margin-top:10px"><div class="study-compare-ref">${esc(v.ref)}</div><p>${esc(v.meta?.taf||'اضغط على دراسة الآية من المصحف لتحميل التفسير الميسر عند الاتصال بالإنترنت.')}</p></div>`).join('')}</section>`;
}

function renderWordsHTML(){
  if(!currentVerses.length)return'';
  return `<section class="study-panel"><h3 style="color:var(--gold)">🔎 معاني الكلمات</h3>${currentVerses.map(v=>`<div class="ayah-detail" style="margin-top:10px"><div class="study-compare-ref">${esc(v.ref)}</div><p>${esc(v.meta?.word||'معاني الكلمات تُحمّل عند توفر الاتصال ثم تُحفظ محليًا.')}</p></div>`).join('')}</section>`;
}

function renderAsbabHTML(){
  if(!currentVerses.length)return'';
  return `<section class="study-panel"><h3 style="color:var(--gold)">🕊️ أسباب النزول</h3>${currentVerses.map(v=>`<div class="ayah-detail" style="margin-top:10px"><div class="study-compare-ref">${esc(v.ref)}</div><p>${esc(asbab[`${v.sura}:${v.aya}`]||'لا توجد رواية خاصة محفوظة محليًا لهذه الآية. لا نثبت سبب نزول بلا مصدر معتبر.')}</p></div>`).join('')}</section>`;
}

function renderRecitationHTML(){
  if(!currentVerses.length)return'';
  return `<section class="study-panel"><h3 style="color:var(--gold)">🎧 الاستماع والترديد</h3>${currentVerses.slice(0,12).map(v=>`<div class="schedule-day" style="margin-top:8px"><div class="row" style="justify-content:space-between;gap:10px"><b>${esc(v.ref)}</b><button class="action" data-play-study="${v.sura}:${v.aya}">▶ استمع</button></div><audio preload="none" controls style="width:100%;margin-top:8px" src="${recitationUrl(v.sura,v.aya,state.reciter)}"></audio></div>`).join('')}</section>`;
}

function renderExplore(){
  const rec=$('recommendation');
  if(rec&&!rec.innerHTML.trim())rec.innerHTML='<div class="muted">اختر شعورك واحتياجك ثم اضغط «اقترح لي».</div>';
  const chips=$('keywordChips');
  if(chips&&!chips.innerHTML.trim()){
    const terms=['تجويد المبتدئين','تثبيت الحفظ','التفسير الميسر','أسباب النزول','معاني كلمات القرآن','المراجعة الذكية'];
    chips.innerHTML=terms.map(x=>`<button type="button" class="action" data-keyword="${esc(x)}">${esc(x)}</button>`).join('');
    chips.querySelectorAll('[data-keyword]').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.keyword).catch(()=>{});toast(`كلمة البحث: ${b.dataset.keyword}`)});
  }
}

// Inline handlers existed in the original monolith. Modules do not expose declarations globally,
// so expose only the handlers that are intentionally called from generated HTML.
Object.assign(window,{reviewEntry,openStudy,openRecorder,deleteEntry,addRep,deleteMistake,startOceanSound,stopOceanSound,switchView});

function renderAll(){
  renderHome();
  const active=document.querySelector('.view.active')?.id;
  if(active==='schedule') renderPlanning();
  if(active==='spiritual') renderSpiritual();
  if(active==='progress') renderProgress();
  if(active==='settings') renderSettings();
  if(active==='explore') renderExplore();
  renderAdhkar();
}
function init(){setTimeGlow();applyGraphics();initGlobalOcean();setupEvents();initOceanExplorer();renderAll();if(!state.name)openModal('welcomeModal');else setTimeout(()=>showDailySplash(false),450);refreshPrayer();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=66',{updateViaCache:'none'}).catch(()=>{});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;renderSettings()});let resizeRaf=0,lastLayoutBucket=Math.floor(window.innerWidth/120);window.addEventListener('resize',()=>{if(resizeRaf)return;resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;const bucket=Math.floor(window.innerWidth/120);if(bucket!==lastLayoutBucket){lastLayoutBucket=bucket;applyGraphics();if($('spiritual')?.classList.contains('active'))createOceanBubbles();createGlobalOceanBubbles();}if($('progress')?.classList.contains('active'))drawChart()})},{passive:true});window.addEventListener('orientationchange',()=>{setTimeout(()=>{applyGraphics();createGlobalOceanBubbles();},180)},{passive:true});window.addEventListener('online',()=>{document.body.dataset.net='online';refreshPrayer();toast('عاد الاتصال بالإنترنت ✅')});window.addEventListener('offline',()=>{document.body.dataset.net='offline';toast('أنت أوفلاين — البيانات المحلية متاحة ✅')});setInterval(()=>{setTimeGlow();const g=$('greeting');if(g&&state.name)g.textContent=greeting();checkBoundaryAndSplash();},60000)}
function checkBoundaryAndSplash(){const key=ritualKey();if(state.lastDailyBoundary!==key){state.lastDailyBoundary=key;save();if(state.name)showDailySplash(false)}}

(function(){
  const portal=document.querySelector('[data-open-explore="true"]');
  if(portal){
    const open=()=>{ if(typeof switchView==='function') switchView('explore'); };
    portal.addEventListener('click',open);
    portal.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  }
})();

init();

/* V43: hydrate the exact ZAD ocean shell on every page. */
(function(){
  function seedPageBubbles(){
    document.querySelectorAll('.page-bubbles').forEach((box)=>{
      if(box.children.length) return;
      const frag=document.createDocumentFragment();
      for(let i=0;i<10;i++){
        const b=document.createElement('span');
        b.className='bubble';
        b.style.left=(Math.random()*100)+'%';
        b.style.setProperty('--size',(4+Math.random()*13)+'px');
        b.style.setProperty('--dur',(12+Math.random()*14)+'s');
        b.style.setProperty('--delay',(-Math.random()*18)+'s');
        frag.appendChild(b);
      }
      box.appendChild(frag);
    });
  }
  function syncDepth(){
    const views=['home','planning','mushaf','study','progress','explore','settings'];
    views.forEach((id,i)=>document.getElementById(id)?.style.setProperty('--zad-depth-index',i));
  }
  document.addEventListener('DOMContentLoaded',()=>{seedPageBubbles();syncDepth()});
})();