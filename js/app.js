(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const storeKey='rafiq-state-v85';
const LEGACY_STATE_KEYS=['rafiq-clean-v58-state','rafiq-fusion-state-v31','rafiq-zero-state-v5'];
const LEGACY_HIFZ_KEYS=['rafiq-hifz-fusion-v34','rafiq-hifz-fusion-v31','rafiq-hifz-v1','rafiq-hifz-v2'];
const LEGACY_DAILY_KEYS=['rafiq-home-daily-v82','rafiq-welcome-daily-v83','rafiq-welcome-seen-v70'];
const DEFAULT_STATE={name:null,plan:{},last:{s:1,a:1},memorizedAyahs:[],schedule:[['ورد القرآن','صباحًا'],['مراجعة','مساءً']],reminders:[],athar:{note:'',action:'',history:[]},prefs:{motion:true,ocean:true,light:false,style:'balanced',surface:'balanced',performance:'auto',fontSize:'normal',contrast:false},sessions:0,streak:0,bestStreak:0,activityLog:{},hifz:[],dailyContent:null,welcomeDaily:null,welcomeSeen:false};
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
  try{localStorage.setItem(storeKey,JSON.stringify(base));for(const key of [...LEGACY_STATE_KEYS,...LEGACY_HIFZ_KEYS,...LEGACY_DAILY_KEYS]) localStorage.removeItem(key);}catch{}
  return base;
}
let state=migrateState();
let quran=[]; state.activityLog=state.activityLog||{}; state.bestStreak=state.bestStreak||0; let currentSurah=Math.max(1,state.last?.s||1);
window.isAudioPlaying=false;
const reciters=[
 {name:'محمود خليل الحصري',folder:'Husary_128kbps',source:'everyayah',quality:'128 kbps',mode:'verse'},
 {name:'محمد صديق المنشاوي',folder:'Minshawy_Murattal_128kbps',source:'everyayah',quality:'128 kbps',mode:'verse'},
 {name:'فارس عباد',folder:'Fares_Abbad_64kbps',source:'mp3quran',server:'https://server8.mp3quran.net/frs_a/',quality:'MP3Quran',mode:'surah'},
 {name:'عبد الباسط عبد الصمد',folder:'Abdul_Basit_Murattal_192kbps',source:'everyayah',quality:'192 kbps',mode:'verse'}
];
const audioState={reciter:reciters[0],surah:1,verseIndex:0,active:false};
const qAudio=$('#quranAudio');
// Audio-reactive visual controller: maps the real playback level to subtle motion/glow.
const audioReactive=(()=>{
  let ctx=null, analyser=null, source=null, raf=0, data=null, ready=false;
  let smooth=0, lastBeat=0;
  const root=document.documentElement;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  function setVars(energy,active){
    const e=active?clamp(energy):0;
    const speed=active?(0.86+e*0.48):1;
    const glow=active?(0.80+e*0.62):1;
    const flame=active?(0.92+e*0.46):1;
    root.style.setProperty('--audio-energy',e.toFixed(3));
    root.style.setProperty('--audio-speed',speed.toFixed(3));
    root.style.setProperty('--audio-glow',glow.toFixed(3));
    root.style.setProperty('--audio-flame',flame.toFixed(3));
  }
  function ensure(){
    if(ready||!qAudio||!window.AudioContext&&!window.webkitAudioContext)return;
    try{
      const A=window.AudioContext||window.webkitAudioContext;
      ctx=new A();
      source=ctx.createMediaElementSource(qAudio);
      analyser=ctx.createAnalyser();
      analyser.fftSize=512; analyser.smoothingTimeConstant=.78;
      data=new Uint8Array(analyser.fftSize);
      source.connect(analyser); analyser.connect(ctx.destination);
      ready=true;
    }catch{ready=false;}
  }
  function tick(){
    raf=requestAnimationFrame(tick);
    if(!qAudio||qAudio.paused||qAudio.ended||document.hidden){
      smooth += (0-smooth)*.12; setVars(0,false); return;
    }
    ensure();
    let level=0;
    if(ready&&analyser){
      try{
        analyser.getByteTimeDomainData(data);
        let sum=0;
        for(let i=0;i<data.length;i++){const x=(data[i]-128)/128;sum+=x*x;}
        const rms=Math.sqrt(sum/data.length);
        level=clamp(rms*4.2);
      }catch{}
    }
    // Keep a small floor from the media volume so quiet passages remain responsive.
    const volumeFloor=clamp((qAudio.volume??1)*.22);
    level=Math.max(level,volumeFloor*.18);
    smooth += (level-smooth)*.14;
    const now=performance.now();
    if(smooth>.72 && now-lastBeat>1500){
      lastBeat=now; document.dispatchEvent(new CustomEvent('rafiq-audio-beat',{detail:{energy:smooth}}));
    }
    setVars(smooth,true);
  }
  function start(){
    ensure();
    if(ctx?.state==='suspended')ctx.resume().catch(()=>{});
    if(!raf)tick();
  }
  function stop(){if(raf){cancelAnimationFrame(raf);raf=0;}smooth=0;setVars(0,false);}
  qAudio?.addEventListener('play',start);
  qAudio?.addEventListener('playing',start);
  qAudio?.addEventListener('pause',()=>{smooth=0;setVars(0,false)});
  qAudio?.addEventListener('ended',stop);
  qAudio?.addEventListener('emptied',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){smooth=0;setVars(0,false)}else if(qAudio&&!qAudio.paused)start()});
  setVars(0,false);
  return {start,stop};
})();
function audioUrl(reciter,surah,ayah){
  const s=String(surah).padStart(3,'0');
  if(reciter.source==='mp3quran') return `${reciter.server}${s}.mp3`;
  return `https://everyayah.com/data/${reciter.folder}/${s}${String(ayah).padStart(3,'0')}.mp3`;
}
function updatePlayer(){
  const s=quran[audioState.surah-1]; if(!s)return;
  const verse=s.verses[audioState.verseIndex];
  $('#playerTitle').textContent=`تلاوة سورة ${s.name}`;
  $('#playerSub').textContent=audioState.reciter.mode==='surah'
    ? `${audioState.reciter.name} · ${audioState.reciter.quality} · السورة كاملة`
    : `${audioState.reciter.name} · ${audioState.reciter.quality} · الآية ${verse?.a||1}`;
  $('#playerToggle').textContent=qAudio.paused?'تشغيل':'إيقاف';
}
async function playRecitation(reciter, surah=currentSurah, verseIndex=0, resumeTime=0){
  if(!quran.length)return;
  audioState.reciter=reciter; audioState.surah=surah; state.prefs=state.prefs||{}; state.prefs.reciter=reciter.folder; audioState.verseIndex=reciter.mode==='surah'?0:Math.max(0,Math.min(verseIndex,(quran[surah-1]?.verses.length||1)-1)); audioState.active=true;
  const s=quran[surah-1], v=s.verses[audioState.verseIndex];
  qAudio.src=audioUrl(reciter,surah,v.a); qAudio.currentTime=Math.max(0,+resumeTime||0);
  state.audio={reciter:reciter.folder,surah,verseIndex:audioState.verseIndex,time:qAudio.currentTime,active:true,source:reciter.source}; save();
  try{await qAudio.play(); window.isAudioPlaying=true; document.body.dataset.audio='playing'; $('#floatingPlayer').classList.add('active'); updatePlayer(); window.syncRafiqPauseButton?.(); toast(`بدأت تلاوة ${s.name} · ${reciter.name} ✨`);}catch(e){window.isAudioPlaying=false;document.body.dataset.audio='error';$('#floatingPlayer').classList.add('active');updatePlayer();toast('التلاوة تحتاج اتصالًا بالإنترنت.')}
}
qAudio.addEventListener('timeupdate',()=>{const p=qAudio.duration?Math.min(100,qAudio.currentTime/qAudio.duration*100):0;$('#playerProgress').style.width=p+'%'; if(audioState.active){state.audio={reciter:audioState.reciter.folder,surah:audioState.surah,verseIndex:audioState.verseIndex,time:qAudio.currentTime,active:true,source:audioState.reciter.source};save();}});
qAudio.addEventListener('ended',()=>{
  const s=quran[audioState.surah-1];
  if(audioState.reciter.mode==='surah'){
    if(audioState.surah<quran.length){ playRecitation(audioState.reciter,audioState.surah+1,0); }
    else { stopRecitation(false); toast('اكتملت التلاوة ✨'); }
    return;
  }
  if(audioState.verseIndex < s.verses.length-1){audioState.verseIndex++;qAudio.src=audioUrl(audioState.reciter,audioState.surah,s.verses[audioState.verseIndex].a);qAudio.play().then(updatePlayer).catch(stopRecitation);}else{stopRecitation(false);toast('انتهت تلاوة السورة ✨')}
});
qAudio.addEventListener('error',()=>{document.body.dataset.audio='error';toast('تعذر تحميل التلاوة من المصدر الخارجي');});
function stopRecitation(hide=true){qAudio.pause(); window.syncRafiqPauseButton?.();qAudio.removeAttribute('src');qAudio.load();window.isAudioPlaying=false;document.body.dataset.audio='';audioState.active=false;state.audio={...(state.audio||{}),active:false};save();$('#playerProgress').style.width='0%';if(hide)$('#floatingPlayer').classList.remove('active');updatePlayer();}

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
const audio=[
 {name:'الحصري',icon:'🎧',file:'Al-Quran_tilawat_Mahmoud_Al-Hosary-1.rar'},
 {name:'المنشاوي',icon:'🎙️',file:'MINSHAWY.1.rar'},
 {name:'فارس عباد',icon:'🎧',file:'FARES-ABBAD.rar'}
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
  if(view==='study')renderStudy();
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
function planForecast(){const p=state.plan||{};if(!p.goal||!p.daily)return {text:'لا توجد خطة',detail:'أنشئ خطة لمعرفة الموعد المتوقع.'};const remaining=Math.max(0,Number(p.remaining!=null?p.remaining:p.goal));const daily=Math.max(.01,Number(p.daily));const days=Math.ceil(remaining/daily);const when=new Date();when.setDate(when.getDate()+days);return {text:days===0?'اكتملت الخطة':`${days} يوم تقريبًا`,detail:days===0?'ما شاء الله، وصلت للهدف.':`لو حافظت على ${daily} ${p.unit||''} يوميًا، فالموعد التقريبي ${when.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`}}
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
  const flame=document.getElementById('heroFlameVisual');if(flame)flame.style.setProperty('--flame-scale',(0.82+intensity*.52).toFixed(2));
  const pFlame=document.getElementById('progressFlameVisual');if(pFlame)pFlame.style.setProperty('--flame-scale',(0.82+intensity*.52).toFixed(2));
  const memAyahs=(Array.isArray(state.memorizedAyahs)?state.memorizedAyahs.length:0);
  const mem=Array.isArray(hifz)?hifz.length:0,rem=Math.max(0,114-mem),forecast=planForecast();
  const avg=week.reduce((n,x)=>n+x.score,0)/7,weekPct=Math.min(100,Math.round(avg/8*100));
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('homeFlame',`${state.streak||0} يوم`);set('homeFlameSub',`أفضل سلسلة ${state.bestStreak||state.streak||0} يوم`);
  set('heroFlameValue',`${state.streak||0} يوم`);set('heroFlameSub',`أفضل سلسلة ${state.bestStreak||state.streak||0} يوم`);
  set('homeMemProgress',`${mem} / 114`);set('homeMemRemaining',`باقي ${rem} سورة`);
  set('homePlanProgress',state.plan?.goal?`${pct}%`:'—');set('homeFinishEstimate',state.plan?.goal?forecast.text:'أنشئ خطة لمعرفة الموعد المتوقع');set('homeWeekScore',`${weekPct}%`);
  const bars=document.getElementById('homeWeekBars');
  if(bars)bars.innerHTML=week.map(x=>{const h=Math.min(100,Math.round(x.score/8*100));return `<div class="week-bar"><div class="bar-track"><div class="bar-fill" style="height:${Math.max(4,h)}%"></div></div><b>${Math.round(x.score)}</b><small>${x.name}</small></div>`}).join('');
  state.__activityVersion=(state.__activityVersion||0)+1;
  document.dispatchEvent(new CustomEvent('rafiq-home-updated'));
}

