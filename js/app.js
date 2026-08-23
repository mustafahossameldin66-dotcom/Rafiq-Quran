(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const storeKey='rafiq-state-v85';
const LEGACY_STATE_KEYS=['rafiq-clean-v58-state','rafiq-fusion-state-v31','rafiq-zero-state-v5'];
const LEGACY_HIFZ_KEYS=['rafiq-hifz-fusion-v34','rafiq-hifz-fusion-v31','rafiq-hifz-v1','rafiq-hifz-v2'];
const LEGACY_DAILY_KEYS=['rafiq-home-daily-v82','rafiq-welcome-daily-v83','rafiq-welcome-seen-v70'];
const DEFAULT_STATE={name:null,plan:{},last:{s:1,a:1},memorizedAyahs:[],schedule:[['جلسة الحفظ','صباحًا'],['مراجعة','مساءً']],reminders:[],athar:{note:'',action:'',history:[]},prefs:{motion:true,ocean:true,style:'balanced',surface:'balanced',performance:'auto',fontSize:'normal',contrast:false,maghribMode:'fixed',maghribFixedMinutes:18*60+30},sessions:0,streak:0,bestStreak:0,activityLog:{},hifz:[],dailyContent:null,welcomeDaily:null,welcomeSeen:false,welcomeShownKey:null,onboardingComplete:false};
function readLocalJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function migrateState(){
  const current=readLocalJson(storeKey);
  const legacyBase=LEGACY_STATE_KEYS.map(readLocalJson).find(v=>v&&typeof v==='object')||{};
  const base={...DEFAULT_STATE,...legacyBase,...(current&&typeof current==='object'?current:{}),prefs:{...DEFAULT_STATE.prefs,...(legacyBase.prefs||{}),...(current?.prefs||{})},athar:{...DEFAULT_STATE.athar,...(legacyBase.athar||{}),...(current?.athar||{})}};
  const hifzLegacy=LEGACY_HIFZ_KEYS.map(readLocalJson).find(v=>Array.isArray(v));
  if(!Array.isArray(base.hifz)||base.hifz.length===0){if(Array.isArray(hifzLegacy))base.hifz=hifzLegacy;}
  if(!base.dailyContent) base.dailyContent=readLocalJson(LEGACY_DAILY_KEYS[0]);
  if(!base.welcomeDaily) base.welcomeDaily=readLocalJson(LEGACY_DAILY_KEYS[1]);
  if(!base.welcomeSeen) base.welcomeSeen=localStorage.getItem(LEGACY_DAILY_KEYS[2])==='1';
  if(!base.onboardingComplete && base.welcomeSeen)base.onboardingComplete=true;
  try{localStorage.setItem(storeKey,JSON.stringify(base));for(const key of [...LEGACY_STATE_KEYS,...LEGACY_HIFZ_KEYS,...LEGACY_DAILY_KEYS]) localStorage.removeItem(key);}catch{}
  return base;
}
let state=migrateState();
let quran=[]; state.activityLog=state.activityLog||{}; state.bestStreak=state.bestStreak||0; let currentSurah=Math.max(1,state.last?.s||1);
window.isAudioPlaying=false;
let reciters=[
 {name:'محمود خليل الحصري',folder:'Husary_128kbps',source:'everyayah',quality:'128 kbps',mode:'verse'},
 {name:'محمد صديق المنشاوي',folder:'Minshawy_Murattal_128kbps',source:'everyayah',quality:'128 kbps',mode:'verse'},
 {name:'فارس عباد',folder:'Fares_Abbad_64kbps',source:'mp3quran',server:'https://server8.mp3quran.net/frs_a/',quality:'MP3Quran',mode:'surah'},
 {name:'عبد الباسط عبد الصمد',folder:'Abdul_Basit_Murattal_192kbps',source:'everyayah',quality:'192 kbps',mode:'verse'}
];
const audioState={reciter:reciters[0],surah:1,verseIndex:0,active:false};
const qAudio=$('#quranAudio');
let activeAudioObjectUrl=null;
async function setPlayerAudio(url){
  if(activeAudioObjectUrl&&window.RAFIQ_CONTENT?.revokeAudioUrl){window.RAFIQ_CONTENT.revokeAudioUrl(activeAudioObjectUrl);activeAudioObjectUrl=null;}
  const playable=await window.RAFIQ_CONTENT?.getPlayableAudio(url)||url;
  if(String(playable).startsWith('blob:')) activeAudioObjectUrl=playable;
  qAudio.src=playable;
  return playable;
}
async function downloadAudioAsset(url){
  if(window.RAFIQ_CONTENT?.saveAudio){const ok=await window.RAFIQ_CONTENT.saveAudio(url);if(ok)return true;}
  try{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.download='';document.body.appendChild(a);a.click();a.remove();return true}catch{return false}
}
// Background visuals are intentionally independent from Quran playback.
function audioUrl(reciter,surah,ayah){
  const s=String(surah).padStart(3,'0');
  if(reciter.source==='mp3quran') return `${reciter.server}${s}.mp3`;
  return `https://everyayah.com/data/${reciter.folder}/${s}${String(ayah).padStart(3,'0')}.mp3`;
}
const MP3QURAN_RECITER_API='https://www.mp3quran.net/api/v3/reciters?language=ar';
const RECITER_PRIORITY=['الحصري','المنشاوي','عبد الباسط','مشاري','العفاسي','ماهر المعيقلي','السديس','سعود الشريم','ياسر الدوسري','سعد الغامدي','فارس عباد','خالد الجليل','هاني الرفاعي','أحمد العجمي','محمد جبريل','محمود علي البنا','الطبلاوي','مصطفى إسماعيل','محمد رفعت'];
function mp3ReciterScore(name){const i=RECITER_PRIORITY.findIndex(x=>String(name||'').includes(x));return i<0?999:i;}
function normalizeMp3QuranReciters(payload){
  const rows=Array.isArray(payload?.reciters)?payload.reciters:(Array.isArray(payload?.data)?payload.data:(Array.isArray(payload)?payload:[]));
  const out=[];
  for(const row of rows){
    const moshafs=Array.isArray(row?.moshaf)?row.moshaf:(Array.isArray(row?.moshafs)?row.moshafs:Array.isArray(row?.reads)?row.reads:[]);
    const candidates=moshafs.filter(m=>m?.server&&m?.surah_list);
    if(!candidates.length)continue;
    const m=candidates.find(x=>Number(x.surah_total)>=100&&/حفص|Hafs/i.test(String(x.name||'')))||candidates.find(x=>Number(x.surah_total)>=100)||candidates[0];
    const surahs=String(m.surah_list||'').split(',').map(Number).filter(n=>n>=1&&n<=114);
    if(!surahs.length)continue;
    out.push({name:String(row.name||row.reciter_name||'قارئ').trim(),folder:`mp3quran-${row.id||'unknown'}-${m.id||'default'}`,source:'mp3quran',server:String(m.server).replace(/\/$/,'')+'/',quality:`MP3Quran · ${m.name||'تلاوة'}`,mode:'surah',availableSurahs:surahs,reciterId:row.id,moshafId:m.id,readName:m.name||''});
  }
  const seen=new Set(),dedup=[];
  for(const r of out){if(seen.has(r.folder))continue;seen.add(r.folder);dedup.push(r)}
  dedup.sort((a,b)=>mp3ReciterScore(a.name)-mp3ReciterScore(b.name)||a.name.localeCompare(b.name,'ar'));
  return dedup;
}
const recitersLoadState={promise:null};
async function loadMp3QuranReciters(){
  if(recitersLoadState.promise)return recitersLoadState.promise;
  recitersLoadState.promise=(async()=>{
    const applyList=(dynamic,sourceLabel,saveCache)=>{
      if(!Array.isArray(dynamic)||dynamic.length<10)return false;
      if(saveCache){try{localStorage.setItem('rafiq-mp3quran-reciters-v1',JSON.stringify(dynamic))}catch{}}
      const staticVerse=reciters.filter(r=>r.source!=='mp3quran');
      reciters=[...staticVerse,...dynamic];
      const saved=state.prefs?.reciter;
      audioState.reciter=reciters.find(r=>r.folder===saved)||audioState.reciter||reciters[0];
      
      syncRecitationControl();
      renderRecitations();
      updateQuranReciterButton();
      const status=$('#recitationStatus');if(status)status.textContent=sourceLabel;
      return true;
    };
    // 1) Cached list first: the recitations page must never wait for the network.
    try{
      const cached=JSON.parse(localStorage.getItem('rafiq-mp3quran-reciters-v1')||'null');
      if(Array.isArray(cached)&&cached.length>=10)applyList(cached,'قائمة القراء المحفوظة محليًا · تُحدّث عند الاتصال',false);
    }catch{}
    // 2) Refresh from the single authoritative catalog source used by the recitations page.
    if(navigator.onLine){
      try{
        const r=await fetch(MP3QURAN_RECITER_API,{cache:'no-store'});
        if(r.ok&&applyList(normalizeMp3QuranReciters(await r.json()),'قائمة القراء · MP3Quran',true))return;
      }catch{}
    }
    window.RAFIQ_RECITERS=reciters;
    syncRecitationControl();
    renderRecitations();
    updateQuranReciterButton();
    const status=$('#recitationStatus');
    if(status && reciters.length<10)status.textContent=navigator.onLine?'جاري تحميل قائمة القراء…':'قائمة أساسية متاحة أوفلاين؛ سيكتمل التحديث عند الاتصال';
  })();
  try{return await recitersLoadState.promise}finally{recitersLoadState.promise=null}
}
function reciterHasSurah(r,surah){return r?.source!=='mp3quran' || !Array.isArray(r.availableSurahs) || r.availableSurahs.includes(Number(surah));}
let offlineCorePromise=null;
let offlineCoreStarted=false;
async function scheduleOfflineCoreSync(force=false){
  // لا نبدأ تنزيل الحزم الكاملة تلقائيًا؛ حتى لا نحول أول فتح للتطبيق إلى عملية ثقيلة.
  // الدراسة الحالية تُحفظ عند فتحها، والتجهيز الكامل يتم من زر واضح في الإعدادات.
  if(!force)return null;
  if(!window.RAFIQ_CONTENT?.ensureOfflineCore||!navigator.onLine)return null;
  if(offlineCorePromise)return offlineCorePromise;
  offlineCoreStarted=true;
  offlineCorePromise=window.RAFIQ_CONTENT.ensureOfflineCore({force:false}).finally(()=>{offlineCorePromise=null;offlineCoreStarted=false;});
  return offlineCorePromise;
}
window.rafiqPrepareOfflineCore=()=>scheduleOfflineCoreSync(true);

function updatePlayer(){
  const s=quran[audioState.surah-1]; if(!s)return;
  const verse=s.verses[audioState.verseIndex];
  $('#playerTitle').textContent=`تلاوة سورة ${s.name}`;
  $('#playerSub').textContent=audioState.reciter.mode==='surah'
    ? `${audioState.reciter.name} · ${audioState.reciter.quality} · السورة كاملة`
    : `${audioState.reciter.name} · ${audioState.reciter.quality} · الآية ${verse?.a||1}`;
  $('#playerToggle').textContent=qAudio.paused?'استمرار':'إيقاف مؤقت';
}
async function playRecitation(reciter, surah=currentSurah, verseIndex=0, resumeTime=0){
  if(!quran.length)return;
  audioState.reciter=reciter; audioState.surah=surah; state.prefs=state.prefs||{}; state.prefs.reciter=reciter.folder; audioState.verseIndex=reciter.mode==='surah'?0:Math.max(0,Math.min(verseIndex,(quran[surah-1]?.verses.length||1)-1)); audioState.active=true;
  const s=quran[surah-1], v=s.verses[audioState.verseIndex];
  await setPlayerAudio(audioUrl(reciter,surah,v.a)); qAudio.currentTime=Math.max(0,+resumeTime||0);
  state.audio={reciter:reciter.folder,surah,verseIndex:audioState.verseIndex,time:qAudio.currentTime,active:true,source:reciter.source}; save();
  try{await qAudio.play(); $('#floatingPlayer').classList.add('active'); updatePlayer(); syncRecitationControl(); toast(`بدأت تلاوة ${s.name} · ${reciter.name} ✨`);}catch(e){window.isAudioPlaying=false;$('#floatingPlayer').classList.add('active');updatePlayer();toast('التلاوة تحتاج اتصالًا بالإنترنت.')}
}
qAudio.addEventListener('timeupdate',()=>{const p=qAudio.duration?Math.min(100,qAudio.currentTime/qAudio.duration*100):0;$('#playerProgress').style.width=p+'%'; if(audioState.active){state.audio={reciter:audioState.reciter.folder,surah:audioState.surah,verseIndex:audioState.verseIndex,time:qAudio.currentTime,active:true,source:audioState.reciter.source};save();}});
qAudio.addEventListener('ended',()=>{
  const s=quran[audioState.surah-1];
  if(audioState.reciter.mode==='surah'){
    if(audioState.surah<quran.length){ playRecitation(audioState.reciter,audioState.surah+1,0); }
    else { stopRecitation(false); toast('اكتملت التلاوة ✨'); }
    return;
  }
  if(audioState.verseIndex < s.verses.length-1){audioState.verseIndex++;setPlayerAudio(audioUrl(audioState.reciter,audioState.surah,s.verses[audioState.verseIndex].a)).then(()=>qAudio.play()).then(updatePlayer).catch(stopRecitation);}else{stopRecitation(false);toast('انتهت تلاوة السورة ✨')}
});
qAudio.addEventListener('error',()=>{toast('تعذر تحميل التلاوة من المصدر الخارجي');});
function stopRecitation(hide=true){qAudio.pause(); window.syncRafiqPauseButton?.();qAudio.removeAttribute('src');qAudio.load();window.isAudioPlaying=false;audioState.active=false;state.audio={...(state.audio||{}),active:false};save();$('#playerProgress').style.width='0%';if(hide)$('#floatingPlayer').classList.remove('active');updatePlayer();syncRecitationControl();}

const atharPool=[
 {type:'آية',text:'وَقُل رَّبِّ زِدْنِي عِلْمًا',ref:'طه: 114'},
 {type:'آية',text:'إِنَّ مَعَ الْعُسْرِ يُسْرًا',ref:'الشرح: 6'},
 {type:'آية',text:'فَاذْكُرُونِي أَذْكُرْكُمْ',ref:'البقرة: 152'},
 {type:'آية',text:'إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَالَّذِينَ هُم مُّحْسِنُونَ',ref:'النحل: 128'},
 {type:'آية',text:'وَاصْبِرْ فَإِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ',ref:'هود: 115'},
 {type:'حديث نبوي',text:'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى.',ref:'صحيح البخاري وصحيح مسلم'},
 {type:'حديث نبوي',text:'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ.',ref:'صحيح البخاري وصحيح مسلم'},
 {type:'حديث نبوي',text:'لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ.',ref:'صحيح البخاري وصحيح مسلم'},
 {type:'حديث نبوي',text:'المُسْلِمُ مَنْ سَلِمَ المُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ.',ref:'صحيح البخاري وصحيح مسلم'},
 {type:'حديث نبوي',text:'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ.',ref:'صحيح مسلم'},
 {type:'حديث نبوي',text:'يَسِّرُوا وَلاَ تُعَسِّرُوا، وَبَشِّرُوا وَلاَ تُنَفِّرُوا.',ref:'صحيح البخاري وصحيح مسلم'},
 {type:'حديث قدسي',text:'يَا عِبَادِي، إِنِّي حَرَّمْتُ الظُّلْمَ عَلَى نَفْسِي، وَجَعَلْتُهُ بَيْنَكُمْ مُحَرَّمًا، فَلا تَظَالَمُوا.',ref:'صحيح مسلم'},
 {type:'حديث قدسي',text:'أَنَا عِنْدَ ظَنِّ عَبْدِي بِي، وَأَنَا مَعَهُ حِينَ يَذْكُرُنِي.',ref:'صحيح البخاري وصحيح مسلم'},
 {type:'حديث قدسي',text:'مَنْ عَادَى لِي وَلِيًّا فَقَدْ آذَنْتُهُ بِالْحَرْبِ.',ref:'صحيح البخاري'},
 {type:'حديث قدسي',text:'يَا ابْنَ آدَمَ، إِنَّكَ مَا دَعَوْتَنِي وَرَجَوْتَنِي غَفَرْتُ لَكَ عَلَى مَا كَانَ مِنْكَ وَلا أُبَالِي.',ref:'رواه الترمذي'}
];
function save(){localStorage.setItem(storeKey,JSON.stringify(state));}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2300)}
function go(view){
  if(!view) return;
  const target=$('#view-'+view);
  if(!target) return;
  document.body.dataset.view=view;
  $$('.view').forEach(x=>x.classList.remove('active','view-enter'));
  target.classList.add('active');
  $$('[data-view]').forEach(b=>{
    const on=b.dataset.view===view;
    b.classList.toggle('active',on);
    if(on)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  if(view==='quran')renderQuran();
  if(view==='recitations'){renderRecitations();loadMp3QuranReciters().catch(()=>{});} 
  if(view==='schedule')renderSchedule();
  if(view==='galaxy')renderHifz();
  if(view==='progress')renderProgressDashboard();
  updateHome();
  if(typeof updatePageAmbient==='function') updatePageAmbient(view);
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
function percent(){const p=state.plan;return p.goal&&p.days?Math.min(100,Math.round((Math.max(0,p.goal-(p.remaining||p.goal))/p.goal)*100)):0}
function buildDynamicAthars(){
  const verseItems=quran.map((surah,i)=>{
    const verses=surah.verses||[];
    const v=verses[(i*7)%Math.max(1,verses.length)];
    return v?{type:'آية',text:v.text,ref:`${surah.name} · آية ${v.a}`} : null;
  }).filter(Boolean);
  return [...atharPool,...verseItems];
}
function getDynamicAthar(seed){
  const pool=buildDynamicAthars();
  if(!pool.length)return {type:'أثر',text:'—',ref:'—'};
  const nonce=Number(state.atharNonce||0);
  return pool[(seed*17+nonce*13)%pool.length];
}

function activityDayKey(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function ensureActivity(){state.activityLog=state.activityLog||{};return state.activityLog}
function touchActivity(kind='general',amount=1){const log=ensureActivity(),k=activityDayKey(),d=log[k]||{read:0,sessions:0,mem:0,athar:0};d[kind]=(d[kind]||0)+Number(amount||1);d.last=Date.now();log[k]=d;recomputeStreak();save();document.dispatchEvent(new CustomEvent('rafiq-activity-change',{detail:{kind,amount:Number(amount||1)}}))}
function dayActivity(k){const d=state.activityLog?.[k]||{};return (d.read||0)+(d.sessions||0)*2+(d.mem||0)*5+(d.athar||0)}
function recomputeStreak(){let streak=0,best=0;const today=new Date();for(let i=0;i<366;i++){const d=new Date(today);d.setDate(today.getDate()-i);if(dayActivity(activityDayKey(d))>0)streak++;else break}let run=0;for(let i=365;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);if(dayActivity(activityDayKey(d))>0){run++;best=Math.max(best,run)}else run=0}state.streak=Math.max(streak,state.streak||0);state.bestStreak=Math.max(best,state.bestStreak||0)}
function planForecast(){const mf=window.RAFIQ_MEM_FORECAST;if(mf)return mf;const p=state.plan||{};if(!p.goal||!p.daily)return {text:'لا توجد خطة',detail:'أنشئ خطة لمعرفة الموعد المتوقع.'};const remaining=Math.max(0,Number(p.remaining!=null?p.remaining:p.goal));const daily=Math.max(.01,Number(p.daily));const days=Math.ceil(remaining/daily);const when=new Date();when.setDate(when.getDate()+days);return {text:days===0?'اكتملت الخطة':`${days} يوم تقريبًا`,detail:days===0?'ما شاء الله، وصلت للهدف.':`لو حافظت على ${daily} ${p.unit||''} يوميًا، فالموعد التقريبي ${when.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`}}
function getWeekScores(){
  const names=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const today=new Date(),out=[];
  for(let i=6;i>=0;i--){
    const d=new Date(today); d.setDate(today.getDate()-i);
    const k=activityDayKey(d),log=state.activityLog?.[k]||{};
    out.push({name:names[d.getDay()],score:dayActivity(k),read:log.read||0,sessions:log.sessions||0,mem:log.mem||0,athar:log.athar||0,date:k});
  }
  return out;
}
function drawActivityChart(){
  const c=document.getElementById('activityChart');if(!c)return;
  const r=c.getBoundingClientRect(),w=Math.max(320,Math.floor(r.width)),h=290,dpr=Math.min(devicePixelRatio||1,1.5);
  if(c.__w===w&&c.__dpr===dpr&&c.__v===(state.__activityVersion||0))return;
  c.__w=w;c.__dpr=dpr;c.__v=state.__activityVersion||0;c.width=w*dpr;c.height=h*dpr;
  const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const vals=[];for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);vals.push(dayActivity(activityDayKey(d)))}
  const max=Math.max(8,...vals),px=20,pt=22,pb=34,span=w-px*2,innerH=h-pt-pb,step=span/29;
  ctx.strokeStyle='rgba(233,205,112,.08)';ctx.lineWidth=1;for(let j=0;j<4;j++){const y=pt+innerH*(j/3);ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(w-px,y);ctx.stroke()}
  const pts=vals.map((v,i)=>[px+i*step,h-pb-(v/max)*innerH]);
  const grad=ctx.createLinearGradient(0,pt,0,h-pb);grad.addColorStop(0,'rgba(244,220,134,.24)');grad.addColorStop(1,'rgba(52,214,162,.02)');ctx.fillStyle=grad;
  ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.lineTo(w-px,h-pb);ctx.lineTo(px,h-pb);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#f4dc86';ctx.lineWidth=2.2;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  ctx.fillStyle='#f4dc86';for(let i=0;i<pts.length;i++){if(vals[i]<=0)continue;const [x,y]=pts[i];ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill()}
}

function savedMemorizationStats(){
  const saved=new Set(Array.isArray(hifz)?hifz:[]); let savedAyahs=0;
  for(let i=0;i<quran.length;i++) if(saved.has(i+1)) savedAyahs+=(quran[i]?.verses?.length||quran[i]?.count||0);
  const totalAyahs=quran.reduce((n,x)=>n+(x?.verses?.length||x?.count||0),0)||6236;
  const groups={'الزهراوان':[2,3],'الطواسين':[26,27,28],'الحواميم':[40,41,42,43,44,45,46],'المسبحات':[17,57,59,61,62,64],'المعوذات':[112,113,114]};
  const groupStats={}; Object.entries(groups).forEach(([name,nums])=>{let surahs=0,ayahs=0,total=0;nums.forEach(n=>{const q=quran[n-1];if(!q)return;const c=q.verses?.length||q.count||0;total+=c;if(saved.has(n)){surahs++;ayahs+=c;}});groupStats[name]={surahs,ayahs,total,count:nums.length};});
  return {savedSurahs:saved.size,savedAyahs,totalAyahs,juzEquivalent:Math.max(0,Math.min(30,(savedAyahs/totalAyahs)*30)),groupStats};
}
function renderMemorizationSummary(){
  const groupsBox=document.getElementById('memGroups'), box=document.getElementById('homeMemSummary'); if(!groupsBox||!box)return;
  const st=savedMemorizationStats(); const ps=Math.round(st.savedSurahs/114*100),pa=Math.round(st.savedAyahs/st.totalAyahs*100),pj=Math.round(st.juzEquivalent/30*100);
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('memSurahCount',`${st.savedSurahs} / 114`);set('memAyahCount',`${st.savedAyahs.toLocaleString('ar-EG')} آية`);set('memJuzCount',`${st.juzEquivalent.toFixed(st.juzEquivalent%1?1:0)} / 30`);set('homeMemDetail',`${st.savedSurahs} سورة · ${st.savedAyahs.toLocaleString('ar-EG')} آية · نحو ${st.juzEquivalent.toFixed(st.juzEquivalent%1?1:0)} جزء من 30`);
  [['memSurahRing',ps],['memAyahRing',pa],['memJuzRing',pj]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.style.setProperty('--ring',`${v}%`)});
  groupsBox.innerHTML=Object.entries(st.groupStats).map(([name,g])=>`<div class="mem-group"><div class="mem-group-icon">✦</div><div class="mem-group-copy"><b>${name}</b><span>${g.surahs} من ${g.count} سور · ${g.ayahs.toLocaleString('ar-EG')} آية</span></div><div class="mem-group-mini"><i style="width:${g.total?Math.round(g.ayahs/g.total*100):0}%"></i></div></div>`).join('');
}
function updateActivitySummary(){
  ensureActivity();recomputeStreak();
  const week=getWeekScores(), pct=percent();
  const raw=((Number(state.streak)||0)/45)*.38+((Array.isArray(hifz)?hifz.length:0)/114)*.34+(pct/100)*.18+(Math.min(7,week.filter(x=>x.score>0).length)/7)*.10;
  const intensity=Math.max(.34,Math.min(1,raw));
  document.body.style.setProperty('--activity-intensity',intensity.toFixed(3));
  const pFlame=document.getElementById('progressFlameVisual');if(pFlame)pFlame.style.setProperty('--flame-scale',(0.82+intensity*.52).toFixed(2));
  const memAyahs=(Array.isArray(state.memorizedAyahs)?state.memorizedAyahs.length:0);
  const mem=Array.isArray(hifz)?hifz.length:0,rem=Math.max(0,114-mem),forecast=planForecast();
  const avg=week.reduce((n,x)=>n+x.score,0)/7,weekPct=Math.min(100,Math.round(avg/8*100));
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('heroFlameValue',`${state.streak||0} يوم`);set('heroFlameSub',`أفضل سلسلة ${state.bestStreak||state.streak||0} يوم`);
  set('homeMemProgress',`${mem} / 114`);set('homeMemRemaining',`باقي ${rem} سورة`);
  set('homePlanProgress',state.plan?.goal?`${pct}%`:'—');set('homeFinishEstimate',state.plan?.goal?forecast.text:'أنشئ خطة لمعرفة الموعد المتوقع');
  const bars=document.getElementById('homeWeekBars');
  if(bars)bars.innerHTML=week.map(x=>{const h=Math.min(100,Math.round(x.score/8*100));return `<div class="week-bar"><div class="bar-track"><div class="bar-fill" style="height:${Math.max(4,h)}%"></div></div><b>${Math.round(x.score)}</b><small>${x.name}</small></div>`}).join('');
  state.__activityVersion=(state.__activityVersion||0)+1;
  document.dispatchEvent(new CustomEvent('rafiq-home-updated'));
}

