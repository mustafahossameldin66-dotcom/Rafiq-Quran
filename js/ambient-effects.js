/* V96 — modular ambient atmosphere. No dependency on the old wind system. */
(function(){
  'use strict';
  const mode = window.RAFIQ_AMBIENT_MODE || 'combined';
  const root = document.body;
  if(!root) return;

  const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(max-width:760px)').matches;
  const perf = root.dataset.perfTier || 'balanced';
  const quality = perf === 'high' ? 1 : perf === 'balanced' ? .78 : .55;

  const config = {
    'combined':        {comets:5,dust:0,waves:3,lanterns:0,travel:24},
    'shooting-stars':  {comets:5,dust:0,waves:0,lanterns:0,travel:0},
    'cosmic-dust':     {comets:0,dust:42,waves:0,lanterns:0,travel:0},
    'light-waves':     {comets:0,dust:0,waves:3,lanterns:0,travel:0},
    'distant-lanterns':{comets:0,dust:0,waves:0,lanterns:4,travel:0},
    'traveling-stars': {comets:0,dust:0,waves:0,lanterns:0,travel:26},
    'stars-comets-dust':{comets:2,dust:22,waves:0,lanterns:0,travel:14}
  }[mode] || {comets:5,dust:0,waves:3,lanterns:0,travel:24};

  const scale = (n)=>Math.max(1, Math.round(n * quality * (coarse ? .72 : 1)));
  const host = document.createElement('div');
  host.id='rafiqAmbientFx';
  host.className='rafiq-ambient-fx';
  host.setAttribute('aria-hidden','true');
  root.appendChild(host);

  const add = (tag, cls, vars={})=>{
    const el=document.createElement(tag);
    el.className=cls;
    for(const [k,v] of Object.entries(vars)) el.style.setProperty(k,v);
    host.appendChild(el); return el;
  };

  // Reusable deterministic-ish random helpers for a natural spread.
  const r=(a,b)=>a+Math.random()*(b-a);
  const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];

  // 1) Shooting stars: rare, diagonal, short, soft.
  for(let i=0;i<scale(config.comets);i++){
    add('i','fx-comet',{
      '--x':`${r(-8,96)}vw`,'--y':`${r(-10,84)}vh`,
      '--dx':`${r(18,38)}vw`,'--dy':`${r(6,19)}vh`,
      '--delay':`${-r(0,18)}s`,'--dur':`${r(7,15)}s`,
      '--tilt':`${r(18,32)}deg`,'--hue':pick(['gold','ivory','emerald'])
    });
  }

  // 2) Cosmic dust: very small particles, mostly static with a slow drift.
  for(let i=0;i<scale(config.dust);i++){
    add('i','fx-dust',{
      '--x':`${r(0,100)}vw`,'--y':`${r(0,100)}vh`,
      '--dx':`${r(-12,12)}vw`,'--dy':`${r(-8,8)}vh`,
      '--delay':`${-r(0,18)}s`,'--dur':`${r(18,34)}s`,
      '--s':`${r(.55,1.55)}`,'--op':`${r(.18,.55)}`,
      '--tone':pick(['gold','emerald','ivory'])
    });
  }

  // 3) Broad light waves intentionally disabled: they created an oversized yellow wash over the UI.

  // 4) Distant lanterns: tiny far-away lights; never compete with the activity flame.
  for(let i=0;i<scale(config.lanterns);i++){
    const lamp=add('i','fx-lantern',{
      '--x':`${r(7,94)}vw`,'--y':`${r(10,84)}vh`,
      '--delay':`${-r(0,12)}s`,'--dur':`${r(6,11)}s`,
      '--s':`${r(.52,.82)}`,'--op':`${r(.22,.48)}`
    });
    lamp.append(document.createElement('b'));
  }

  // 5) Traveling stars: independent of all other layers.
  for(let i=0;i<scale(config.travel);i++){
    add('i','fx-travel-star',{
      '--x':`${r(-3,98)}vw`,'--y':`${r(-3,96)}vh`,
      '--dx':`${r(-14,18)}vw`,'--dy':`${r(-8,10)}vh`,
      '--delay':`${-r(0,22)}s`,'--dur':`${r(12,28)}s`,
      '--s':`${r(.65,1.25)}`,'--op':`${r(.20,.72)}`,
      '--tone':pick(['gold','emerald','ivory'])
    });
  }

  // Performance rules: hidden tab / reduced motion = pause the effect layer entirely.
  const pause = (on)=>host.classList.toggle('is-paused',on);
  document.addEventListener('visibilitychange',()=>pause(document.hidden));
  document.addEventListener('rafiq-motion',e=>pause(!e.detail));
  if(!motionOK) pause(true);

  // When the app already exposes a performance-tier change event, trim expensive layers without a reload.
  document.addEventListener('rafiq-performance-change',()=>{
    host.classList.remove('perf-lite','perf-balanced','perf-high');
    host.classList.add('perf-'+(document.body.dataset.perfTier||'balanced'));
  });
})();