function renderProgressDashboard(){
  updateActivitySummary();
  const mem=Array.isArray(hifz)?hifz.length:0,rem=Math.max(0,114-mem),forecast=planForecast(),week=getWeekScores(),ms=savedMemorizationStats();
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
  const pct=percent();
  $('#homePct').textContent=pct+'%';$('#homeOrb').style.setProperty('--p',pct+'%');
  if(state.plan.daily) $('#statWard').textContent=`${state.plan.daily} ${state.plan.unit||''}`;
  else {$('#statWard').innerHTML='<button class="inline-cta" data-go="plan" type="button">حدد وردك اليوم</button>';$('#statWard .inline-cta')?.addEventListener('click',()=>go('plan'));}
  $('#statSessions').textContent=state.sessions||0;$('#statStreak').textContent=state.streak||0;
  $('#statLast').innerHTML=(quran.length&&state.last?.s)?`<button class="last-position-cta" type="button"><strong>${quran[state.last.s-1]?.name||'غير محدد'} · آية ${state.last.a||'—'}</strong></button>`:'غير محدد';$('#statLast .last-position-cta')?.addEventListener('click',()=>{$('#goLast')?.click()});
  $('#todayList').innerHTML=`<div class="today-row"><b>📖 الورد</b><span>اقرأ المقدار المحدد ثم سجّل جلستك.</span><em>${state.plan.daily?state.plan.daily+' '+state.plan.unit:'حدد وردك اليوم'}</em></div><div class="today-row"><b>🧠 الدراسة</b><span>اختَر مادة واحدة وركّز فيها اليوم.</span><em>خطوة واحدة تكفي</em></div><div class="today-row"><b>✨ الأثر</b><span>خُد فكرة واحدة وحوّلها لعمل.</span><em>قابل للتطبيق</em></div>`;
  const q=getDynamicAthar(Math.floor(Date.now()/86400000));$('#homeQuote').textContent=q.text;$('#homeQuoteRef').textContent=`${q.type} · ${q.ref}`;
  updateActivitySummary();
}