function renderProgressDashboard(){
  updateActivitySummary();
  const mem=Array.isArray(hifz)?hifz.length:0,rem=Math.max(0,114-mem),forecast=planForecast(),week=getWeekScores(),ms=savedMemorizationStats();
  const weekAvg=week.reduce((n,x)=>n+x.score,0)/7,weekPct=Math.min(100,Math.round(weekAvg/8*100));
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('progressFlame',`${state.streak||0} يوم`);set('progressBest',`أفضل سلسلة: ${state.bestStreak||state.streak||0} يوم`);set('progressMem',`${mem} / 114`);set('progressMemRemain',`باقي ${rem} سورة`);
  const planPct=percent(),active7=week.filter(x=>x.score>0).length;set('progressPlanPct',state.plan?.goal?`${planPct}%`:'—');set('progressPlanEta',forecast.detail);set('progressActiveDays',`${active7} يوم`);set('progressSessions7',`${week.reduce((n,x)=>n+x.sessions,0)} جلسة خلال 7 أيام`);
  const wd=document.getElementById('weekDetail');if(wd)wd.innerHTML=week.map(x=>{const pct=Math.min(100,Math.round(x.score/8*100));return `<article class="week-detail-row"><div class="week-day-badge"><strong>${x.name}</strong><small>${x.date}</small></div><div class="week-progress-stack"><div class="mini-track"><i style="width:${pct}%"></i></div><div class="week-metrics"><span>📖 ${x.read}</span><span>🎧 ${x.sessions}</span><span>✨ ${x.mem}</span><span>🪶 ${x.athar}</span></div></div><div class="day-score"><b>${Math.round(x.score)}</b><small>نشاط</small></div></article>`}).join('');
  const finish=document.getElementById('finishForecast');if(finish)finish.innerHTML=state.plan?.goal?`<div class="forecast-orb" style="--ring:${planPct}%"><div><strong>${planPct}%</strong><span>التزام</span></div></div><strong>${forecast.text}</strong><p>${forecast.detail}</p><span class="badge">المتبقي: ${state.plan.remaining??state.plan.goal} ${state.plan.unit||''}</span>`:`<div class="forecast-orb empty"><div><strong>—</strong><span>خطة</span></div></div><strong>ابدأ بخطة</strong><p>بمجرد تحديد الهدف والمعدل اليومي هتشوف هنا تقديرًا واضحًا لموعد الانتهاء.</p><button class="btn primary" type="button" data-go="plan">افتح الخطة</button>`;
  const j=document.getElementById('journeyBars');if(j)j.innerHTML=`<div class="journey-row"><b>حفظ السور</b><div class="journey-track"><i style="width:${Math.round(mem/114*100)}%"></i></div><span>${mem}/114 سورة</span></div><div class="journey-row"><b>الآيات المحفوظة</b><div class="journey-track"><i style="width:${Math.round(ms.savedAyahs/ms.totalAyahs*100)}%"></i></div><span>${ms.savedAyahs.toLocaleString('ar-EG')} آية</span></div><div class="journey-row"><b>مقدار الأجزاء</b><div class="journey-track"><i style="width:${Math.round(ms.juzEquivalent/30*100)}%"></i></div><span>≈ ${ms.juzEquivalent.toFixed(ms.juzEquivalent%1?1:0)} / 30</span></div><div class="journey-row"><b>نشاط الأسبوع</b><div class="journey-track"><i style="width:${weekPct}%"></i></div><span>${weekPct}%</span></div>`;
  const heat=document.getElementById('activityHeatmap');if(heat){heat.innerHTML='';for(let i=89;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const sc=dayActivity(activityDayKey(d)),el=document.createElement('div');el.className='heat-cell '+(sc>=10?'l4':sc>=6?'l3':sc>=2?'l2':sc>0?'l1':'');el.title=`${activityDayKey(d)} · نشاط ${Math.round(sc)}`;heat.appendChild(el)}}
  renderMemorizationSummary();drawActivityChart();
}

