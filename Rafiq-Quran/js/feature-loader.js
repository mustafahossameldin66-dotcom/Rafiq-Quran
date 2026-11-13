(() => {
  'use strict';
  const files={
    bookmarks:'js/quran-bookmarks.js',
    quickTafsir:'js/quick-tafsir.js',
    adhkar:'js/quran-adhkar.js',
    khatmah:'js/quran-khatmah.js',
    challenges:'js/quran-challenges.js',
    modes:'js/quran-modes.js'
  };
  const views={
    quran:['bookmarks','quickTafsir','modes'],
    adhkar:['adhkar'],
    khatmah:['khatmah']
  };
  const loaded=new Set(), failed=new Set(), pending=new Map();
  function load(name){
    if(loaded.has(name)||failed.has(name)) return Promise.resolve();
    if(pending.has(name)) return pending.get(name);
    const src=files[name];
    if(!src) return Promise.resolve();
    const task=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=()=>{loaded.add(name);pending.delete(name);resolve();};
      script.onerror=()=>{failed.add(name);pending.delete(name);reject(new Error(`Unable to load ${name}`));};
      document.head.appendChild(script);
    });
    pending.set(name,task);return task;
  }
  function viewFeatures(view){return views[view]||[]}
  window.RAFIQ_FEATURES={
    needsView:view=>viewFeatures(view).some(name=>!loaded.has(name)&&!failed.has(name)),
    loadForView:view=>Promise.all(viewFeatures(view).map(load)),
    load
  };
  const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,1200));
  idle(()=>Promise.all(['bookmarks','khatmah','challenges'].map(load)).catch(()=>{}),{timeout:1800});
})();