function populatePlanSurahs(){
  const sel=$('#planSurah'); if(!sel)return;
  const current=Number(state.plan.surah||currentSurah||1);
  sel.innerHTML=quran.map((surah,i)=>`<option value="${i+1}">${i+1}. ${surah.name} · ${surah.count} آية</option>`).join('');
  sel.value=String(current);
  const s=quran[current-1];
  $('#planSurahHint').textContent=s?`السورة المختارة: ${s.name} — ${s.count} آية. الهدف بالآيات يُحسب لهذه السورة وحدها.`:'';
}
function syncPlanUnitUI(){
  const unit=$('#goalUnit').value;
  const field=$('#planSurahField');
  if(unit==='آية'){
    field.hidden=false;
    populatePlanSurahs();
    $('#goalHint').textContent='عند اختيار «آية»، كل الحسابات تكون داخل سورة واحدة فقط، وليست مجموع آيات عدة سور.';
  }else{
    field.hidden=true;
    $('#goalHint').textContent='أدخل مقدار الهدف في الوحدة التي اخترتها.';
  }
}
function renderPlan(){
  const p=state.plan;$('#goalAmount').value=p.goal||'';$('#goalUnit').value=p.unit||'صفحة';$('#planDays').value=p.days||'';$('#planName').value=p.name||'';
  populatePlanSurahs(); syncPlanUnitUI();
  $('#planGoal').textContent=p.goal?`${p.goal} ${p.unit}`:'—';$('#planDaily').textContent=p.daily?`${p.daily} ${p.unit}`:'—';$('#planRemain').textContent=p.remaining!=null?`${p.remaining} ${p.unit}`:'—';$('#planDaysView').textContent=p.days?`${p.days} يوم`:'—';$('#planBar').style.width=percent()+'%';
}
$('#goalUnit').addEventListener('change',syncPlanUnitUI);
$('#planSurah')?.addEventListener('change',()=>{state.plan.surah=Number($('#planSurah').value);save();syncPlanUnitUI();});
$('#savePlan').onclick=()=>{
  const goal=+$('#goalAmount').value,days=+$('#planDays').value,unit=$('#goalUnit').value,name=$('#planName').value.trim();
  if(!goal||!days)return toast('اكتب الهدف وعدد الأيام أولًا');
  const surah=unit==='آية'?Number($('#planSurah').value||currentSurah):null;
  const surahData=surah?quran[surah-1]:null;
  if(unit==='آية' && !surahData)return toast('اختر السورة أولًا');
  if(unit==='آية' && goal>surahData.count)return toast(`سورة ${surahData.name} فيها ${surahData.count} آية فقط`);
  const daily=Math.ceil((goal/days)*10)/10;
  state.plan={goal,days,unit,name,daily,remaining:goal,created:Date.now(),surah};
  save();renderPlan();updateHome();$('#planResult').hidden=false;
  $('#planResult').textContent=unit==='آية'?`وردك اليومي: ${daily} آية من سورة ${surahData.name}. كل الحسابات تخص هذه السورة وحدها.`:`وردك اليومي المقترح: ${daily} ${unit}. عدّل المعدل حسب ظروفك.`;
  toast('تم حفظ الخطة ✅');
};
$('#resetPlan').onclick=()=>{state.plan={};save();renderPlan();updateHome();toast('تمت إعادة ضبط الخطة')};
async function loadQuran(){
  const cacheKey='rafiq-quran-uthmani-v1';
  const dbOpen=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('rafiq-data',1);r.onupgradeneeded=()=>r.result.createObjectStore('cache');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const dbGet=async()=>{try{const db=await dbOpen();return await new Promise((res,rej)=>{const t=db.transaction('cache','readonly');const g=t.objectStore('cache').get(cacheKey);g.onsuccess=()=>res(g.result||null);g.onerror=()=>rej(g.error)})}catch{return null}};
  const dbPut=async(value)=>{try{const db=await dbOpen();await new Promise((res,rej)=>{const t=db.transaction('cache','readwrite');const q=t.objectStore('cache').put(value,cacheKey);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}catch{}};
  try{
    const local=await fetch('quran-uthmani.json',{cache:'force-cache'});
    if(local.ok){quran=await local.json();}
    else throw new Error('local');
  }catch{
    const cached=await dbGet();
    if(cached){quran=cached;}
    else if(navigator.onLine){
      try{
        const meta=await (await fetch('https://api.github.com/repos/mustafahossameldin66-dotcom/Test-Rafiq/releases/tags/content-v1',{cache:'no-store'})).json();
        const asset=meta?.assets?.find(a=>a.name==='quran-uthmani.json');
        if(!asset?.browser_download_url)throw new Error('asset');
        const r=await fetch(asset.browser_download_url,{cache:'no-store'});
        if(!r.ok)throw new Error('download');
        quran=await r.json();
        await dbPut(quran);
      }catch(e){toast('تعذر تحميل بيانات المصحف؛ تحقق من الاتصال أو أعد المحاولة');renderHifz();return;}
    }else{toast('المصحف غير متاح دون اتصال حتى يتم تحميله مرة واحدة');renderHifz();return;}
  }
  atharIndex=Math.floor(Date.now()/86400000)%Math.max(1,buildDynamicAthars().length);
  renderAthar(atharIndex);renderSurahGrid();renderQuran();updateHome();renderHifz();renderPlan();renderMemorizationSummary();renderProgressDashboard();restoreAudioState();
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
  $('#ayahs').innerHTML=s.verses.map(v=>{const key=`${currentSurah}:${v.a}`,isMem=memorized.has(key),isLast=v.a===lastAyah;return `<article class="quran-ayah ${isMem?'memorized':''}" data-ayah="${v.a}" data-last-position="${isLast?'1':'0'}"><div class="quran-text">${v.text}</div><div class="ayah-meta"><span>${s.name} · ${v.a}</span><span>آية رقم ${v.global}</span>${isLast?'<span class="last-position-badge">📌 آخر موضع</span>':''}</div><div class="ayah-actions"><button class="btn quran-ayah-btn" type="button" data-mark="${v.a}">📍 حفظ الموضع</button><button class="btn quran-ayah-btn ${isMem?'memorized-btn':''}" type="button" data-memorize="${v.a}">${isMem?'✨ الآية محفوظة':'💚 حفظت الآية'}</button><button class="btn quran-ayah-btn" type="button" data-ayah-study="${v.a}">📚 دراسة الآية</button><button class="btn quran-ayah-btn" type="button" data-ayah-play="${v.a}">▶ استماع</button></div></article>`}).join('');
  $$('[data-mark]').forEach(b=>b.onclick=()=>{state.last={s:currentSurah,a:+b.dataset.mark};save();renderQuran();updateHome();document.querySelector(`.quran-ayah[data-ayah="${b.dataset.mark}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});toast(`تم حفظ آخر موضع: ${s.name} · آية ${b.dataset.mark} ✅`)});
  $$('[data-memorize]').forEach(b=>b.onclick=()=>{const a=+b.dataset.memorize,key=`${currentSurah}:${a}`;state.memorizedAyahs=Array.isArray(state.memorizedAyahs)?state.memorizedAyahs:[];const has=state.memorizedAyahs.includes(key);state.memorizedAyahs=has?state.memorizedAyahs.filter(x=>x!==key):[...state.memorizedAyahs,key];if(!has)touchActivity('mem',1);save();renderQuran();updateHome();toast(has?'أزيلت علامة حفظ الآية':'تم حفظ الآية ✨ وأصبح لونها زمرديًا وذهبيًا')});
  $$('[data-ayah-study]').forEach(b=>b.onclick=()=>openAyahStudy(currentSurah,+b.dataset.ayahStudy,'summary'));
  $$('[data-ayah-play]').forEach(b=>b.onclick=()=>ensureReciterAndPlay(currentSurah,+b.dataset.ayahPlay));
  $$('[data-study-topic]').forEach(b=>b.onclick=()=>openAyahStudy(currentSurah,state.last?.a||1,b.dataset.studyTopic||'summary'));
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
function openStudyTopic(topic, ayahNumber=1){ openAyahStudy(currentSurah, ayahNumber, topic||'summary'); }
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
function openReciterChooser(surah=currentSurah,ayahNumber=1){
  const body=$('#rafiqStudyModalBody'), modal=$('#rafiqStudyModal'); if(!body||!modal)return;
  $('#rafiqStudyModalTitle').textContent='🎙️ اختر القارئ';
  body.innerHTML=`<div class="reciter-choice-intro">اختر قارئًا لأول مرة؛ سيتم حفظ اختيارك داخل الجهاز ويمكن تغييره لاحقًا من هنا.</div><div class="reciter-chooser-grid">${reciters.map((r,i)=>`<button class="reciter-choice" type="button" data-reciter-choice="${i}"><span class="reciter-choice-icon">${i===1?'🎙️':i===2?'🌙':i===3?'✨':'🎧'}</span><strong>${r.name}</strong><small>${r.quality} · ${r.mode==='surah'?'السورة كاملة':'آية بآية'}</small></button>`).join('')}</div>`;
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
  $$('#rafiqStudyModalBody [data-reciter-choice]').forEach(b=>b.onclick=()=>{const r=reciters[+b.dataset.reciterChoice];state.prefs=state.prefs||{};state.prefs.reciter=r.folder;state.audio=state.audio||{};state.audio.reciter=r.folder;save();updateQuranReciterButton();closeRafiqStudyModal();playRecitation(r,surah,Math.max(0,ayahNumber-1));toast(`تم تثبيت القارئ: ${r.name}`);});
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
async function downloadCurrentSurah(){
 const r=audioState.reciter||reciters[0],s=quran[currentSurah-1];if(!s||!r)return toast('السورة غير جاهزة للتحميل');
 if(r.mode==='surah'){
  const url=audioUrl(r,currentSurah,s.verses?.[0]?.a||1),filename=`Rafiq-${String(currentSurah).padStart(3,'0')}-${s.name}.mp3`;toast('جاري تجهيز تحميل السورة…');
  try{const res=await fetch(url,{mode:'cors'});if(!res.ok)throw new Error('download');const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);toast(`بدأ تحميل سورة ${s.name} ✅`)}catch{window.open(url,'_blank','noopener');toast('فتح ملف السورة من المصدر للتحميل')}
  return;
 }
 const body=$('#rafiqStudyModalBody'),modal=$('#rafiqStudyModal');if(!body||!modal)return;
 $('#rafiqStudyModalTitle').textContent=`⇩ تحميل سورة ${s.name}`;$('#rafiqStudyModalSub').textContent=`${r.name} · ${s.count} آيات`;
 body.innerHTML=`<div class="study-info-card"><h4>تحميل السورة</h4><p>هذا القارئ يوفر الآيات كملفات مستقلة. اختر تنزيل الآيات التي تريدها أو افتح المصدر لتنزيلها من الموقع.</p><div class="download-ayah-grid">${s.verses.map(v=>`<button class="btn" type="button" data-download-ayah="${v.a}">تنزيل آية ${v.a}</button>`).join('')}</div><div style="margin-top:12px"><a class="btn" href="${audioUrl(r,currentSurah,s.verses[0]?.a||1)}" target="_blank" rel="noopener">فتح المصدر الأول ↗</a></div></div>`;
 modal.classList.add('open');modal.setAttribute('aria-hidden','false');
 $$('#rafiqStudyModalBody [data-download-ayah]').forEach(b=>b.onclick=async()=>{const aNum=+b.dataset.downloadAyah;const url=audioUrl(r,currentSurah,aNum);try{const res=await fetch(url,{mode:'cors'});if(!res.ok)throw 0;const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Rafiq-${String(currentSurah).padStart(3,'0')}-${String(aNum).padStart(3,'0')}.mp3`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200)}catch{window.open(url,'_blank','noopener')}});
}
$('#downloadSurahBtn')?.addEventListener('click',downloadCurrentSurah);
$('#quranPauseBtn')?.addEventListener('click',()=>{
 if(!qAudio)return;
 if(audioState.active&&!qAudio.paused){qAudio.pause();window.isAudioPlaying=false;document.body.dataset.audio='paused';updatePlayer();toast('تم إيقاف التلاوة ⏸️');}
 else if(audioState.active){qAudio.play().then(()=>{window.isAudioPlaying=true;document.body.dataset.audio='playing';updatePlayer();}).catch(()=>toast('تعذر استئناف التلاوة'))}
 else ensureReciterAndPlay(currentSurah,state.last?.a||1);
});
qAudio?.addEventListener('play',()=>{$('#quranPauseBtn')?.setAttribute('data-playing','true')});
qAudio?.addEventListener('pause',()=>{$('#quranPauseBtn')?.removeAttribute('data-playing')});
function releaseUrl(file){return 'https://github.com/mustafahossameldin66-dotcom/Test-Rafiq/releases/latest/download/'+encodeURIComponent(file).replace(/%2F/g,'/')}
function renderStudy(){
 const grid=$('#audioGrid'); if(!grid)return;
 const options=quran.map((s,i)=>`<option value="${i+1}">${i+1}. ${s.name}</option>`).join('');
 grid.innerHTML=reciters.map((r,i)=>`<article class="card audio-live reciter-card" data-reciter-card="${i}"><div class="reciter-card-inner"><div class="reciter-icon" aria-hidden="true">${i===1?'🎙️':'🎧'}</div><h3>${r.name}</h3><div class="reciter-quality">${r.quality}</div><p>غيّر القارئ متى شئت؛ سيُستخدم الاختيار في المصحف.</p><label class="reciter-select-label" for="reciterSurah-${i}">السورة</label><select class="reciter-surah-select" id="reciterSurah-${i}" data-reciter-surah="${i}">${options}</select><div class="hero-actions reciter-actions"><button class="btn primary" type="button" data-play-reciter="${i}">▶ استمع للسورة</button><button class="btn" type="button" data-set-reciter="${i}">اختيار القارئ</button></div></div></article>`).join('');
 $$('[data-play-reciter]').forEach(b=>b.onclick=()=>{const i=+b.dataset.playReciter;const select=$(`#reciterSurah-${i}`);const surah=+(select?.value||currentSurah);setRafiqReciter(reciters[i].folder);playRecitation(reciters[i],surah,0);});
 $$('[data-set-reciter]').forEach(b=>b.onclick=()=>{const i=+b.dataset.setReciter;if(setRafiqReciter(reciters[i].folder))toast(`تم اختيار ${reciters[i].name} ✅`);});
 syncRecitationSelectors();
}
function syncRecitationSelectors(){
  document.querySelectorAll('[data-reciter-surah]').forEach(el=>{el.value=String(currentSurah);});
}
$('#studyMethodOpen')?.addEventListener('click',openMethod);
$('#studySearch')?.addEventListener('input',()=>renderStudy());
$('#quranReciterBtn')?.addEventListener('click',()=>openReciterChooser(currentSurah,state.last?.a||1));
$('#playerToggle')?.addEventListener('click',()=>{if(!audioState.active)return;if(qAudio.paused)qAudio.play().then(updatePlayer).catch(()=>{});else qAudio.pause();state.audio={reciter:audioState.reciter.folder,surah:audioState.surah,verseIndex:audioState.verseIndex,time:qAudio.currentTime,active:!qAudio.paused};save();updatePlayer();window.isAudioPlaying=!qAudio.paused;document.body.dataset.audio=qAudio.paused?'paused':'playing'});
$('#playerNext')?.addEventListener('click',()=>{if(!audioState.active)return;const s=quran[audioState.surah-1];if(audioState.reciter.mode==='surah'){if(audioState.surah<quran.length)playRecitation(audioState.reciter,audioState.surah+1,0);return;}if(audioState.verseIndex<s.verses.length-1){audioState.verseIndex++;qAudio.src=audioUrl(audioState.reciter,audioState.surah,s.verses[audioState.verseIndex].a);qAudio.play().then(updatePlayer).catch(()=>{});}else if(audioState.surah<quran.length){playRecitation(audioState.reciter,audioState.surah+1,0)}});
$('#playerPrev')?.addEventListener('click',()=>{if(!audioState.active)return;if(audioState.reciter.mode==='surah'){if(audioState.surah>1)playRecitation(audioState.reciter,audioState.surah-1,0);return;}const s=quran[audioState.surah-1];if(audioState.verseIndex>0){audioState.verseIndex--;qAudio.src=audioUrl(audioState.reciter,audioState.surah,s.verses[audioState.verseIndex].a);qAudio.play().then(updatePlayer).catch(()=>{});}});
$('#closePlayerBtn')?.addEventListener('click',()=>stopRecitation(true));
$('#focusModeBtn')?.addEventListener('click',()=>{document.body.classList.add('focus-mode');$('#focusExitBtn').style.display='inline-flex';toast('بدأت الجلسة الهادئة ✨')});
$('#focusExitBtn')?.addEventListener('click',()=>{document.body.classList.remove('focus-mode');toast('انتهت الجلسة الهادئة')});

function renderAthar(i){
 const pool=buildDynamicAthars();
 const daily=state.dailyContent?.key===ritualKey()?state.dailyContent?.athar:null;
 const useDaily=daily&&!state.atharManual;
 const idx=((i%Math.max(1,pool.length))+Math.max(1,pool.length))%Math.max(1,pool.length);
 const q=useDaily?daily:pool[idx];
 $('#atharText').textContent=q?.text||'—';$('#atharRef').textContent=q?.ref||'—';$('#atharType').textContent=q?.type||'أثر';$('#atharCount').textContent=useDaily?'أثر اليوم · متصل بالإنترنت':'أثر من المخزون';
 $('#atharNote').value=state.athar.note||'';$('#atharAction').value=state.athar.action||'';
 const done=state.athar.doneKey===`${idx}:${q?.text||''}`;const btn=$('#markAthar');if(btn){btn.textContent=done?'✓ تم التطبيق':'تم تطبيقه';btn.classList.toggle('primary',done)}$('#atharCard')?.classList.toggle('done',done);
}
function renderAtharMemory(){const list=$('#atharMemoryList');if(!list)return;const safe=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};const h=Array.isArray(state.atharHistory)?state.atharHistory:[];if(!h.length){list.innerHTML='<div class="athar-memory-empty">لسه مفيش أثر محفوظ. اكتب فكرتك واضغط «حفظ الفكرة» وهتلاقيها هنا.</div>';return}list.innerHTML=h.slice(0,12).map(item=>`<article class="athar-memory-item"><div class="athar-memory-icon">${item.type==='حديث قدسي'?'🌙':item.type==='حديث نبوي'?'🌿':'✨'}</div><div><strong>${safe(item.text||'')}</strong><p>${safe(item.note||'بدون ملاحظة')}</p>${item.action?`<p>🧭 ${safe(item.action)}</p>`:''}</div><span class="athar-memory-meta">${new Date(item.time).toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}</span></article>`).join('')}
$('#clearAtharHistory')?.addEventListener('click',()=>{state.atharHistory=[];save();renderAtharMemory();toast('تم مسح سجل الأثر ✅')});
let atharIndex=Math.floor(Date.now()/86400000)%Math.max(1,buildDynamicAthars().length);
$('#newAthar').onclick=()=>{const pool=buildDynamicAthars();state.atharManual=true;atharIndex=(atharIndex+1)%Math.max(1,pool.length);state.atharNonce=(state.atharNonce||0)+1;save();renderAthar(atharIndex);toast('أثر جديد من المخزون ✨')};
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