function updateHome(){
  const pct=percent();$('#homePct').textContent=pct+'%';$('#homeOrb').style.setProperty('--p',pct+'%');
  $('#statSessions').textContent=state.sessions||0;$('#statStreak').textContent=state.streak||0;
  const last=state.last||{},lastSurah=quran.length&&last.s?quran[last.s-1]?.name||'موضع محفوظ':'غير محدد';
  $('#statLast').innerHTML=last.s?`<button class="last-position-cta" type="button"><strong>${lastSurah} · آية ${last.a||'—'}</strong></button>`:'غير محدد';
  $('#statLast .last-position-cta')?.addEventListener('click',()=>$('#resumeBtn')?.click());
  const resume=$('#resumePosition'),meta=$('#resumePositionMeta'),btn=$('#resumeBtn');
  if(resume)resume.textContent=last.s&&quran[last.s-1]?`${quran[last.s-1].name} · الآية ${last.a||1}`:'لم تحدد موضعًا بعد';
  if(meta)meta.textContent=last.s&&quran[last.s-1]?'آخر موضع محفوظ على هذا الجهاز':'ابدأ القراءة وسيحفظ رفيق القرآن آخر موضع لك تلقائيًا';
  if(btn)btn.disabled=!last.s;
  if(btn)btn.onclick=()=>{if(!last.s)return;go('quran');setTimeout(()=>window.openAyahStudy?.(Number(last.s),Number(last.a||1)),250)};
  const todayStart=$('#todayFocusStart');if(todayStart&&!todayStart.dataset.bound){todayStart.dataset.bound='1';todayStart.addEventListener('click',()=>{if(window.RAFIQ_MEM?.startSession){window.RAFIQ_MEM.startSession();}else{go('plan');setTimeout(()=>window.RAFIQ_MEM?.startSession?.(),500);}});}
  updateActivitySummary();document.dispatchEvent(new CustomEvent('rafiq-home-refresh'));
}
document.addEventListener('rafiq-memorization-change',()=>{updateHome();if(document.body.dataset.view==='progress')renderProgressDashboard();});
async function loadQuran(){
  const cacheKey='rafiq-quran-uthmani-v2';
  const dbOpen=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('rafiq-data',1);r.onupgradeneeded=()=>r.result.createObjectStore('cache');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const dbGet=async()=>{try{const db=await dbOpen();return await new Promise((res,rej)=>{const t=db.transaction('cache','readonly');const g=t.objectStore('cache').get(cacheKey);g.onsuccess=()=>res(g.result||null);g.onerror=()=>rej(g.error)})}catch{return null}};
  const dbPut=async(value)=>{try{const db=await dbOpen();await new Promise((res,rej)=>{const t=db.transaction('cache','readwrite');const q=t.objectStore('cache').put(value,cacheKey);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}catch{}};
  try{
    const local=await fetch('quran-uthmani.json',{cache:'force-cache'});
    if(local.ok){quran=await local.json(); await dbPut(quran);}
    else throw new Error('local');
  }catch{
    const cached=await dbGet();
    if(cached){quran=cached;}
    else if(navigator.onLine){
      try{
        const r=await fetch('https://api.alquran.cloud/v1/quran/quran-uthmani',{cache:'no-store'});
        if(!r.ok)throw new Error('download');
        const payload=await r.json();
        const surahs=payload?.data?.surahs;
        if(!Array.isArray(surahs)||surahs.length!==114)throw new Error('invalid-quran');
        quran=surahs.map(s=>({s:s.number,name:s.name,type:(s.revelationType||'').toLowerCase().includes('makk')?'مكية':'مدنية',count:s.numberOfAyahs,verses:(s.ayahs||[]).map(v=>({a:v.numberInSurah,global:v.number,text:v.text}))}));
        await dbPut(quran);
      }catch(e){toast('تعذر تحميل بيانات المصحف؛ تحقق من الاتصال أو أعد المحاولة');renderHifz();return;}
    }else{toast('المصحف غير متاح دون اتصال حتى يتم تحميله مرة واحدة');renderHifz();return;}
  }
  window.RAFIQ_QURAN=quran;
  atharIndex=(ritualKey().split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),17))%Math.max(1,buildDynamicAthars().length);
  renderAthar(atharIndex);renderSurahGrid();renderQuran();renderRecitations();loadMp3QuranReciters().catch(()=>{});updateHome();renderHifz();renderMemorizationSummary();renderProgressDashboard();restoreAudioState();window.dispatchEvent(new CustomEvent('rafiq-quran-ready'));
}
function restoreAudioState(){const a=state.audio||{};const pref=state.prefs?.reciter||a.reciter;const r=reciters.find(x=>x.folder===pref)||reciters[0];audioState.reciter=r;if(a.surah&&quran[a.surah-1]){audioState.surah=a.surah;audioState.verseIndex=Math.max(0,Math.min(a.verseIndex||0,(quran[a.surah-1]?.verses.length||1)-1));}updatePlayer();updateQuranReciterButton();}
function renderSurahGrid(filter=''){const q=(filter||'').trim();$('#surahGrid').innerHTML=quran.map((s,i)=>({s,i})).filter(x=>!q||x.s.name.includes(q)||String(x.i+1)===q).map(x=>`<button class="surah-btn ${currentSurah===x.i+1?'active':''}" data-s="${x.i+1}"><span class="surah-no">${x.i+1}</span><span class="surah-copy"><b>${x.s.name}</b><small>${x.s.type} · ${x.s.count} آيات</small></span></button>`).join('');$$('#surahGrid [data-s]').forEach(b=>b.onclick=()=>{currentSurah=+b.dataset.s;state.last={s:currentSurah,a:1};save();renderSurahGrid($('#surahSearch').value);renderQuran();updateHome();})}
function renderQuran(){
  const s=quran[currentSurah-1]; if(!s)return;
  $('#quranInfo').textContent=s.name;
  $('#surahTitle').textContent=s.name;
  $('#surahMeta').textContent=`${s.type} · ${s.count} آيات`;
  const memorized = new Set(Array.isArray(state.memorizedAyahs)?state.memorizedAyahs:[]);
  const lastAyah = state.last?.s===currentSurah ? Number(state.last?.a||0) : 0;
  $('#ayahs').innerHTML=s.verses.map(v=>{const key=`${currentSurah}:${v.a}`,isMem=memorized.has(key),isLast=v.a===lastAyah;return `<article class="quran-ayah ${isMem?'memorized':''}" data-ayah="${v.a}" data-last-position="${isLast?'1':'0'}"><div class="quran-text">${v.text}</div><div class="ayah-meta"><span>${s.name} · ${v.a}</span>${isLast?'<span class="last-position-badge">📌 آخر موضع</span>':''}</div><div class="ayah-actions"><button class="btn quran-ayah-btn" type="button" data-mark="${v.a}">📍 حفظ الموضع</button><button class="btn quran-ayah-btn ${isMem?'memorized-btn':''}" type="button" data-memorize="${v.a}">${isMem?'✨ الآية محفوظة':'💚 حفظت الآية'}</button><button class="btn quran-ayah-btn" type="button" data-ayah-study="${v.a}">📖 أدوات الآية</button><button class="btn quran-ayah-btn" type="button" data-ayah-play="${v.a}">▶ استماع</button><button class="btn quran-ayah-btn download-ayah-btn" type="button" data-ayah-download="${v.a}">⬇ تحميل</button></div></article>`}).join('');
  $$('[data-mark]').forEach(b=>b.onclick=()=>{state.last={s:currentSurah,a:+b.dataset.mark};save();renderQuran();updateHome();document.querySelector(`.quran-ayah[data-ayah="${b.dataset.mark}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});toast(`تم حفظ آخر موضع: ${s.name} · آية ${b.dataset.mark} ✅`)});
  $$('[data-memorize]').forEach(b=>b.onclick=()=>{const a=+b.dataset.memorize,key=`${currentSurah}:${a}`;state.memorizedAyahs=Array.isArray(state.memorizedAyahs)?state.memorizedAyahs:[];const has=state.memorizedAyahs.includes(key);state.memorizedAyahs=has?state.memorizedAyahs.filter(x=>x!==key):[...state.memorizedAyahs,key];if(!has)touchActivity('mem',1);save();renderQuran();updateHome();toast(has?'أزيلت علامة حفظ الآية':'تم حفظ الآية ✨ وأصبح لونها زمرديًا وذهبيًا')});
  $$('[data-ayah-study]').forEach(b=>b.onclick=()=>window.openAyahStudy?.(currentSurah,+b.dataset.ayahStudy,'summary'));
  $$('[data-ayah-play]').forEach(b=>b.onclick=()=>ensureReciterAndPlay(currentSurah,+b.dataset.ayahPlay));$$('[data-ayah-download]').forEach(b=>b.onclick=()=>{recitationControl.surah=currentSurah;recitationControl.ayah=Number(b.dataset.ayahDownload)||1;syncRecitationControl();openRecitationDownloadModal('ayah');});
  $$('[data-study-topic]').forEach(b=>b.onclick=()=>window.openAyahStudy?.(currentSurah,state.last?.a||1,b.dataset.studyTopic||'summary'));
  updateSurahHifzControl();
  syncRecitationSelectors();
  updateQuranReciterButton();
  if(state.last?.s===currentSurah && state.last?.a){
    const target=document.querySelector(`.quran-ayah[data-ayah="${Number(state.last.a)}"]`);
    if(target && !window.__rafiqSuppressLastJump){
      requestAnimationFrame(()=>target.scrollIntoView({behavior:'auto',block:'center'}));
    }
  }
}
function openStudyTopic(topic, ayahNumber=1){ window.openAyahStudy?.(currentSurah, ayahNumber, topic||'summary'); }
function ensureReciterAndPlay(surah, ayahNumber=1){
  const prefFolder=state.prefs?.reciter||state.audio?.reciter;
  const r=reciters.find(x=>x.folder===prefFolder);
  if(r){ playRecitation(r,surah,Math.max(0,ayahNumber-1)); return; }
  openReciterChooser(surah,ayahNumber);
}
function updateQuranReciterButton(){
  const btn=$('#quranReciterBtn'); if(!btn)return;
  const r=reciters.find(x=>x.folder===(state.prefs?.reciter||state.audio?.reciter));
  btn.textContent=r?`🎙️ ${r.name}`:'🎙️ اختر القارئ';
}
async function openReciterChooser(surah=currentSurah,ayahNumber=1){
  const body=$('#modalBody'), modal=$('#modal'); if(!body||!modal)return;
  const title=$('#modalTitle'); if(title)title.textContent='🎙️ اختر قارئك المفضل';

  // The Quran page and the recitations page use the same live MP3Quran list.
  // Never expose the initial 4 fallback readers as the final chooser when the
  // full list is still loading: wait for the live list first.
  if(reciters.length<10){
    body.innerHTML='<div class="reciter-choice-loading">جاري تحميل قائمة القراء كاملة من مصدر التلاوات…</div>';
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    try{await loadMp3QuranReciters();}catch{}
  }

  const allReciters=[...reciters];
  body.innerHTML=`<div class="reciter-choice-intro"><strong>كل القراء المتاحين في صفحة التلاوات</strong><span>${allReciters.length} قارئًا متاحًا حاليًا</span><small>اختر قارئك، وسيُحفظ اختيارك على هذا الجهاز ويمكن تغييره لاحقًا.</small></div><div class="reciter-choice-search-wrap"><input id="reciterChoiceSearch" class="reciter-choice-search" type="search" placeholder="ابحث باسم القارئ…" aria-label="البحث عن قارئ"/><span id="reciterChoiceCount">${allReciters.length} قارئ</span></div><div class="reciter-chooser-grid" id="reciterChoiceGrid"></div>`;

  modal.classList.add('open'); modal.setAttribute('aria-hidden','false');

  const grid=$('#reciterChoiceGrid');
  const search=$('#reciterChoiceSearch');
  const count=$('#reciterChoiceCount');
  const renderChoices=(query='')=>{
    const q=String(query||'').trim().toLocaleLowerCase('ar');
    const filtered=q?allReciters.filter(r=>String(r.name||'').toLocaleLowerCase('ar').includes(q)):allReciters;
    if(count)count.textContent=`${filtered.length} قارئ`;
    if(!grid)return;
    grid.innerHTML=filtered.map((r)=>{
      const i=allReciters.indexOf(r);
      const selected=(state.prefs?.reciter||state.audio?.reciter)===r.folder;
      return `<button class="reciter-choice ${selected?'is-selected':''}" type="button" data-reciter-choice="${i}"><span class="reciter-choice-icon" aria-hidden="true">🎧</span><strong>${r.name}</strong><small>${r.quality} · ${r.mode==='surah'?'السورة كاملة':'آية بآية'}</small>${selected?'<em>✓ القارئ الحالي</em>':''}</button>`;
    }).join('')||'<div class="reciter-choice-empty">لا يوجد قارئ بهذا الاسم.</div>';
    $$('#modalBody [data-reciter-choice]').forEach(b=>b.onclick=async()=>{
      const r=allReciters[+b.dataset.reciterChoice]; if(!r)return;
      state.prefs=state.prefs||{}; state.prefs.reciter=r.folder;
      state.audio=state.audio||{}; state.audio.reciter=r.folder; state.audio.source=r.source; save();
      updateQuranReciterButton();
      modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
      toast(`تم تثبيت القارئ: ${r.name}`);
      await playRecitation(r,surah,Math.max(0,ayahNumber-1));
    });
  };
  renderChoices();
  search?.addEventListener('input',()=>renderChoices(search.value));
}
function updateSurahHifzControl(){
  const btn=$('#markSurahMemorized'), stateEl=$('#surahHifzState');
  if(!btn||!stateEl)return;
  const active=hifz.includes(currentSurah);
  btn.textContent=active?'✦ السورة محفوظة':'✦ حفظت السورة';
  btn.classList.toggle('primary',!active);
  stateEl.textContent=active?'نجمتها مضيئة في مجرة الحفظ':'لم تُعلّم كمحفوظة بعد';
  stateEl.classList.toggle('is-on',active);
}
$('#markSurahMemorized')?.addEventListener('click',()=>{
  const active=hifz.includes(currentSurah);
  if(active) hifz=hifz.filter(n=>n!==currentSurah); else hifz=[...hifz,currentSurah].sort((a,b)=>a-b);
  state.hifz=hifz;save();
  if(!active) touchActivity('mem',1);
  updateSurahHifzControl(); renderHifz(); toast(active?'أُزيلت علامة حفظ السورة':'اكتمل حفظ السورة ✦ وأُضيئت نجمتها');
});
$('#surahSearch').addEventListener('input',e=>renderSurahGrid(e.target.value));$('#prevSurah').onclick=()=>{currentSurah=Math.max(1,currentSurah-1);renderSurahGrid($('#surahSearch').value);renderQuran();updateHome()};$('#nextSurah').onclick=()=>{currentSurah=Math.min(quran.length,currentSurah+1);renderSurahGrid($('#surahSearch').value);renderQuran();updateHome()};$('#goLast').onclick=()=>{currentSurah=state.last?.s||1;go('quran');renderQuran();setTimeout(()=>document.querySelector(`.quran-ayah[data-ayah="${state.last?.a||1}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),40);toast(`آخر موضع: ${quran[currentSurah-1]?.name||'السورة'} · آية ${state.last?.a||1}`)};
function getDownloadGroups(){return [
 {key:'zahrawain',title:'الزهراوان',sub:'البقرة + آل عمران',surahs:[2,3]},
 {key:'tawaseem',title:'الطواسين',sub:'الشعراء + النمل + القصص',surahs:[26,27,28]},
 {key:'hawamim',title:'الحواميم',sub:'غافر إلى الأحقاف',surahs:[40,41,42,43,44,45,46]},
 {key:'musabbihat',title:'المسبحات',sub:'السور التي افتتحت بالتسبيح',surahs:[17,57,59,61,62,64,87]},
 {key:'muawwidhat',title:'المعوذات',sub:'الإخلاص + الفلق + الناس',surahs:[112,113,114]},
 {key:'mufassal',title:'المفصل',sub:'من ق إلى الناس',surahs:Array.from({length:65},(_,i)=>50+i)}
]}
function downloadLabel(filename){return filename.replace(/[\\/:*?"<>|]/g,'-')}
function triggerDirectDownload(url,filename){const a=document.createElement('a');a.href=url;a.download=downloadLabel(filename);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}
async function fetchJuzVerseRefs(juz){
  const range=await window.RAFIQ_QURAN_INDEX?.resolve?.('juz',juz,1);
  if(!range){toast('هذا التقسيم غير متاح أوفلاين بعد؛ اتصل بالإنترنت مرة واحدة لمزامنة الفهرس.');return [];}
  const refs=[];
  for(let s=range.start.s;s<=range.end.s;s++){
    const sur=quran[s-1]; if(!sur)continue;
    const first=s===range.start.s?range.start.a:1;
    const last=s===range.end.s?range.end.a:(sur.verses?.length||sur.count||0);
    for(let a=first;a<=last;a++)refs.push({s,a,ref:`${s}:${a}`});
  }
  return refs;
}
function uniqueSurahsFromRefs(refs){return [...new Set(refs.map(x=>x.s))]}
function downloadUrlsForRefs(reciter,refs){return refs.map(x=>({url:audioUrl(reciter,x.s,x.a),filename:`Rafiq-${String(x.s).padStart(3,'0')}-${String(x.a).padStart(3,'0')}.mp3`}))}
function openDownloadCenter(mode='surah',preset=null){
  recitationControl.surah=Number(currentSurah)||1;
  recitationControl.ayah=Number(preset?.ayah||state.last?.a||1)||1;
  syncRecitationControl();
  return openRecitationDownloadModal(mode);
}
function downloadAyah(surah,ayah){openDownloadCenter('ayah')}
$('#downloadSurahBtn')?.addEventListener('click',()=>openDownloadCenter());
$('#quranPauseBtn')?.addEventListener('click',()=>{
 if(!qAudio)return;
 if(audioState.active&&!qAudio.paused){qAudio.pause();window.isAudioPlaying=false;updatePlayer();toast('تم إيقاف التلاوة ⏸️');}
 else if(audioState.active){qAudio.play().then(()=>{window.isAudioPlaying=true;updatePlayer();}).catch(()=>toast('تعذر استئناف التلاوة'))}
 else ensureReciterAndPlay(currentSurah,state.last?.a||1);
});
qAudio?.addEventListener('play',()=>{$('#quranPauseBtn')?.setAttribute('data-playing','true')});
qAudio?.addEventListener('pause',()=>{$('#quranPauseBtn')?.removeAttribute('data-playing')});

const RECITATION_GROUPS={
  zahrawain:{title:'الزهراوان',sub:'البقرة + آل عمران',surahs:[2,3]},
  tawaseem:{title:'الطواسين',sub:'الشعراء + النمل + القصص',surahs:[26,27,28]},
  hawamim:{title:'الحواميم',sub:'غافر → الأحقاف',surahs:[40,41,42,43,44,45,46]},
  musabbihat:{title:'المسبحات',sub:'السور التي افتتحت بالتسبيح',surahs:[17,57,59,61,62,64,87]},
  muawwidhat:{title:'المعوذات',sub:'الإخلاص + الفلق + الناس',surahs:[112,113,114]},
  mufassal:{title:'المفصل',sub:'ق → الناس',surahs:Array.from({length:65},(_,i)=>50+i)}
};
let recitationControl={reciter:reciters[0],surah:1,ayah:1};
function syncRecitationControl(){
  const rs=$('#recitationReciterSelect'), ss=$('#recitationSurahSelect'), as=$('#recitationAyahSelect');
  const r=reciters.find(x=>x.folder===(state.prefs?.reciter||audioState.reciter?.folder))||reciters[0];
  recitationControl.reciter=r;
  recitationControl.surah=Math.max(1,Math.min(quran.length,Number(recitationControl.surah||currentSurah||1)));
  const s=quran[recitationControl.surah-1];
  recitationControl.ayah=Math.max(1,Math.min(s?.verses?.length||1,Number(recitationControl.ayah||1)));
  if(rs){rs.innerHTML=reciters.map(r=>`<option value="${r.folder}">${r.name} · ${r.quality}${r.mode==='surah'?' · سورة كاملة':' · آية بآية'}</option>`).join('');rs.value=r.folder;}
  if(ss){ss.innerHTML=quran.map((s,i)=>`<option value="${i+1}">${i+1}. ${s.name}</option>`).join('');ss.value=String(recitationControl.surah);}
  if(as){as.innerHTML=(s?.verses||[]).map(v=>`<option value="${v.a}">الآية ${v.a}</option>`).join('');as.value=String(recitationControl.ayah);as.disabled=r.mode==='surah';const wrap=$('#recitationAyahWrap');if(wrap)wrap.style.opacity=r.mode==='surah'?'.55':'1';}
  const now=$('#recitationNow');if(now)now.textContent=`القارئ: ${r.name} · السورة: ${s?.name||'—'}${r.mode==='verse'?` · الآية ${recitationControl.ayah}`:' · السورة كاملة'}${!reciterHasSurah(r,recitationControl.surah)?' · السورة غير متاحة لهذا القارئ':''}`;
  const stop=$('#stopSelectedRecitation'); if(stop) stop.disabled=!audioState.active;
}
function syncRecitationSelectors(){ syncRecitationControl(); }
function selectReciter(r){
  if(!r)return;
  state.prefs=state.prefs||{};state.prefs.reciter=r.folder;
  audioState.reciter=r;recitationControl.reciter=r;
  state.audio={...(state.audio||{}),reciter:r.folder,source:r.source};save();updateQuranReciterButton();syncRecitationSelectors();syncRecitationControl();
  $$('#audioGrid .reciter-card').forEach(c=>c.classList.toggle('is-selected',Number(c.dataset.reciterCard)===reciters.indexOf(r)));
}
let reciterPage=1;
const RECITERS_PER_PAGE=18;
function getRecitationPool(){
  const q=(($('#reciterSearch')?.value||'').trim()).toLocaleLowerCase('ar');
  return q?reciters.filter(r=>String(r.name||'').toLocaleLowerCase('ar').includes(q)):reciters;
}
function reciterCardHtml(r,i){
  return `<article class="card audio-live reciter-card ${r.folder===recitationControl.reciter.folder?'is-selected':''}" data-reciter-card="${i}">
    <div class="reciter-card-inner">
      <div class="reciter-icon" aria-hidden="true">🎧</div>
      <h3>${escText(r.name)}</h3>
      <div class="reciter-quality">${escText(r.quality)} · ${r.mode==='surah'?'السورة كاملة':'آية بآية'}</div>
      <p class="reciter-meta">${r.source==='mp3quran'&&Array.isArray(r.availableSurahs)?`متاح له ${r.availableSurahs.length} سورة.`:'تلاوة آية بآية.'}</p>
      <div class="hero-actions reciter-actions reciter-actions-compact">
        <button class="btn primary reciter-select-btn" type="button" data-select-reciter="${i}">اختيار</button>
        <button class="btn" type="button" data-play-reciter="${i}">▶ استمع</button>
        <button class="btn" type="button" data-download-reciter="${i}">⬇ تحميل</button>
      </div>
    </div>
  </article>`;
}
function bindReciterCards(){
  $$('#audioGrid [data-select-reciter]').forEach(b=>b.onclick=()=>{const r=reciters[Number(b.dataset.selectReciter)];selectReciter(r);toast(`تم اختيار القارئ: ${r.name}`);});
  $$('#audioGrid [data-play-reciter]').forEach(b=>b.onclick=()=>{const r=reciters[Number(b.dataset.playReciter)];if(!r)return;selectReciter(r);playRecitation(r,recitationControl.surah||currentSurah,0);});
  $$('#audioGrid [data-download-reciter]').forEach(b=>b.onclick=()=>{const r=reciters[Number(b.dataset.downloadReciter)];if(!r)return;selectReciter(r);openRecitationDownloadModal(r.mode==='surah'?'surah':'ayah');});
}
function renderRecitations(){
  const box=$('#audioGrid'); if(!box)return;
  if(!quran.length){box.innerHTML='<div class="card"><p class="muted">جاري تحميل المصحف والتلاوات…</p></div>';return;}
  syncRecitationControl();
  const pool=getRecitationPool();
  const totalPages=Math.max(1,Math.ceil(pool.length/RECITERS_PER_PAGE));
  reciterPage=Math.max(1,Math.min(reciterPage,totalPages));
  const slice=pool.slice((reciterPage-1)*RECITERS_PER_PAGE,reciterPage*RECITERS_PER_PAGE);
  box.innerHTML=slice.map(r=>reciterCardHtml(r,reciters.indexOf(r))).join('')||'<div class="card"><p class="muted">لا يوجد قارئ بهذا الاسم.</p></div>';
  bindReciterCards();
  const pager=$('#reciterPager');
  if(pager){
    pager.innerHTML=pool.length?`<button class="btn" type="button" data-reciter-page="prev" ${reciterPage===1?'disabled':''}>→ السابق</button><span>صفحة ${reciterPage} من ${totalPages} · ${pool.length} قارئ</span><button class="btn" type="button" data-reciter-page="next" ${reciterPage===totalPages?'disabled':''}>التالي ←</button>`:'';
    pager.querySelector('[data-reciter-page="prev"]')?.addEventListener('click',()=>{reciterPage--;renderRecitations();document.querySelector('#view-recitations')?.scrollIntoView({behavior:'smooth',block:'start'})});
    pager.querySelector('[data-reciter-page="next"]')?.addEventListener('click',()=>{reciterPage++;renderRecitations();document.querySelector('#view-recitations')?.scrollIntoView({behavior:'smooth',block:'start'})});
  }
}
document.addEventListener('input',e=>{if(e.target?.id==='reciterSearch'){reciterPage=1;renderRecitations()}});
document.addEventListener('click',e=>{if(e.target?.closest?.('#showAllReciters')){e.preventDefault();const input=$('#reciterSearch');if(input)input.value='';reciterPage=1;renderRecitations();}});
function buildRecitationItems(scope){
  const r=recitationControl.reciter||reciters[0]; const current=recitationControl.surah||currentSurah; const s=quran[current-1];
  const makeSurahItems=(nums)=>nums.flatMap(n=>{const ss=quran[n-1];if(!ss)return[];if(r.mode==='surah')return[{url:audioUrl(r,n,ss.verses?.[0]?.a||1),filename:`Rafiq-${String(n).padStart(3,'0')}-${ss.name}.mp3`}];return (ss.verses||[]).map(v=>({url:audioUrl(r,n,v.a),filename:`Rafiq-${String(n).padStart(3,'0')}-${String(v.a).padStart(3,'0')}.mp3`}));});
  if(scope==='ayah'){const a=recitationControl.ayah||1;return [{url:audioUrl(r,current,a),filename:`Rafiq-${String(current).padStart(3,'0')}-${String(a).padStart(3,'0')}.mp3`}];}
  if(scope==='surah')return makeSurahItems([current]);
  if(scope==='quran')return makeSurahItems(Array.from({length:quran.length},(_,i)=>i+1));
  if(RECITATION_GROUPS[scope])return makeSurahItems(RECITATION_GROUPS[scope].surahs);
  if(scope==='juz')return [];
  return [];
}
async function getJuzItems(juz){
  const r=recitationControl.reciter; if(!(juz>=1&&juz<=30))return [];
  const refs=await fetchJuzVerseRefs(juz);
  if(!refs.length)return [];
  if(r.mode==='surah'){const nums=[...new Set(refs.map(x=>x.s))];return buildRecitationItemsForReciter(r,nums);}
  return refs.map(x=>({url:audioUrl(r,x.s,x.a),filename:`Rafiq-${String(x.s).padStart(3,'0')}-${String(x.a).padStart(3,'0')}.mp3`}));
}
function buildRecitationItemsForReciter(r,nums){return nums.flatMap(n=>{const ss=quran[n-1];if(!ss)return[];if(r.mode==='surah')return[{url:audioUrl(r,n,ss.verses?.[0]?.a||1),filename:`Rafiq-${String(n).padStart(3,'0')}-${ss.name}.mp3`}];return (ss.verses||[]).map(v=>({url:audioUrl(r,n,v.a),filename:`Rafiq-${String(n).padStart(3,'0')}-${String(v.a).padStart(3,'0')}.mp3`}))});}
function openRecitationDownloadModal(scope='surah'){
  const modal=$('#recitationDownloadModal'),sub=$('#recitationDownloadSub'),summary=$('#downloadSummary'),juzField=$('#downloadJuzField'),juzSelect=$('#downloadJuzSelect');if(!modal||!sub||!summary)return;
  const r=recitationControl.reciter||reciters[0];const s=quran[(recitationControl.surah||currentSurah)-1];
  sub.textContent=`${r.name} · ${r.quality} · ${s?.name||'—'}${r.mode==='verse'?` · الآية ${recitationControl.ayah||1}`:' · تسجيل سُوَري'}`;
  if(juzSelect&&!juzSelect.options.length)juzSelect.innerHTML=Array.from({length:30},(_,i)=>`<option value="${i+1}">الجزء ${i+1}</option>`).join('');
  juzField.hidden=scope!=='juz';
  const labels={ayah:r.mode==='surah'?`السورة الحالية (تسجيل سُوَري فقط)`: 'الآية الحالية',surah:`سورة ${s?.name||''}`,juz:'الجزء المحدد',quran:'القرآن كاملًا',...Object.fromEntries(Object.entries(RECITATION_GROUPS).map(([k,v])=>[k,v.title]))};
  summary.textContent=`المطلوب: ${labels[scope]||scope} · القارئ: ${r.name}.`;
  modal.dataset.scope=scope;modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closeRecitationDownloadModal(){const m=$('#recitationDownloadModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');}
async function startRecitationDownload(){
  const modal=$('#recitationDownloadModal');if(!modal)return;let scope=modal.dataset.scope||'surah';let items=scope==='juz'?await getJuzItems(Number($('#downloadJuzSelect')?.value||1)):buildRecitationItems(scope);if(!items.length){toast('لا توجد ملفات جاهزة لهذا الاختيار');return;}
  if(items.length>100 && !confirm(`سيبدأ تنزيل ${items.length} ملفًا. قد يطلب المتصفح السماح بالتنزيلات المتعددة. هل تريد المتابعة؟`))return;
  const progress=$('#recitationDownloadProgress'),bar=$('#recitationDownloadProgressBar'),current=$('#recitationDownloadCurrent'),title=$('#recitationDownloadProgressTitle');if(progress){progress.hidden=false;bar.style.width='0%';title.textContent='جاري توفير الملفات داخل التطبيق…';}
  let cancelled=false;const cancelBtn=$('#cancelRecitationDownload');if(cancelBtn)cancelBtn.onclick=()=>{cancelled=true;title.textContent='تم الإيقاف';};
  const downloadOne=async(item)=>{
    const cached=await window.RAFIQ_CONTENT?.saveAudio(item.url);
    if(cached){return {cached:true};}
    try{
      const res=await fetch(item.url,{mode:'cors',cache:'no-store'});
      if(!res.ok)throw new Error('fetch');
      const blob=await res.blob();
      const u=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=u;a.download=item.filename;a.click();
      setTimeout(()=>URL.revokeObjectURL(u),1200);
      return {cached:false};
    }catch{
      const a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.click();
      return {cached:false,failed:true};
    }
  };
  let savedCount=0,failedCount=0;
  for(let i=0;i<items.length;i++){if(cancelled)break;if(current)current.textContent=`${i+1} / ${items.length} · ${items[i].filename}`;if(bar)bar.style.width=`${(((i+1)/items.length)*100).toFixed(1)}%`;const result=await downloadOne(items[i]);if(result?.cached)savedCount++;if(result?.failed)failedCount++;await new Promise(r=>setTimeout(r,scope==='quran'?90:60));}
  if(!cancelled){title.textContent=`اكتمل التوفير للأوفلاين ✅`;toast(failedCount?`تم توفير ${savedCount} ملفًا داخل التطبيق أوفلاين، وتعذر توفير ${failedCount}.`:`تم توفير ${savedCount||items.length} ملفًا داخل التطبيق للعمل دون اتصال ✅`);}
}
$('#recitationReciterSelect')?.addEventListener('change',e=>{const r=reciters.find(x=>x.folder===e.target.value)||reciters[0];selectReciter(r);syncRecitationControl();renderRecitations();});
$('#recitationSurahSelect')?.addEventListener('change',e=>{recitationControl.surah=Number(e.target.value)||1;recitationControl.ayah=1;syncRecitationControl();});
$('#recitationAyahSelect')?.addEventListener('change',e=>{recitationControl.ayah=Number(e.target.value)||1;syncRecitationControl();});
$('#playSelectedRecitation')?.addEventListener('click',()=>{const r=recitationControl.reciter,s=recitationControl.surah,a=Math.max(1,recitationControl.ayah);playRecitation(r,s,r.mode==='verse'?a-1:0);});
$('#stopSelectedRecitation')?.addEventListener('click',()=>{stopRecitation(true);syncRecitationControl();toast('تم إيقاف التلاوة ⏹️');});
$('#downloadSelectedRecitation')?.addEventListener('click',()=>openRecitationDownloadModal(recitationControl.reciter?.mode==='surah'?'surah':'ayah'));
$('#openReciterChooserInline')?.addEventListener('click',()=>openReciterChooser(recitationControl.surah,recitationControl.ayah));
$('#recitationDownloadClose')?.addEventListener('click',closeRecitationDownloadModal);$('#recitationDownloadModal')?.addEventListener('click',e=>{if(e.target===$('#recitationDownloadModal'))closeRecitationDownloadModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRecitationDownloadModal()});
$('#startRecitationDownload')?.addEventListener('click',startRecitationDownload);
$$('#recitationDownloadScopes [data-scope]').forEach(b=>b.onclick=()=>openRecitationDownloadModal(b.dataset.scope));

$('#quranReciterBtn')?.addEventListener('click',()=>openReciterChooser(currentSurah,state.last?.a||1));
$('#playerToggle')?.addEventListener('click',()=>{if(!audioState.active)return;if(qAudio.paused)qAudio.play().then(updatePlayer).catch(()=>{});else qAudio.pause();state.audio={reciter:audioState.reciter.folder,surah:audioState.surah,verseIndex:audioState.verseIndex,time:qAudio.currentTime,active:!qAudio.paused};save();updatePlayer();window.isAudioPlaying=!qAudio.paused;});
$('#playerNext')?.addEventListener('click',()=>{if(!audioState.active)return;const s=quran[audioState.surah-1];if(audioState.reciter.mode==='surah'){if(audioState.surah<quran.length)playRecitation(audioState.reciter,audioState.surah+1,0);return;}if(audioState.verseIndex<s.verses.length-1){audioState.verseIndex++;setPlayerAudio(audioUrl(audioState.reciter,audioState.surah,s.verses[audioState.verseIndex].a)).then(()=>qAudio.play()).then(updatePlayer).catch(()=>{});}else if(audioState.surah<quran.length){playRecitation(audioState.reciter,audioState.surah+1,0)}});
$('#playerPrev')?.addEventListener('click',()=>{if(!audioState.active)return;if(audioState.reciter.mode==='surah'){if(audioState.surah>1)playRecitation(audioState.reciter,audioState.surah-1,0);return;}const s=quran[audioState.surah-1];if(audioState.verseIndex>0){audioState.verseIndex--;setPlayerAudio(audioUrl(audioState.reciter,audioState.surah,s.verses[audioState.verseIndex].a)).then(()=>qAudio.play()).then(updatePlayer).catch(()=>{});}});
$('#closePlayerBtn')?.addEventListener('click',()=>stopRecitation(true));

function renderAthar(i){
  const pool=buildDynamicAthars();
  const idx=((i%pool.length)+pool.length)%pool.length;
  const q=pool[idx];
  $('#atharText').textContent=q.text;
  $('#atharRef').textContent=q.ref;
  $('#atharType').textContent=q.type;
  $('#atharCount').textContent=(idx===0&&daily)?'أثر اليوم · متجدد عند المغرب':`أثر متجدد · ${idx+1}/${pool.length}`;
  $('#atharNote').value=state.athar.note||'';
  $('#atharAction').value=state.athar.action||'';
  const done=state.athar.doneKey===`${idx}:${q.text}`;
  const btn=$('#markAthar');btn.textContent=done?'✓ تم التطبيق':'تم تطبيقه';btn.classList.toggle('primary',done);$('#atharCard').classList.toggle('done',done);
}
function renderAtharMemory(){const list=$('#atharMemoryList');if(!list)return;const safe=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};const h=Array.isArray(state.atharHistory)?state.atharHistory:[];if(!h.length){list.innerHTML='<div class="athar-memory-empty">لسه مفيش أثر محفوظ. اكتب فكرتك واضغط «حفظ الفكرة» وهتلاقيها هنا.</div>';return}list.innerHTML=h.slice(0,12).map(item=>`<article class="athar-memory-item"><div class="athar-memory-icon">${item.type==='حديث قدسي'?'🌙':item.type==='حديث نبوي'?'🌿':'✨'}</div><div><strong>${safe(item.text||'')}</strong><p>${safe(item.note||'بدون ملاحظة')}</p>${item.action?`<p>🧭 ${safe(item.action)}</p>`:''}</div><span class="athar-memory-meta">${new Date(item.time).toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}</span></article>`).join('')}
$('#clearAtharHistory')?.addEventListener('click',()=>{state.atharHistory=[];save();renderAtharMemory();toast('تم مسح سجل الأثر ✅')});
let atharIndex=(ritualKey().split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),17))%Math.max(1,buildDynamicAthars().length);
$('#newAthar').onclick=()=>{const pool=buildDynamicAthars();atharIndex=(atharIndex+1)%pool.length;state.atharNonce=(state.atharNonce||0)+1;save();renderAthar(atharIndex);toast('أثر جديد ✨')};
$('#saveAthar').onclick=()=>{const q=buildDynamicAthars()[atharIndex%buildDynamicAthars().length];const note=$('#atharNote').value.trim(),action=$('#atharAction').value.trim();if(!note&&!action)return toast('اكتب فكرة أو خطوة واحدة أولًا');state.athar=state.athar||{};state.athar.note=note;state.athar.action=action;state.atharHistory=Array.isArray(state.atharHistory)?state.atharHistory:[];state.atharHistory.unshift({type:q.type,text:q.text,ref:q.ref,note,action,time:Date.now()});state.atharHistory=state.atharHistory.slice(0,50);touchActivity('athar',1);save();renderAtharMemory();toast('اتحفظ الأثر في رحلتك ✅')};
$('#markAthar').onclick=()=>{const q=buildDynamicAthars()[atharIndex%buildDynamicAthars().length];state.athar.action=$('#atharAction').value.trim();state.athar.doneKey=`${atharIndex}:${q.text}`;touchActivity('athar',1);save();renderAthar(atharIndex);renderAtharMemory?.();updateHome();toast('اتسجل التطبيق ✅')};
$('#copyAthar').onclick=async()=>{const q=buildDynamicAthars()[atharIndex%buildDynamicAthars().length];const text=`${q.type}: ${q.text}\n${q.ref}`;try{await navigator.clipboard.writeText(text);toast('تم النسخ ✅')}catch{toast('تعذر النسخ في هذا المتصفح')}};
$('#shareAthar').onclick=async()=>{const q=buildDynamicAthars()[atharIndex%buildDynamicAthars().length];const text=`${q.type}: ${q.text}\n${q.ref}`;if(navigator.share){try{await navigator.share({title:'الأثر · رفيق القرآن',text})}catch{}}else{try{await navigator.clipboard.writeText(text);toast('تم نسخ الأثر للمشاركة ✅')}catch{toast('المشاركة غير متاحة هنا')}}};

function applyStyle(style){
  const map={
    calm:{glow:.66,lantern:.64,ocean:.80,blur:12,sat:.90,contrast:.98,wind:.42},
    balanced:{glow:1,lantern:.92,ocean:1.05,blur:16,sat:1,contrast:1,wind:.72},
    vivid:{glow:1.32,lantern:1.08,ocean:1.28,blur:18,sat:1.12,contrast:1.05,wind:1.0},
    cinematic:{glow:1.58,lantern:1.18,ocean:1.38,blur:20,sat:1.08,contrast:1.08,wind:.86}
  };
  const v=map[style]||map.balanced;const root=document.documentElement;
  root.style.setProperty('--style-glow',v.glow);root.style.setProperty('--style-lantern',v.lantern);root.style.setProperty('--style-ocean',v.ocean);root.style.setProperty('--style-blur',v.blur+'px');root.style.setProperty('--style-sat',v.sat);root.style.setProperty('--style-contrast',v.contrast);root.style.setProperty('--style-wind',v.wind);document.body.dataset.style=style||'balanced';document.body.dataset.light=document.body.classList.contains('light')?'on':'off';document.body.dataset.visualLevel=style||'balanced';document.dispatchEvent(new CustomEvent('rafiq-style-change'));
  $$('.style-card').forEach(b=>b.classList.toggle('selected',b.dataset.styleChoice===(style||'balanced')));
}

function detectPerformanceTier(){
  const cores=navigator.hardwareConcurrency||4; const mem=navigator.deviceMemory||4;
  if(mem<=2||cores<=2) return 'lite';
  if(mem<=4||cores<=4) return 'balanced';
  return 'high';
}

function applySurface(surface){
  const v=['open','balanced','glass'].includes(surface)?surface:'balanced';
  document.body.dataset.surface=v;
  $$('.surface-option').forEach(b=>b.classList.toggle('active',b.dataset.surfaceChoice===v));
}


function hydrateSettings(){
  const p=state.prefs||{};
  state.prefs={motion:p.motion!==false,ocean:p.ocean!==false,style:p.style||'balanced',surface:p.surface||'balanced',performance:p.performance||detectPerformanceTier(),fontSize:p.fontSize||'normal',contrast:p.contrast===true,maghribMode:p.maghribMode==='location'?'location':'fixed',maghribFixedMinutes:Number.isFinite(Number(p.maghribFixedMinutes))?Number(p.maghribFixedMinutes):18*60+30};
  const motionToggle=$('#motionToggle'), oceanToggle=$('#oceanToggle'), contrastToggle=$('#contrastToggle');
  if(motionToggle)motionToggle.checked=state.prefs.motion;
  if(oceanToggle)oceanToggle.checked=state.prefs.ocean;
  if(contrastToggle)contrastToggle.checked=state.prefs.contrast;
  document.body.classList.toggle('a11y-contrast',state.prefs.contrast);
  document.body.dataset.fontSize=state.prefs.fontSize;
  document.body.dataset.perfTier=state.prefs.performance==='auto'?detectPerformanceTier():state.prefs.performance;
  document.documentElement.classList.toggle('no-motion',!state.prefs.motion);
  document.body.dataset.motion=state.prefs.motion?'on':'off';
  document.dispatchEvent(new CustomEvent('rafiq-motion',{detail:state.prefs.motion}));
  const oceanCanvas=$('#oceanCanvas'); if(oceanCanvas)oceanCanvas.style.display=state.prefs.ocean?'block':'none';
  $$('.lantern,.celestial-jewels,.emeralds,.sky-ornament,.wind-streams,.light-wind-dust').forEach(x=>x.style.display=state.prefs.ocean?'':'none');
  applyStyle(state.prefs.style);
  applySurface(state.prefs.surface);
  $$('.surface-option').forEach(b=>b.classList.toggle('active',b.dataset.surfaceChoice===state.prefs.surface));
  $$('.a11y-btn').forEach(b=>b.classList.toggle('active',b.dataset.fontSize===state.prefs.fontSize));
  $$('.perf-btn').forEach(b=>b.classList.toggle('active',b.dataset.performance===state.prefs.performance));
  updateMaghribControls();
}
$('#motionToggle')?.addEventListener('change',e=>{state.prefs.motion=e.target.checked;save();hydrateSettings();toast(e.target.checked?'الحركة مفعلة':'تم إيقاف الحركة')});
$('#oceanToggle')?.addEventListener('change',e=>{state.prefs.ocean=e.target.checked;save();hydrateSettings();toast(e.target.checked?'العالم البحري مفعّل 🌊':'العالم البحري متوقف')});
const brandLamp=$('#brandLampToggle'); if(brandLamp&&brandLamp.dataset.bound!=='1'){brandLamp.dataset.bound='1';brandLamp.addEventListener('click',()=>{const on=brandLamp.getAttribute('aria-pressed')!=='true';brandLamp.setAttribute('aria-pressed',String(on));brandLamp.title=on?'المصباح متوهج':'زيادة توهج المصباح';toast(on?'زاد توهج المصباح ✨':'عاد توهج المصباح للوضع الطبيعي');});}
$('#contrastToggle')?.addEventListener('change',e=>{state.prefs.contrast=e.target.checked;save();hydrateSettings();toast(e.target.checked?'تم رفع التباين':'عاد التباين المتوازن')});
$$('.a11y-btn').forEach(b=>b.onclick=()=>{state.prefs.fontSize=b.dataset.fontSize;save();hydrateSettings();toast('تم ضبط حجم النص')});
$$('.perf-btn').forEach(b=>b.onclick=()=>{state.prefs.performance=b.dataset.performance;save();hydrateSettings();document.dispatchEvent(new CustomEvent('rafiq-performance-change'));toast('تم تغيير مستوى الأداء');});

$$('.style-card').forEach(b=>b.onclick=()=>{state.prefs.style=b.dataset.styleChoice;save();applyStyle(state.prefs.style);toast(`تم تطبيق نمط ${b.querySelector('b').textContent} ✨`)});
$$('.surface-option').forEach(b=>b.onclick=()=>{state.prefs.surface=b.dataset.surfaceChoice;save();applySurface(state.prefs.surface);toast(`تم تطبيق كثافة ${b.querySelector('b').textContent}`)});
$('#maghribMode')?.addEventListener('change',e=>{const mode=e.target.value==='location'?'location':'fixed';state.prefs.maghribMode=mode;if(mode==='fixed'){state.maghribLocationEnabled=false;state.maghribDate=null;}save();updateMaghribBoundary({request:false});toast(mode==='location'?'وضع المغرب الدقيق مفعّل؛ اضغط حساب المغرب من موقعي لإعطاء الإذن.':'تم الرجوع إلى وقت المغرب الثابت.');});
$('#maghribFixedTime')?.addEventListener('change',e=>{const mins=parseTimeMinutes(e.target.value);if(mins==null){e.target.value=formatMinutes(state.prefs.maghribFixedMinutes);toast('صيغة الوقت غير صحيحة.');return;}state.prefs.maghribFixedMinutes=mins;state.prefs.maghribMode='fixed';state.maghribDate=null;save();updateMaghribControls();checkRitualBoundary();toast(`تم ضبط بداية اليوم عند ${formatMinutes(mins)}`)});
$('#requestMaghribLocation')?.addEventListener('click',()=>{state.prefs.maghribMode='location';save();requestMaghribLocation();});
$('#exportData').onclick=()=>{try{const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&/^rafiq-/.test(k))keys.push(k)}const payload={format:'rafiq-backup',version:2,exportedAt:new Date().toISOString(),localStorage:Object.fromEntries(keys.map(k=>[k,readLocalJson(k)??localStorage.getItem(k)]))};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`rafiq-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('تم تصدير نسخة احتياطية كاملة ✅')}catch{toast('تعذر إنشاء النسخة الاحتياطية')}};
$('#importDataBtn').onclick=()=>$('#importData').click();
$('#importData').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;const obj=JSON.parse(await file.text());if(obj?.format!=='rafiq-backup'||!obj.localStorage)throw 0;if(!confirm('سيتم استبدال بيانات رفيق القرآن المحلية. هل تريد المتابعة؟'))return;const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&/^rafiq-/.test(k))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));for(const [k,v] of Object.entries(obj.localStorage)){if(/^rafiq-/.test(k))localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v))}toast('تم استيراد النسخة الاحتياطية ✅');setTimeout(()=>location.reload(),300)}catch{toast('ملف النسخة الاحتياطية غير صالح أو غير مدعوم')}finally{e.target.value=''}};
$('#clearData').onclick=()=>{if(confirm('مسح كل بيانات رفيق القرآن المحلية؟ يُفضّل تصدير نسخة احتياطية أولًا.')){const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&/^rafiq-/.test(k))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));location.reload()}};
$('#closeModal').onclick=()=>{const m=$('#modal');m?.classList.remove('open');m?.setAttribute('aria-hidden','true')};
$('#modal')?.addEventListener('click',e=>{if(e.target===$('#modal')){$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal')?.classList.contains('open')){$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true')}});
function prayerDemo(){const list=[['الفجر','—'],['الشروق','—'],['الظهر','—'],['العصر','—'],['المغرب','—'],['العشاء','—']];return list}
function updateNetwork(){const b=$('#netBadge');b.textContent=navigator.onLine?'● متصل':'● أوفلاين';b.classList.toggle('online',navigator.onLine)}

function ocean(){
  const c=$('#oceanCanvas'); if(!c)return;
  const ctx=c.getContext('2d',{alpha:false,desynchronized:true}); if(!ctx)return;
  const scene=document.createElement('canvas');
  const sceneCtx=scene.getContext('2d',{alpha:false,desynchronized:true});
  let w=0,h=0,last=0,raf=0,running=false,mx=.5,my=.5,cacheStyle='',scrolling=false,scrollTimer=0;
  const mobile=()=>matchMedia('(max-width:760px)').matches||matchMedia('(pointer:coarse)').matches;
  const tier=()=>{const p=(state.prefs||{}).performance||'auto';return p==='auto'?detectPerformanceTier():p};
  const counts=()=>{const p=tier(); if(mobile()) return p==='lite'?{s:22,g:3,gr:3,m:2,c:0,mv:4}:p==='high'?{s:38,g:5,gr:5,m:4,c:0,mv:7}:{s:30,g:4,gr:4,m:3,c:0,mv:6}; return p==='lite'?{s:70,g:9,gr:9,m:7,c:0,mv:8}:p==='high'?{s:112,g:13,gr:13,m:11,c:1,mv:18}:{s:92,g:11,gr:11,m:9,c:1,mv:13}};
  let stars=[],gold=[],green=[],motes=[],comets=[],movers=[];
  const seed=()=>{const q=counts();stars=Array.from({length:q.s},()=>({x:Math.random(),y:Math.random()*.74,r:.35+Math.random()*1.1,a:.10+Math.random()*.46,p:Math.random()*6.28,d:.3+Math.random()*.7}));gold=Array.from({length:q.g},()=>({x:Math.random(),y:.03+Math.random()*.58,r:.55+Math.random()*1.6,p:Math.random()*6.28,d:.5+Math.random()*.5}));green=Array.from({length:q.gr},()=>({x:Math.random(),y:.04+Math.random()*.68,r:.45+Math.random()*1.45,p:Math.random()*6.28,d:.45+Math.random()*.7}));motes=Array.from({length:q.m},()=>({x:Math.random(),y:.12+Math.random()*.72,r:.25+Math.random()*.8,p:Math.random()*6.28,v:.2+Math.random()*.8}));comets=Array.from({length:q.c},()=>({x:Math.random(),y:.12+Math.random()*.42,s:.35+Math.random()*.7,p:Math.random()*6.28,delay:Math.random()*6}));movers=Array.from({length:q.mv},()=>({x:Math.random(),y:.10+Math.random()*.62,r:.65+Math.random()*1.2,p:Math.random()*6.28,v:.08+Math.random()*.18,a:.32+Math.random()*.35,green:Math.random()<.42}));};
  function rebuildScene(force){const style=document.body.dataset.style||'balanced';if(!force&&style===cacheStyle)return;cacheStyle=style;const top=style==='cinematic'?'#02110c':style==='vivid'?'#03170f':'#02120d',mid=style==='cinematic'?'#073a2b':style==='vivid'?'#063c2b':'#062c20';sceneCtx.clearRect(0,0,w,h);const bg=sceneCtx.createLinearGradient(0,0,0,h);bg.addColorStop(0,top);bg.addColorStop(.5,mid);bg.addColorStop(1,'#020f0b');sceneCtx.fillStyle=bg;sceneCtx.fillRect(0,0,w,h);const g=(x,y,r,a,b)=>{const xg=sceneCtx.createRadialGradient(x,y,0,x,y,r);xg.addColorStop(0,a);xg.addColorStop(.45,b);xg.addColorStop(1,'rgba(0,0,0,0)');sceneCtx.fillStyle=xg;sceneCtx.fillRect(x-r,y-r,r*2,r*2)};g(w*.22,h*.34,w*.28,'rgba(50,210,157,.10)','rgba(25,122,90,.035)');g(w*.74,h*.18,w*.30,'rgba(246,222,140,.085)','rgba(70,207,158,.03)');const hg=sceneCtx.createLinearGradient(0,h*.7,0,h);hg.addColorStop(0,'rgba(5,48,36,.08)');hg.addColorStop(.55,'rgba(2,27,19,.24)');hg.addColorStop(1,'rgba(1,12,8,.78)');sceneCtx.fillStyle=hg;sceneCtx.fillRect(0,h*.66,w,h*.34)}
  function resize(){w=innerWidth;h=innerHeight;const d=mobile()?1:Math.min(devicePixelRatio||1,1.15);c.width=Math.floor(w*d);c.height=Math.floor(h*d);c.style.width=w+'px';c.style.height=h+'px';ctx.setTransform(d,0,0,d,0,0);scene.width=Math.floor(w*d);scene.height=Math.floor(h*d);sceneCtx.setTransform(d,0,0,d,0,0);seed();rebuildScene(true)}
  function draw(ts){const style=document.body.dataset.style||'balanced',parx=mobile()?0:(mx-.5)*10,pary=mobile()?0:(my-.5)*5;ctx.fillStyle='rgb(218,231,222)';for(const st of stars){const tw=.68+.32*Math.sin(ts*(.38+st.d*.34)+st.p);ctx.globalAlpha=Math.min(.66,st.a*tw*(style==='calm'?.72:1));const x=st.x*w+parx*(.08+st.d*.18),y=st.y*h+pary*(.06+st.d*.12),r=st.r*(.85+tw*.18);ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.fill()}ctx.fillStyle='rgb(255,233,158)';for(const st of gold){const tw=.55+.45*(.5+.5*Math.sin(ts*(.55+st.d*.45)+st.p));ctx.globalAlpha=.24+.32*tw;const x=st.x*w+parx*.2,y=st.y*h+pary*.12,r=st.r*(.78+tw*.32);ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.fill()}ctx.fillStyle='rgb(108,228,180)';for(const st of green){const tw=.50+.50*(.5+.5*Math.sin(ts*(.48+st.d*.38)+st.p));ctx.globalAlpha=.18+.26*tw;const x=st.x*w+parx*.18,y=st.y*h+pary*.10,r=st.r*(.78+tw*.26);ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.fill()}for(const m of movers){const xx=(m.x+Math.sin(ts*m.v+m.p)*.10)%1;const yy=m.y+Math.cos(ts*m.v*.72+m.p)*.045;const tw=.55+.45*Math.sin(ts*.9+m.p);ctx.globalAlpha=m.a*(.55+.45*tw);ctx.fillStyle=m.green?'rgb(88,225,174)':'rgb(255,232,156)';const x=xx*w+parx*.24,y=yy*h+pary*.12,r=m.r*(.75+.28*tw);ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.fill();if(tw>.82){ctx.globalAlpha*=.55;ctx.beginPath();ctx.moveTo(x-r*4,y);ctx.lineTo(x+r*4,y);ctx.strokeStyle=m.green?'rgba(88,225,174,.45)':'rgba(255,232,156,.50)';ctx.stroke()}}ctx.globalAlpha=1;ctx.fillStyle='rgb(64,216,166)';ctx.globalAlpha=.05;for(const m of motes){const x=(m.x+Math.sin(ts*.03*m.v+m.p)*.008)*w+parx*.1,y=(m.y+Math.sin(ts*.05*m.v+m.p)*.012)*h+pary*.06;ctx.beginPath();ctx.arc(x,y,m.r,0,6.283);ctx.fill()}if(!mobile())for(const q of comets){const ph=(ts*.012*q.s+q.delay)%1;if(ph<.18||ph>.94)continue;const x=((q.x+ph*.9)%1)*w,y=(q.y+Math.sin(ph*6.28+q.p)*.04)*h;ctx.globalAlpha=.12;ctx.strokeStyle='rgb(247,224,142)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-22,y+4);ctx.stroke();ctx.globalAlpha=.48;ctx.fillStyle='rgb(255,238,165)';ctx.beginPath();ctx.arc(x,y,1,0,6.283);ctx.fill()}ctx.globalAlpha=1}
  function loop(ts){if(!running||document.hidden||scrolling)return;raf=requestAnimationFrame(loop);const v=document.body.dataset.view||'home',p=tier(),ms=mobile()?({lite:120,balanced:105,high:90}[p]||105):(p==='lite'?(v==='home'?95:150):p==='high'?(v==='home'?58:105):(v==='home'?72:125));if(ts-last<ms)return;last=ts;ctx.clearRect(0,0,w,h);ctx.drawImage(scene,0,0,w,h);draw(ts*.001)}
  const stop=()=>{running=false;if(raf)cancelAnimationFrame(raf);raf=0}; const start=()=>{if(running||document.hidden||document.body.dataset.motion==='off'||scrolling)return;running=true;raf=requestAnimationFrame(loop)};
  addEventListener('resize',resize,{passive:true});addEventListener('scroll',()=>{if(!mobile())return;scrolling=true;stop();clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;start()},180)},{passive:true});document.addEventListener('visibilitychange',()=>document.hidden?stop():start());document.addEventListener('rafiq-motion',e=>e.detail?start():stop());document.addEventListener('rafiq-style-change',()=>rebuildScene(true));document.addEventListener('rafiq-performance-change',resize);if(!mobile())document.addEventListener('mousemove',e=>{mx=e.clientX/innerWidth;my=e.clientY/innerHeight},{passive:true});resize();start();
}

// V23 interaction layer
function setTimeMood(){const h=new Date().getHours();const mood=h>=5&&h<9?'dawn':h>=17&&h<21?'dusk':'night';document.body.dataset.time=mood}
setTimeMood();setInterval(setTimeMood,300000);

const charityDone=$('#charityDone'); const charityShare=$('#charityShare');
charityDone?.addEventListener('click',()=>{state.charity=state.charity||{};state.charity.last=Date.now();state.sessions=(state.sessions||0)+1;touchActivity('athar',1);touchActivity('sessions',1);charityDone.textContent='✓ تم تسجيل دعاء اليوم';toast('ربنا يفرّج عنه ويحفظ والديك 🤍')});
charityShare?.addEventListener('click',async()=>{const txt='اللهم فك كرب أخي، وفرّج همّه، وأزل عنه الغم والهم والحزن، واشرح صدره، ويسّر أمره، واحفظ والديّ، وأدم عليهم العافية والسكينة والبركة.';if(navigator.share){try{await navigator.share({title:'دعاء لأخي ولوالديّ',text:txt})}catch{}}else{try{await navigator.clipboard.writeText(txt);toast('تم نسخ الدعاء 🤍')}catch{toast('تعذر النسخ هنا')}}});


let hifz=Array.isArray(state.hifz)?state.hifz:[]; state.hifz=hifz;
function renderHifz(){
  const sky=$('#hifzSky');
  if(!sky)return;

  // Offline-first constellation: 114 positions arranged as a deliberate six-petal celestial rosette.
  // No network data is required to draw or animate the galaxy.
  const rings=[6,12,18,24,30,24];
  const radii=[8.5,14.5,21.5,29.5,37.5,46.5];
  const positions=[];
  rings.forEach((count,ring)=>{
    for(let j=0;j<count;j++){
      const theta=(j/count)*Math.PI*2 + ring*0.045;
      const petal=1 + 0.12*Math.cos(theta*6);
      const r=radii[ring]*petal;
      positions.push({
        x:50+Math.cos(theta)*r,
        y:50+Math.sin(theta)*r*.70,
        spin:(theta*180/Math.PI + ring*11 + j*2)%360,
        scale:(0.78 + ((j+ring*3)%8)*0.045).toFixed(2)
      });
    }
  });

  sky.innerHTML=Array.from({length:114},(_,surahIndex)=>{
    const pos=positions[surahIndex];
    const active=hifz.includes(surahIndex+1);
    const delay=((surahIndex%37)*-.16).toFixed(2);
    const duration=(6.8 + (surahIndex%6)*.55).toFixed(2);
    return `<span class="hifz-star ${active?'active':''}" role="img" aria-label="نجمة سورة ${surahIndex+1}" style="left:${Math.max(5,Math.min(95,pos.x))}%;top:${Math.max(8,Math.min(92,pos.y))}%;--delay:${delay}s;--spin:${pos.spin.toFixed(1)}deg;--scale:${pos.scale};--duration:${duration}s"><span aria-hidden="true"></span></span>`;
  }).join('');

  const pct=Math.round((hifz.length/114)*100);
  $('#hifzProgress').textContent=`${hifz.length} / 114 محفوظة`;
  $('#galaxyMeter').textContent=`${pct}%`;
}

// ambient cursor light: subtle premium parallax, no heavy DOM work.
addEventListener('pointermove',e=>{
  const px=(e.clientX/innerWidth)*100, py=(e.clientY/innerHeight)*100;
  document.documentElement.style.setProperty('--cursor-x',px.toFixed(2)+'%');
  document.documentElement.style.setProperty('--cursor-y',py.toFixed(2)+'%');
},{passive:true});

function ensureScheduleState(){
  if(!Array.isArray(state.schedule))state.schedule=[['جلسة الحفظ','صباحًا'],['مراجعة','مساءً']];
  if(!Array.isArray(state.reminders))state.reminders=[];
}
function renderSchedule(){
  ensureScheduleState();
  const list=$('#scheduleList'),rem=$('#reminderList'); if(!list||!rem)return;
  list.innerHTML=state.schedule.map((x,i)=>`<div class="schedule-item"><div><b>${escText(x[0])}</b><small>${escText(x[1]||'وقت مرن')}</small></div><button class="delete-schedule" type="button" data-del-s="${i}">حذف</button></div>`).join('')||'<div class="muted">لا توجد محطات بعد.</div>';
  rem.innerHTML=state.reminders.map((x,i)=>`<div class="schedule-item"><div><b>${escText(x.title)}</b><small>${escText(x.time||'وقت مرن')}</small></div><button class="delete-schedule" type="button" data-del-r="${i}">حذف</button></div>`).join('')||'<div class="muted">لا توجد تذكيرات بعد.</div>';
  $$('[data-del-s]').forEach(b=>b.onclick=()=>{const i=+b.dataset.delS;if(!Number.isInteger(i))return;state.schedule.splice(i,1);save();renderSchedule();toast('تم حذف المحطة')});
  $$('[data-del-r]').forEach(b=>b.onclick=()=>{const i=+b.dataset.delR;if(!Number.isInteger(i))return;state.reminders.splice(i,1);save();renderSchedule();toast('تم حذف التذكير')});
}
function escText(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fireReminderNotification(title){
  try{
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const n=new Notification('رفيق القرآن ⏰',{body:title,icon:'./icon-192.png',tag:'rafiq-reminder-'+title});
    n.onclick=()=>{try{window.focus()}catch{}n.close()};
  }catch{}
}
function checkReminders(){
  if(!Array.isArray(state.reminders)||!state.reminders.length)return;
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const now=new Date(),hhmm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),todayKey=now.toDateString();
  state.firedReminders=state.firedReminders||{};
  let changed=false;
  state.reminders.forEach((r,i)=>{
    if(!r||!/^\d{1,2}:\d{2}$/.test(r.time||''))return;
    const rKey=i+'-'+r.time+'-'+r.title;
    if(r.time===hhmm && state.firedReminders[rKey]!==todayKey){
      fireReminderNotification(r.title);
      state.firedReminders[rKey]=todayKey;
      changed=true;
    }
  });
  if(changed)save();
}
$('#addSchedule')?.addEventListener('click',()=>{ensureScheduleState();const title=($('#scheduleTitle')?.value||'').trim(),time=($('#scheduleTime')?.value||'').trim()||'مرن';if(!title)return toast('اكتب اسم المحطة أولًا');state.schedule.push([title,time]);save();if($('#scheduleTitle'))$('#scheduleTitle').value='';if($('#scheduleTime'))$('#scheduleTime').value='';renderSchedule();toast('تمت إضافة المحطة ✅')});
$('#addReminder')?.addEventListener('click',()=>{ensureScheduleState();const title=($('#reminderTitle')?.value||'').trim(),time=($('#reminderTime')?.value||'').trim()||'وقت مرن';if(!title)return toast('اكتب عنوان التذكير أولًا');state.reminders.push({title,time});save();if($('#reminderTitle'))$('#reminderTitle').value='';if($('#reminderTime'))$('#reminderTime').value='';renderSchedule();toast('تمت إضافة التذكير ✅')});
$('#notifyPermission')?.addEventListener('click',async()=>{if(!('Notification' in window))return toast('الإشعارات غير مدعومة في هذا المتصفح');try{const p=await Notification.requestPermission();toast(p==='granted'?'تم تفعيل الإشعارات ✅':'لم يتم منح الإذن')}catch{toast('تعذر تفعيل الإشعارات')}});

// lightweight view hooks
const originalGo=go; go=function(view){originalGo(view); if(view==='galaxy')renderHifz(); if(view==='schedule')renderSchedule();};
renderHifz();renderSchedule();

// v58: daily in-page experience. No blocking welcome/splash overlays.
const DAILY_GREETING_POOL=[
  'اجعل هذه الليلة بداية هادئة جديدة مع كتاب الله.',
  'خطوة صغيرة مع القرآن اليوم، خير من انتظار الوقت المثالي.',
  'خذ آية واحدة بصدق، ودع أثرها يكمل معك اليوم.',
  'رفيقك ينتظرك: قراءة هادئة، سماع متقن، وقلب حاضر.',
  'اليوم صفحة جديدة في رحلتك؛ ابدأ بما تستطيع واستمر.',
  'لا تستعجل الكثرة؛ الثبات مع القرآن هو المكسب الحقيقي.',
  'دقائق قليلة بتركيز قد تصنع فرقًا كبيرًا في تثبيت محفوظك.'
];
function dailyGreetingText(){
  const name=String(state.name||'').trim();
  const who=name?` يا ${name}`:'';
  const msg=DAILY_GREETING_POOL[dailyStableIndex(DAILY_GREETING_POOL.length)]||DAILY_GREETING_POOL[0];
  return `${msg}${who?' — '+who:''}`;
}
function ensureDailyDua(daily,key){
  const fallback=DAILY_DUA[dailyStableIndex(DAILY_DUA.length)]||DAILY_DUA[0]||{text:'اللهم أعنّي على ذكرك وشكرك وحسن عبادتك',ref:'سنن أبي داود · 1526'};
  if(!daily.dua || !String(daily.dua.text||'').trim()) daily.dua=fallback;
  return daily;
}
function renderDailyHome(){
  const title=$('#dailyWelcomeTitle'), dateEl=$('#homeDailyDate'), greet=$('#homeDailyGreeting');
  if(title) title.textContent=state.name?`أهلًا يا ${String(state.name).trim()}`:'أهلًا بك في رفيق القرآن';
  if(dateEl) dateEl.textContent=ritualLabel();
  if(greet) greet.textContent=state.dailyContent?.key===ritualKey()&&state.dailyContent?.message ? `${state.dailyContent.message}${state.name?' — '+String(state.name).trim():''}` : dailyGreetingText();
  const key=ritualKey();
  let daily=state.dailyContent||null;
  if(!daily||daily.key!==key||!daily.verse||!daily.hadith){
    daily=dailyFallback(key);
  }
  daily=ensureDailyDua(daily,key);
  state.dailyContent=daily; save();
  const ay=$('#homeDailyAyah'), ref=$('#homeDailyAyahRef'); if(ay)ay.textContent=daily.verse.text; if(ref)ref.textContent=daily.verse.ref;
  const hadith=$('#homeDailyHadith'), href=$('#homeDailyHadithRef'); if(hadith)hadith.textContent=daily.hadith.text; if(href)href.textContent=daily.hadith.ref;
  const qudsi=$('#homeDailyQudsi'),qref=$('#homeDailyQudsiRef');if(qudsi)qudsi.textContent=`«${daily.qudsi.text}»`;if(qref)qref.textContent=daily.qudsi.ref;
  const dua=$('#homeDailyDua'),dref=$('#homeDailyDuaRef'); if(dua)dua.textContent=daily.dua.text; if(dref)dref.textContent=daily.dua.ref;
  if(navigator.onLine&&daily.source!=='online'){ refreshDailyOnline(false).then(()=>{ if(state.dailyContent?.key===key&&state.dailyContent?.source==='online') renderDailyHome(); }).catch(()=>{}); }
}
function normalizeProfileName(value){return String(value??'').replace(/\s+/g,' ').trim().slice(0,40);}
function saveProfile(name,age){const clean=normalizeProfileName(name);if(!clean)return false;state.name=clean;state.age=age||null;save();return true;}
function hijriParts(date){
  try{return new Intl.DateTimeFormat('en-u-ca-islamic',{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).reduce((o,p)=>(o[p.type]=p.value,o),{});}catch{return {year:String(date.getFullYear()),month:String(date.getMonth()+1).padStart(2,'0'),day:String(date.getDate()).padStart(2,'0')}}
}
function hijriLabel(date){
  try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);}catch{return new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date)}
}
function dayOfYearLocal(date){const start=new Date(date.getFullYear(),0,0);return Math.floor((date-start)/86400000)}
function sunsetMinutes(date,lat,lon){
  const N=dayOfYearLocal(date),lngHour=lon/15,t=N+((18-lngHour)/24),M=(0.9856*t)-3.289; let L=M+1.916*Math.sin(M*Math.PI/180)+0.020*Math.sin(2*M*Math.PI/180)+282.634; L=(L+360)%360; let RA=Math.atan(0.91764*Math.tan(L*Math.PI/180))*180/Math.PI; RA=(RA+360)%360; const Lquadrant=Math.floor(L/90)*90,RAquadrant=Math.floor(RA/90)*90; RA=RA+(Lquadrant-RAquadrant); RA/=15; const sinDec=0.39782*Math.sin(L*Math.PI/180),cosDec=Math.cos(Math.asin(sinDec)),zenith=90.8333,latR=lat*Math.PI/180,cosH=(Math.cos(zenith*Math.PI/180)-sinDec*Math.sin(latR))/(cosDec*Math.cos(latR)); if(cosH>1||cosH<-1)return 18*60; const H=(360-Math.acos(cosH)*180/Math.PI)/15,T=H+RA-(0.06571*t)-6.622,UT=(T-lngHour+24)%24,localOffset=-date.getTimezoneOffset()/60; return Math.round(((UT+localOffset+24)%24)*60);
}
function formatMinutes(mins){const m=((Number(mins)||0)%1440+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function parseTimeMinutes(value){const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));if(!m)return null;const h=Number(m[1]),min=Number(m[2]);if(h>23||min>59)return null;return h*60+min}
function boundaryMinutes(){
  const p=state.prefs||{};
  if(p.maghribMode==='location' && Number.isFinite(Number(state.maghribMinutes))) return Number(state.maghribMinutes);
  return Number.isFinite(Number(p.maghribFixedMinutes))?Number(p.maghribFixedMinutes):18*60+30;
}
function updateMaghribControls(){
  const mode=state.prefs?.maghribMode==='location'?'location':'fixed';
  const modeSelect=$('#maghribMode'); if(modeSelect)modeSelect.value=mode;
  const fixedInput=$('#maghribFixedTime'); if(fixedInput)fixedInput.value=formatMinutes(state.prefs?.maghribFixedMinutes ?? 18*60+30);
  const locationBtn=$('#requestMaghribLocation');
  const status=$('#maghribStatus');
  if(locationBtn) locationBtn.disabled=mode!=='location';
  if(status){
    if(mode==='location'){
      status.textContent=Number.isFinite(Number(state.maghribMinutes))?`دقيق حسب موقعك · آخر حساب ${formatMinutes(state.maghribMinutes)}`:'سيُحسب وقت المغرب بعد تفعيل الموقع.';
      status.dataset.state=Number.isFinite(Number(state.maghribMinutes))?'ready':'pending';
    }else{
      status.textContent=`وقت ثابت داخل الجهاز · ${formatMinutes(state.prefs?.maghribFixedMinutes ?? 18*60+30)}`;
      status.dataset.state='fixed';
    }
  }
}
function requestMaghribLocation(){
  if(!('geolocation' in navigator))return toast('هذا المتصفح لا يوفّر تحديد الموقع؛ استخدم الوقت الثابت.');
  const btn=$('#requestMaghribLocation'); if(btn){btn.disabled=true;btn.textContent='جارٍ حساب المغرب…';}
  navigator.geolocation.getCurrentPosition(
    pos=>{
      try{
        const mins=sunsetMinutes(new Date(),pos.coords.latitude,pos.coords.longitude);
        if(!Number.isFinite(mins))throw new Error('sunset');
        state.maghribMinutes=mins;
        state.maghribDate=new Date().toDateString();
        state.maghribLocationEnabled=true;
        save();
        checkRitualBoundary();
        updateMaghribControls();
        toast(`تم ضبط المغرب بدقة · ${formatMinutes(mins)}`);
      }catch{toast('تعذر حساب المغرب من الموقع؛ استخدم الوقت الثابت.');}
      finally{if(btn){btn.disabled=false;btn.textContent='حساب المغرب من موقعي';}}
    },
    ()=>{state.maghribLocationEnabled=false;save();updateMaghribControls();if(btn){btn.disabled=false;btn.textContent='حساب المغرب من موقعي';}toast('لم يتم السماح بالموقع؛ لم نغيّر وقتك الثابت.');},
    {maximumAge:21600000,timeout:10000,enableHighAccuracy:false}
  );
}
function updateMaghribBoundary({request=false}={}){
  const p=state.prefs||{};
  if(p.maghribMode!=='location'){updateMaghribControls();return;}
  const todayKey=new Date().toDateString();
  if(state.maghribDate===todayKey && Number.isFinite(Number(state.maghribMinutes))){updateMaghribControls();return;}
  if(request || state.maghribLocationEnabled) requestMaghribLocation();
  else updateMaghribControls();
}
function ritualMoment(date=new Date()){const mins=date.getHours()*60+date.getMinutes(),sunset=boundaryMinutes();return mins>=sunset?new Date(date):new Date(date.getTime()-86400000)}
function ritualKey(){const d=ritualMoment();return `rafiq-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function ritualLabel(){return hijriLabel(ritualMoment())}
function dailyVerse(){
  if(!quran.length)return {text:'وَقُلْ رَبِّ زِدْنِي عِلْمًا',ref:'طه · آية 114',s:20,a:114};
  const seed=ritualKey().split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),11);
  const s=quran[seed%quran.length]||quran[0]; const v=s.verses[seed%(s.verses.length||1)]; return {text:v.text,ref:`${s.name} · آية ${v.a}`,s:s.number||quran.indexOf(s)+1,a:v.a};
}
function maybeOpenDailyWelcome(){if(!state.onboardingComplete)openOnboarding();}
function checkRitualBoundary(){const key=ritualKey();if(state.lastRitualKey!==key){state.lastRitualKey=key;state.atharDaily=null;state.atharIndex=0;save();refreshDailyOnline(true).then(()=>{if(state.dailyContent?.key===key&&state.dailyContent?.athar)state.atharDaily={...state.dailyContent.athar,key};renderDailyHome();renderAthar(0);maybeOpenDailyWelcome();}).catch(()=>{renderDailyHome();renderAthar(0);maybeOpenDailyWelcome();});}}
const tapGlow=$('#tapGlow');document.addEventListener('pointerdown',e=>{const el=e.target.closest('button,a,[data-go],[data-view],.style-card,.hifz-star');if(!el||el.matches('input,textarea,select'))return;if(tapGlow){tapGlow.style.left=e.clientX+'px';tapGlow.style.top=e.clientY+'px';tapGlow.classList.remove('show');void tapGlow.offsetWidth;tapGlow.classList.add('show');}});

const DAILY_HADITH=[
  {text:'من يرد الله به خيرًا يفقهه في الدين',ref:'صحيح البخاري · 71'},
  {text:'أحب الأعمال إلى الله أدومها وإن قل',ref:'صحيح البخاري · 6465'},
  {text:'إن الله لا ينظر إلى صوركم وأموالكم ولكن ينظر إلى قلوبكم وأعمالكم',ref:'صحيح مسلم · 2564'},
  {text:'يسروا ولا تعسروا، وبشروا ولا تنفروا',ref:'صحيح البخاري · 69'}
];
const DAILY_DUA=[
  {text:'اللهم أعنّي على ذكرك وشكرك وحسن عبادتك',ref:'سنن أبي داود · 1526'},
  {text:'اللهم إني أسألك علمًا نافعًا، ورزقًا طيبًا، وعملًا متقبلًا',ref:'سنن ابن ماجه · 925'},
  {text:'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',ref:'البقرة · 201'},
  {text:'رب اشرح لي صدري ويسر لي أمري',ref:'طه · 25–26'}
];
const DAILY_QUDSI={text:'يا عبادي إني حرمت الظلم على نفسي فلا تظالموا',ref:'صحيح مسلم · 2577'};
const DAILY_HADITH_API_EDITION='ara-bukhari';
const DAILY_HADITH_MAX=7563;
const DAILY_HADITH_TIMEOUT=12000;
function withDailyTimeoutFetch(url,opts={}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),DAILY_HADITH_TIMEOUT);return fetch(url,{...opts,signal:controller.signal,cache:'default'}).finally(()=>clearTimeout(timer));}
function dailyStableIndex(len){const key=ritualKey();const seed=key.split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),7);return seed%Math.max(1,len);}
function getDailyHadith(){return DAILY_HADITH[dailyStableIndex(DAILY_HADITH.length)]||DAILY_HADITH[0];}
function hadithNumberForDay(){return 1+dailyStableIndex(DAILY_HADITH_MAX);}
function normalizeHadithPayload(payload){
  if(!payload)return null;
  const candidates=[];
  if(Array.isArray(payload)) candidates.push(...payload);
  if(Array.isArray(payload.hadiths)) candidates.push(...payload.hadiths);
  if(Array.isArray(payload.data)) candidates.push(...payload.data);
  if(payload.data&&typeof payload.data==='object'&&!Array.isArray(payload.data)) candidates.push(payload.data);
  if(payload.hadith&&typeof payload.hadith==='object') candidates.push(payload.hadith);
  candidates.push(payload);
  for(const item of candidates){
    const text=String(item?.text??item?.hadithText??item?.arabic??item?.text_ar??'').trim();
    if(!text)continue;
    const number=item?.hadithnumber??item?.hadith_no??item?.number??item?.arabicnumber??'';
    const grade=Array.isArray(item?.grades)?item.grades.map(g=>g?.grade||g?.name||'').filter(Boolean).join('، '):String(item?.grade||'').trim();
    return {text,ref:`صحيح البخاري · ${number||hadithNumberForDay()}${grade?` · ${grade}`:''}`,source:'Fawaz Ahmed · hadith-api'};
  }
  return null;
}
async function fetchOnlineHadith(){
  if(!navigator.onLine)return null;
  const number=hadithNumberForDay();
  const urls=[
    `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${DAILY_HADITH_API_EDITION}/${number}.min.json`,
    `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${DAILY_HADITH_API_EDITION}/${number}.json`,
    `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${DAILY_HADITH_API_EDITION}/${number}.min.json`,
    `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${DAILY_HADITH_API_EDITION}/${number}.json`
  ];
  for(const url of urls){
    try{const r=await withDailyTimeoutFetch(url);if(!r.ok)continue;const item=normalizeHadithPayload(await r.json());if(item)return item;}catch{}
  }
  return null;
}
async function fetchOnlineDaily(key){
  if(!navigator.onLine)return null;
  const localVerse=dailyVerse();
  const out={key,source:'online',fetchedAt:Date.now(),verse:localVerse};
  try{
    const r=await withDailyTimeoutFetch('./daily-content.json');
    if(r.ok){const cfg=await r.json();const msgs=Array.isArray(cfg?.messages)?cfg.messages:[];if(msgs.length)out.message=String(msgs[dailyStableIndex(msgs.length)]?.text||msgs[dailyStableIndex(msgs.length)]||'').trim();}
  }catch{}
  const hadith=await fetchOnlineHadith();
  if(hadith)out.hadith=hadith;
  // لا نعتمد على API عشوائي للأذكار/الأدعية؛ نستخدم مخزونًا محليًا موثقًا عند غياب مصدر API موثوق.
  const dua=DAILY_DUA[dailyStableIndex(DAILY_DUA.length)]; if(dua)out.dua={...dua,source:'local-curated'};
  try{const pool=buildDynamicAthars();if(pool.length){const idx=dailyStableIndex(pool.length);out.athar={...pool[idx],source:'local-curated'}}}catch{}
  return (out.hadith||out.verse||out.dua||out.athar)?out:null;
}
function dailyFallback(key){
  const verse=dailyVerse(); const had=getDailyHadith(); const dua=DAILY_DUA[dailyStableIndex(DAILY_DUA.length)]||DAILY_DUA[0];
  return {key,source:'local-fallback',fetchedAt:Date.now(),verse,hadith:had,dua,qudsi:DAILY_QUDSI,message:DAILY_GREETING_POOL[dailyStableIndex(DAILY_GREETING_POOL.length)],reason:null};
}
async function refreshDailyOnline(force=false){
  const key=ritualKey(), cache=state.dailyContent;
  if(!force&&cache?.key===key&&cache?.source) return cache;
  const online=await fetchOnlineDaily(key);
  const result={...dailyFallback(key),...(online||{})};
  result.hadith=result.hadith||getDailyHadith();
  ensureDailyDua(result,key);
  result.qudsi=DAILY_QUDSI;
  if(result.athar)state.atharDaily={...result.athar,key};
  state.dailyContent=result;save();return result;
}
// Daily welcome content uses the same once-per-ritual online cache with a local fallback.
function renderWelcome(){}
function escWelcome(value){const d=document.createElement('div');d.textContent=String(value??'');return d.innerHTML;}
function focusWelcomeName(){const input=$('#welcomeName');if(input&&!state.name)setTimeout(()=>input.focus(),80);else setTimeout(()=>$('#closeWelcomeBtn')?.focus(),80);}
let welcomeOpenKey=null;
const METHOD_STEPS=[
 {n:'01',t:'الضبط والتجويد',p:'ابدأ بضبط النطق والتجويد والاستماع إلى الشيخ محمود خليل الحصري قبل أن تبدأ في الحفظ، حتى يكون اللفظ والتلاوة مضبوطين من البداية.'},
 {n:'02',t:'التثبيت والتربيط',p:'يمكنك الاستماع إلى مواد وفيديوهات مخصصة للتثبيت والتربيط، خاصة في المواضع المتشابهة أو الصعبة. أما عن تجربتي الشخصية، فكنت أستمع إلى أمل ثابت قبل بداية الحفظ؛ لما وجدته فيها من فائدة في التثبيت والتربيط وربط الآيات والمتشابهات.'},
 {n:'03',t:'الحفظ بالسماع والسلاسة والانطلاق والتقليد والترديد',p:'يمكنك تطبيق هذه الطريقة مع أي قارئ تكون تلاوته صحيحة وتفضّل صوته وتشعر أن الاستماع إليه يساعدك على الحفظ. أما عن تجربتي الشخصية، فكان القارئ الذي اعتمدت عليه هو فارس عباد. كنت أستمع إلى تلاوته، وأكرر معه، وأحفظ بالسماع والتقليد والترديد، وقد حفظت بالفعل عدة أجزاء بهذه الطريقة. ومع الاستمرار، ساعدني ذلك على تحسين السلاسة والانطلاق في التلاوة، كما سهّل عليّ تطبيق أحكام التجويد عمليًا أثناء القراءة.'},
 {n:'04',t:'بناء العضلة',p:'بعد إتقان الورد وحفظه، قم بالتسميع غيبًا 10 مرات على الأقل. والـ10 تكرارات هي الحد الأدنى، وليست سقفًا؛ فإذا استطعت الزيادة، فالأفضل أن تزيد بحسب قدرتك، حتى لو وصلت إلى 40 تكرارًا، لأن كثرة التكرار غيبًا تساعد على تقوية استحضار المحفوظ وتثبيته.'},
 {n:'05',t:'التثبيت القريب',p:'بعد الحفظ، اجعل للمحفوظ تثبيتًا يوميًا لمدة 7 أيام متتالية، بحيث تقوم بتسميعه غيبًا كل يوم.'},
 {n:'06',t:'المراجعة الذكية',p:'بعد الانتهاء من مرحلة التثبيت، انتقل إلى المراجعة الأسبوعية للمحفوظ القديم. بعبارة عملية: كل أسبوع تقوم بتسميع جميع ما حفظته سابقًا مرة واحدة، حتى يبقى المحفوظ القديم حاضرًا ولا يطغى الجديد على ما سبق حفظه.'}
];
const METHOD_NOTE='هذه المنهجية هي تجربتي الشخصية والطريقة التي اعتمدت عليها، وليست قاعدة ثابتة أو منهجًا ملزمًا للجميع. وضعتها للتسهيل، ويمكنك اعتمادها كاملة أو الاستفادة من بعض مراحلها بما يناسبك.';
function renderMethod(){const box=$('#methodList');if(!box)return;box.innerHTML=METHOD_STEPS.map(x=>`<article class="method-step"><div class="num">${x.n}</div><div><b>${escText(x.t)}</b><p>${escText(x.p)}</p></div></article>`).join('')+`<div class="method-note"><b>ملاحظة:</b> ${escText(METHOD_NOTE)}</div>`}
function openMethod(){renderMethod();const m=$('#methodModal');if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeMethod(){const m=$('#methodModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')}
$('#methodBtn')?.addEventListener('click',openMethod);document.addEventListener('click',e=>{if(e.target.closest?.('#methodModalClose'))closeMethod();if(e.target===$('#methodModal'))closeMethod()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#methodModal')?.classList.contains('open'))closeMethod()});

let deferredInstallPrompt=null;
function setInstallVisible(show){['#installAppBtn','#installBannerBtn','#settingsInstallBtn'].forEach(sel=>{const el=$(sel);if(el)el.hidden=!show})}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;setInstallVisible(true);const b=$('#installBanner');if(b)b.hidden=false});window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;setInstallVisible(false);const b=$('#installBanner');if(b)b.hidden=true;toast('تم تثبيت رفيق القرآن ✅')});async function promptInstall(){if(!deferredInstallPrompt)return toast('التثبيت غير متاح الآن من هذا المتصفح');deferredInstallPrompt.prompt();try{await deferredInstallPrompt.userChoice}catch{}deferredInstallPrompt=null;setInstallVisible(false);const b=$('#installBanner');if(b)b.hidden=true}['#installAppBtn','#installBannerBtn','#settingsInstallBtn'].forEach(sel=>$(sel)?.addEventListener('click',promptInstall));
function closePrivacy(){const m=$('#privacyModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')}$('#privacyBtn')?.addEventListener('click',()=>{const m=$('#privacyModal');m?.classList.add('open');m?.setAttribute('aria-hidden','false')});$('#privacyClose')?.addEventListener('click',closePrivacy);$('#privacyModal')?.addEventListener('click',e=>{if(e.target.matches('[data-close-privacy]'))closePrivacy()});
let onboardingStep=1;function setOnboardingStep(n){onboardingStep=Math.max(1,Math.min(3,n));document.querySelectorAll('[data-onboarding-step]').forEach(x=>{x.hidden=Number(x.dataset.onboardingStep)!==onboardingStep;x.classList.toggle('active',Number(x.dataset.onboardingStep)===onboardingStep)});document.querySelectorAll('[data-step-dot]').forEach(x=>x.classList.toggle('active',Number(x.dataset.stepDot)===onboardingStep));$('#onboardingBack').hidden=onboardingStep===1;$('#onboardingNext').textContent=onboardingStep===3?'ابدأ رفيقك الآن':'التالي'}
function applyOnboarding(){const folder=document.querySelector('input[name="onboardingReciter"]:checked')?.value||reciters[0]?.folder;const r=reciters.find(x=>x.folder===folder);if(r){state.prefs=state.prefs||{};state.prefs.reciter=r.folder;audioState.reciter=r}const key='rafiq-memorization-core-v5',raw=readLocalJson(key)||{},plan={...(raw.plan||{}),unit:'ayahs',amount:Math.max(1,Math.min(100,Number($('#onboardingDailyAmount').value||5))),startSurah:Math.max(1,Number($('#onboardingStartSurah').value||1)),startAyah:Math.max(1,Number($('#onboardingStartAyah').value||1)),cursor:null};try{localStorage.setItem(key,JSON.stringify({...raw,version:5,plan}))}catch{};window.RAFIQ_MEM?.setPlanPreset?.(plan);state.onboardingComplete=true;state.welcomeSeen=true;save()}
function finishOnboarding(){applyOnboarding();closeWelcome();toast('تم إعداد رفيق القرآن ✅')}
function openOnboarding(){const el=$('#welcomeScreen');if(!el||state.onboardingComplete)return;el.classList.remove('hidden','leaving');el.setAttribute('aria-hidden','false');document.body.classList.add('welcome-lock');setOnboardingStep(1)}
function closeWelcome(){const el=$('#welcomeScreen');if(!el)return;el.classList.add('leaving');setTimeout(()=>{el.classList.add('hidden');el.classList.remove('leaving');el.setAttribute('aria-hidden','true');document.body.classList.remove('welcome-lock')},280)}
$('#onboardingNext')?.addEventListener('click',()=>onboardingStep<3?setOnboardingStep(onboardingStep+1):finishOnboarding());$('#onboardingBack')?.addEventListener('click',()=>setOnboardingStep(onboardingStep-1));$('#onboardingSkipNotify')?.addEventListener('click',finishOnboarding);$('#onboardingNotifyBtn')?.addEventListener('click',async()=>{if(!('Notification'in window))return toast('الإشعارات غير مدعومة هنا');try{const p=await Notification.requestPermission();toast(p==='granted'?'تم تفعيل الإشعارات ✅':'تم تجاوز الإشعارات')}catch{toast('تعذر طلب إذن الإشعارات')}});
function maybeOpenDailyWelcome(){if(!state.onboardingComplete)openOnboarding();}
window.RAFIQ_RECITERS=reciters;
window.rafiqToast=toast;
window.RAFIQ_QURAN=quran;
window.RAFIQ_GET_RITUAL_KEY=ritualKey;
window.RAFIQ_APP={getQuran:()=>quran, getRitualKey:()=>ritualKey(), save:()=>save(), go:view=>go(view), toast};
window.RAFIQ_PLAY_AYAH=(s,a)=>ensureReciterAndPlay(Number(s)||1,Number(a)||1);
window.setRafiqReciter=(folder)=>{
  const r=reciters.find(x=>x.folder===folder);
  if(!r){return false}
  state.prefs=state.prefs||{};
  state.prefs.reciter=r.folder;
  audioState.reciter=r;
  state.audio={...(state.audio||{}),reciter:r.folder,source:r.source};
  save();
  updatePlayer();
  updateQuranReciterButton();
  return true;
};
window.RAFIQ_API={get state(){return state},get quran(){return quran},get reciters(){return reciters},save,toast,go,renderRecitations,ensureReciterAndPlay,openReciterChooser,updateQuranReciterButton,openDownloadCenter,openRecitationDownloadModal};
ensureScheduleState();renderAthar(atharIndex);renderAtharMemory();hydrateSettings();renderSchedule();renderMethod();updateHome();updateNetwork();addEventListener('online',()=>{updateNetwork();refreshDailyOnline(false).then(()=>{renderDailyHome();renderWelcome()}).catch(()=>{})});addEventListener('offline',updateNetwork);ocean();updatePlayer();renderDailyHome();loadQuran().then(()=>{renderWelcome();renderDailyHome();updateHome();document.dispatchEvent(new CustomEvent('rafiq-data-ready'));window.dispatchEvent(new CustomEvent('rafiq-quran-ready'));}).catch(()=>{renderWelcome();renderDailyHome()});setInterval(checkRitualBoundary,60000);
setTimeout(()=>refreshDailyOnline(false).then(()=>{renderDailyHome();updateHome();}).catch(()=>{}),1200);if(!state.onboardingComplete)setTimeout(openOnboarding,450);setInterval(checkReminders,60000);setInterval(()=>{if(state.prefs?.maghribMode==='location')updateMaghribBoundary({request:false});},3600000);checkReminders();updateMaghribBoundary({request:false});
})();
window.addEventListener('resize',()=>{if(window.__rafiqResize)return;window.__rafiqResize=requestAnimationFrame(()=>{window.__rafiqResize=0;if(document.body.dataset.view==='progress')renderProgressDashboard()})},{passive:true});