function syncReciterSettings(){
  const sel=$('#settingsReciterSelect');
  if(!sel)return;
  sel.innerHTML='<option value="">اختر القارئ</option>'+reciters.map(r=>`<option value="${r.folder}">${r.name} · ${r.quality}</option>`).join('');
  sel.value=state.prefs?.reciter||state.audio?.reciter||'';
  if(sel.dataset.bound==='1')return;
  sel.dataset.bound='1';
  sel.addEventListener('change',()=>{
    state.prefs=state.prefs||{};
    state.prefs.reciter=sel.value||null;
    state.audio=state.audio||{};
    state.audio.reciter=sel.value||null;
    save();
    updateQuranReciterButton();
    toast(sel.value?'تم تثبيت القارئ المفضل ✅':'تمت إزالة القارئ المفضل');
  });
}

function hydrateSettings(){
  const p=state.prefs||{};
  state.prefs={motion:p.motion!==false,ocean:p.ocean!==false,light:p.light===true,style:p.style||'balanced',surface:p.surface||'balanced',performance:p.performance||detectPerformanceTier(),fontSize:p.fontSize||'normal',contrast:p.contrast===true};
  $('#motionToggle').checked=state.prefs.motion;$('#oceanToggle').checked=state.prefs.ocean;$('#lightToggle').checked=state.prefs.light;
  $('#contrastToggle').checked=state.prefs.contrast;
  document.body.classList.toggle('light',state.prefs.light);document.body.classList.toggle('a11y-contrast',state.prefs.contrast);
  document.body.dataset.light=state.prefs.light?'on':'off';document.body.dataset.fontSize=state.prefs.fontSize;document.body.dataset.perfTier=state.prefs.performance==='auto'?detectPerformanceTier():state.prefs.performance;
  document.documentElement.classList.toggle('no-motion',!state.prefs.motion);document.body.dataset.motion=state.prefs.motion?'on':'off';
  document.dispatchEvent(new CustomEvent('rafiq-motion',{detail:state.prefs.motion}));
  $('#oceanCanvas').style.display=state.prefs.ocean?'block':'none';
  $$('.lantern,.celestial-jewels,.emeralds,.sky-ornament,.wind-streams,.light-wind-dust').forEach(x=>x.style.display=state.prefs.ocean?'':'none');
  applyStyle(state.prefs.style);
  applySurface(state.prefs.surface);
  $$('.surface-option').forEach(b=>b.classList.toggle('active',b.dataset.surfaceChoice===state.prefs.surface));
  $$('.a11y-btn').forEach(b=>b.classList.toggle('active',b.dataset.fontSize===state.prefs.fontSize));
  $$('.perf-btn').forEach(b=>b.classList.toggle('active',b.dataset.performance===state.prefs.performance));
}
$('#motionToggle').onchange=e=>{state.prefs.motion=e.target.checked;save();hydrateSettings();toast(e.target.checked?'الحركة مفعلة':'تم إيقاف الحركة')};
$('#oceanToggle').onchange=e=>{state.prefs.ocean=e.target.checked;save();hydrateSettings();toast(e.target.checked?'العالم البحري مفعّل 🌊':'العالم البحري متوقف')};
$('#lightToggle').onchange=e=>{state.prefs.light=e.target.checked;save();hydrateSettings();toast(e.target.checked?'الوضع الفاتح مفعل':'الوضع الليلي مفعل')};
$('#contrastToggle').onchange=e=>{state.prefs.contrast=e.target.checked;save();hydrateSettings();toast(e.target.checked?'تم رفع التباين':'عاد التباين المتوازن')};
$$('.a11y-btn').forEach(b=>b.onclick=()=>{state.prefs.fontSize=b.dataset.fontSize;save();hydrateSettings();toast('تم ضبط حجم النص')});
$$('.perf-btn').forEach(b=>b.onclick=()=>{state.prefs.performance=b.dataset.performance;save();hydrateSettings();document.dispatchEvent(new CustomEvent('rafiq-performance-change'));toast('تم تغيير مستوى الأداء');});

$$('.style-card').forEach(b=>b.onclick=()=>{state.prefs.style=b.dataset.styleChoice;save();applyStyle(state.prefs.style);toast(`تم تطبيق نمط ${b.querySelector('b').textContent} ✨`)});
$$('.surface-option').forEach(b=>b.onclick=()=>{state.prefs.surface=b.dataset.surfaceChoice;save();applySurface(state.prefs.surface);toast(`تم تطبيق كثافة ${b.querySelector('b').textContent}`)});
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rafiq-backup.json';a.click();URL.revokeObjectURL(a.href)};$('#importDataBtn').onclick=()=>$('#importData').click();$('#importData').onchange=async e=>{try{const obj=JSON.parse(await e.target.files[0].text());state={...state,...obj};save();renderPlan();hydrateSettings();updateHome();toast('تم الاستيراد ✅')}catch{toast('ملف غير صالح')}};$('#clearData').onclick=()=>{if(confirm('مسح البيانات المحلية؟')){localStorage.removeItem(storeKey);location.reload()}};
$('#closeModal').onclick=()=>$('#modal').classList.remove('open');
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

function startSession(){if(state.prefs.session)return;state.prefs.session=true;state.prefs.sessionPrevMotion=state.prefs.motion!==false;state.prefs.motion=false;save();document.body.classList.add('session-mode-active','focus-mode');$('#sessionMode').classList.add('open');$('#sessionMode').setAttribute('aria-hidden','false');hydrateSettings()}
function endSession(){state.prefs.motion=state.prefs.sessionPrevMotion!==false;state.prefs.session=false;delete state.prefs.sessionPrevMotion;save();document.body.classList.remove('session-mode-active','focus-mode');$('#sessionMode').classList.remove('open');$('#sessionMode').setAttribute('aria-hidden','true');hydrateSettings()}
$('#startSession')?.addEventListener('click',startSession);$('#sessionExit')?.addEventListener('click',endSession);$('#sessionOpenQuran')?.addEventListener('click',()=>{endSession();go('quran')});

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
  if(!Array.isArray(state.schedule))state.schedule=[['ورد القرآن','صباحًا'],['مراجعة','مساءً']];
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
$('#addSchedule')?.addEventListener('click',()=>{ensureScheduleState();const title=($('#scheduleTitle')?.value||'').trim(),time=($('#scheduleTime')?.value||'').trim()||'مرن';if(!title)return toast('اكتب اسم المحطة أولًا');state.schedule.push([title,time]);save();if($('#scheduleTitle'))$('#scheduleTitle').value='';if($('#scheduleTime'))$('#scheduleTime').value='';renderSchedule();toast('تمت إضافة المحطة ✅')});
$('#addReminder')?.addEventListener('click',()=>{ensureScheduleState();const title=($('#reminderTitle')?.value||'').trim(),time=($('#reminderTime')?.value||'').trim()||'وقت مرن';if(!title)return toast('اكتب عنوان التذكير أولًا');state.reminders.push({title,time});save();if($('#reminderTitle'))$('#reminderTitle').value='';if($('#reminderTime'))$('#reminderTime').value='';renderSchedule();toast('تمت إضافة التذكير ✅')});
$('#notifyPermission')?.addEventListener('click',async()=>{if(!('Notification' in window))return toast('الإشعارات غير مدعومة في هذا المتصفح');try{const p=await Notification.requestPermission();toast(p==='granted'?'تم تفعيل الإشعارات ✅':'لم يتم منح الإذن')}catch{toast('تعذر تفعيل الإشعارات')}});

// lightweight view hooks
const originalGo=go; go=function(view){originalGo(view); if(view==='galaxy')renderHifz(); if(view==='schedule')renderSchedule();};
renderHifz();renderSchedule();

// v58: daily in-page experience. No blocking welcome/splash overlays.
function dailyGreetingText(){
  const name=String(state.name||'').trim();
  const who=name?` يا ${name}`:'';
  const h=new Date().getHours();
  if(h<5) return `ليلة هادئة${who} مع رفيق القرآن`;
  if(h<12) return `صباح الخير${who}، جعل الله يومك نورًا`;
  if(h<18) return `يوم طيب${who}، جعل الله لك فيه من الخير نصيبًا`;
  return `مساء الخير${who}، جعل الله ليلتك سكينة`;
}
async function refreshDailyOnline(force=false){
 if(!navigator.onLine)return false;
 const key=ritualKey(), cur=state.dailyContent;
 if(!force&&cur?.key===key&&cur.online===true)return true;
 const hash=str=>str.split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),17);
 const globalAyah=(hash(key)%6236)+1;
 let verse=null,hadith=null,athar=null;
 try{const r=await fetch(`https://api.alquran.cloud/v1/ayah/${globalAyah}/quran-uthmani`,{cache:'no-store'});if(r.ok){const d=(await r.json())?.data;if(d?.text)verse={text:d.text,ref:`${d.surah?.name||'القرآن'} · آية ${d.numberInSurah||''}`,s:d.surah?.number||1,a:d.numberInSurah||1}}}catch{}
 try{const r=await fetch('https://randomhadith.com/api',{cache:'no-store'});if(r.ok){const h=await r.json();if(h?.text_ar)hadith={text:h.text_ar,ref:`${h.book||'حديث'} · ${h.hadith_no||h.id||''}`}}}catch{}
 try{const r=await fetch('https://randomhadith.com/api',{cache:'no-store'});if(r.ok){const h=await r.json();if(h?.text_ar)athar={type:'أثر من الهدي',text:h.text_ar,ref:`${h.book||'حديث'} · ${h.hadith_no||h.id||''}`}}}catch{}
 if(!verse&&!hadith&&!athar)return false;
 const fallback=cur?.key===key?cur:{};
 state.dailyContent={key,online:true,verse:verse||fallback.verse||dailyVerse(),hadith:hadith||fallback.hadith||getDailyHadith(),qudsi:DAILY_QUDSI,athar:athar||fallback.athar||buildDynamicAthars()[dailyStableIndex(buildDynamicAthars().length)]};
 state.welcomeDaily=state.dailyContent;save();renderDailyHome();renderWelcome();return true;
}
function renderDailyHome(){
 const title=$('#dailyWelcomeTitle'),dateEl=$('#homeDailyDate'),greet=$('#homeDailyGreeting');
 if(title)title.textContent=state.name?`أهلًا يا ${String(state.name).trim()}`:'أهلًا بك في رفيق القرآن';
 if(dateEl)dateEl.textContent=ritualLabel();if(greet)greet.textContent=dailyGreetingText();
 const key=ritualKey();let daily=state.dailyContent;
 if(!daily||daily.key!==key){daily={key,online:false,verse:dailyVerse(),hadith:getDailyHadith(),qudsi:DAILY_QUDSI,athar:buildDynamicAthars()[dailyStableIndex(buildDynamicAthars().length)]};state.dailyContent=daily;state.welcomeDaily=daily;save();}
 const ay=$('#homeDailyAyah'),ref=$('#homeDailyAyahRef');if(ay)ay.textContent=daily.verse?.text||'—';if(ref)ref.textContent=daily.verse?.ref||'—';
 const had=$('#homeDailyHadith'),href=$('#homeDailyHadithRef');if(had)had.textContent=daily.hadith?.text||'—';if(href)href.textContent=daily.hadith?.ref||'—';
 const qud=$('#homeDailyQudsi'),qr=$('#homeDailyQudsiRef');if(qud)qud.textContent=`«${daily.qudsi?.text||DAILY_QUDSI.text}»`;if(qr)qr.textContent=daily.qudsi?.ref||DAILY_QUDSI.ref;
 const reason={title:'قصة عبس وتولى',text:'جاء ابن أم مكتوم رضي الله عنه إلى رسول الله ﷺ يطلب أن يُرشَد، وكان النبي ﷺ منشغلًا بدعوة رجل من عظماء قريش يرجو إسلامه؛ فنزل صدر سورة عبس عتابًا وتوجيهًا، وبيانًا أن طالب الهداية لا يُزهد فيه بسبب مكانته الاجتماعية.',ref:'المصدر: سنن الترمذي 3331، باب تفسير سورة عبس؛ وقال الترمذي: حديث حسن غريب.'};
 $('#homeDailyReason')&&($('#homeDailyReason').textContent=reason.text);$('#homeDailyReasonRef')&&($('#homeDailyReasonRef').textContent=reason.ref);document.querySelector('#dailyReasonFeature h3')&&(document.querySelector('#dailyReasonFeature h3').textContent=reason.title);
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
function boundaryMinutes(){return state.maghribMinutes||18*60}
function ritualMoment(date=new Date()){const mins=date.getHours()*60+date.getMinutes(),sunset=boundaryMinutes();return mins>=sunset?new Date(date):new Date(date.getTime()-86400000)}
function ritualKey(){const d=ritualMoment(),p=hijriParts(d);return `hijri-${p.year}-${p.month}-${p.day}`}
function ritualLabel(){return hijriLabel(ritualMoment())}
function dailyVerse(){
  if(!quran.length)return {text:'وَقُلْ رَبِّ زِدْنِي عِلْمًا',ref:'طه · آية 114',s:20,a:114};
  const seed=ritualKey().split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),11);
  const s=quran[seed%quran.length]||quran[0]; const v=s.verses[seed%(s.verses.length||1)]; return {text:v.text,ref:`${s.name} · آية ${v.a}`,s:s.number||quran.indexOf(s)+1,a:v.a};
}
function checkRitualBoundary(){const key=ritualKey();if(state.lastRitualKey!==key){state.lastRitualKey=key;state.dailyContent=null;state.atharManual=false;save();renderDailyHome();renderWelcome();refreshDailyOnline(true).then(()=>renderAthar(0));}else if(navigator.onLine&&state.dailyContent?.online!==true){refreshDailyOnline(true).then(()=>renderAthar(0));}}
const tapGlow=$('#tapGlow');document.addEventListener('pointerdown',e=>{const el=e.target.closest('button,a,[data-go],[data-view],.style-card,.hifz-star');if(!el||el.matches('input,textarea,select'))return;if(tapGlow){tapGlow.style.left=e.clientX+'px';tapGlow.style.top=e.clientY+'px';tapGlow.classList.remove('show');void tapGlow.offsetWidth;tapGlow.classList.add('show');}});

const DAILY_HADITH=[{text:'من يرد الله به خيرًا يفقهه في الدين',ref:'صحيح البخاري · 71'},{text:'أحب الأعمال إلى الله أدومها وإن قل',ref:'صحيح البخاري · 6465'},{text:'إن الله لا ينظر إلى صوركم وأموالكم ولكن ينظر إلى قلوبكم وأعمالكم',ref:'صحيح مسلم · 2564'},{text:'يسروا ولا تعسروا، وبشروا ولا تنفروا',ref:'صحيح البخاري · 69'}];
const DAILY_DUA=[
  {text:'اللهم أعنّي على ذكرك وشكرك وحسن عبادتك',ref:'دعاء مأثور · سنن أبي داود 1526'},
  {text:'اللهم إني أسألك علمًا نافعًا، ورزقًا طيبًا، وعملًا متقبلًا',ref:'دعاء مأثور · سنن ابن ماجه 925'},
  {text:'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',ref:'البقرة · 201'},
  {text:'رب اشرح لي صدري ويسر لي أمري',ref:'طه · 25–26'}
];
const DAILY_QUDSI={text:'يا عبادي إني حرمت الظلم على نفسي فلا تظالموا',ref:'صحيح مسلم · 2577'};
// Gemini-style welcome, using Rafiq's local daily verse and existing state.
function dailyStableIndex(len){const key=ritualKey();const seed=key.split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),7);return seed%Math.max(1,len);}
function getDailyHadith(){return DAILY_HADITH[dailyStableIndex(DAILY_HADITH.length)]||DAILY_HADITH[0];}
function renderWelcome(){
 const key=ritualKey();
 let cache=state.welcomeDaily||null;
 if(!cache||cache.key!==key){
   const verse=dailyVerse(); const had=getDailyHadith(); const dua=DAILY_DUA[dailyStableIndex(DAILY_DUA.length)]||DAILY_DUA[0];
   cache={key,verse,hadith:had,dua}; state.welcomeDaily=cache; save();
 }
 const name=String(state.name||'').trim();
 const t=$('#welcomeAyahText'),r=$('#welcomeAyahRef'),ht=$('#welcomeHadith'),hr=$('#welcomeHadithRef');
 if(t)t.textContent=cache.verse?.text||'—'; if(r)r.textContent=cache.verse?.ref||'—';
 if(ht)ht.textContent=cache.hadith?.text||'—'; if(hr)hr.textContent=cache.hadith?.ref||'—';
 const dt=$('#welcomeDua'), dr=$('#welcomeDuaRef'); if(dt)dt.textContent=cache.dua?.text||'—'; if(dr)dr.textContent=cache.dua?.ref||'—';
 const nameStep=$('#welcomeNameStep'),nameInput=$('#welcomeName');
 if(nameStep) nameStep.hidden=!!name;
 if(nameInput && document.activeElement!==nameInput) nameInput.value=name;
 const welcomeIntro=$('#welcomeIntro');
 if(welcomeIntro) welcomeIntro.innerHTML=name
   ? `أهلًا يا <strong>${escWelcome(name)}</strong> في <strong>رفيق القرآن</strong>.<br>اجعلها لحظة صادقة مع كتاب الله، ثم دع يومك يمشي بهدوء.`
   : `أهلًا بك في <strong>رفيق القرآن</strong>.<br>قبل أن نبدأ، عرّفني باسمك لنجعل الرسائل أقرب إليك.`;
 const closeBtn=$('#closeWelcomeBtn');
 if(closeBtn) closeBtn.innerHTML=name?'ابدأ يومك بسلام يا '+escWelcome(name)+' <span>↗</span>':'احفظ اسمي وابدأ <span>↗</span>';
}
function escWelcome(value){const d=document.createElement('div');d.textContent=String(value??'');return d.innerHTML;}
function focusWelcomeName(){const input=$('#welcomeName');if(input&&!state.name)setTimeout(()=>input.focus(),80);else setTimeout(()=>$('#closeWelcomeBtn')?.focus(),80);}
function openWelcome(){const el=$('#welcomeScreen');if(!el)return;renderWelcome();el.classList.remove('hidden','leaving');el.setAttribute('aria-hidden','false');document.body.classList.add('welcome-lock');focusWelcomeName();}
function closeWelcome(){
 const el=$('#welcomeScreen'),home=$('#view-home');if(!el||!home)return;
 const input=$('#welcomeName');
 if(!state.name){
   const clean=normalizeProfileName(input?.value);
   if(!saveProfile(clean)){
     input?.setAttribute('aria-invalid','true');
     input?.focus();
     toast('اكتب اسمك الأول عشان نخاطبك به ✨');
     return;
   }
   renderWelcome();
 }
 document.body.dataset.view='home';
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v===home));
 document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view==='home';b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 try{updateHome()}catch(e){}try{renderDailyHome()}catch(e){}
 el.classList.add('leaving');
 setTimeout(()=>{el.classList.add('hidden');el.classList.remove('leaving');el.setAttribute('aria-hidden','true');document.body.classList.remove('welcome-lock');state.welcomeSeen=true;save();home.focus?.({preventScroll:true})},420);
}
$('#closeWelcomeBtn')?.addEventListener('click',e=>{e.preventDefault();closeWelcome()});
$('#welcomeName')?.addEventListener('input',e=>{e.target.value=normalizeProfileName(e.target.value);e.target.setAttribute('aria-invalid','false');});
$('#welcomeName')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();closeWelcome();}});
$('#welcomeScreen')?.addEventListener('click',e=>{if(e.target===$('#welcomeScreen')&&state.name)closeWelcome()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#welcomeScreen')?.classList.contains('hidden')&&state.name)closeWelcome()});

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

window.RAFIQ_RECITERS=reciters;
window.rafiqToast=toast;
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
  const sel=$('#settingsReciterSelect');
  if(sel && sel.value!==r.folder) sel.value=r.folder;
  return true;
};
window.RAFIQ_API={get state(){return state},get quran(){return quran},get reciters(){return reciters},save,toast,go,renderStudy,ensureReciterAndPlay,openReciterChooser,updateQuranReciterButton};
ensureScheduleState();renderAthar(atharIndex);renderAtharMemory();renderPlan();hydrateSettings();renderSchedule();renderMethod();updateHome();updateNetwork();addEventListener('online',()=>{updateNetwork();refreshDailyOnline(true).then(()=>{renderDailyHome();renderWelcome();renderAthar(0);});});addEventListener('offline',updateNetwork);ocean();updatePlayer();renderDailyHome();if(!state.welcomeSeen||!state.name)openWelcome();loadQuran().then(()=>{renderWelcome();renderDailyHome();updateHome();document.dispatchEvent(new CustomEvent('rafiq-data-ready'));refreshDailyOnline(false).then(()=>{renderDailyHome();renderWelcome();renderAthar(0);})}).catch(()=>{renderWelcome();renderDailyHome();document.dispatchEvent(new CustomEvent('rafiq-data-ready'))});setInterval(checkRitualBoundary,60000);
})();
window.addEventListener('resize',()=>{if(window.__rafiqResize)return;window.__rafiqResize=requestAnimationFrame(()=>{window.__rafiqResize=0;if(document.body.dataset.view==='progress')renderProgressDashboard()})},{passive:true});
