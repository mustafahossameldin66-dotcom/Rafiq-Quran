(()=>{
  'use strict';
  const BASE='https://api.quran.com/api/v4/quran/verses/uthmani_tajweed';
  const DB='rafiq-official-tajweed-v1';
  let warmPromise=null;
  const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('verses'))db.createObjectStore('verses')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  async function get(k){try{const db=await openDb();return await new Promise(res=>{const t=db.transaction('verses','readonly');const q=t.objectStore('verses').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch{return null}}
  async function put(k,v){try{const db=await openDb();await new Promise((res,rej)=>{const t=db.transaction('verses','readwrite');const q=t.objectStore('verses').put(v,k);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}catch{}}
  const k=(s,a)=>`${Number(s)}:${Number(a)}`;
  async function fetchOne(s,a){
    const key=k(s,a), cached=await get(key);
    try{
      const r=await fetch(`${BASE}?verse_key=${encodeURIComponent(key)}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json(), v=j?.verses?.[0];
      if(!v?.text_uthmani_tajweed)throw new Error('no tajweed text');
      const data={verse_key:v.verse_key||key,text_uthmani_tajweed:v.text_uthmani_tajweed,source:'Quran Foundation / Quran.com API',at:Date.now()};
      await put(key,data);return data;
    }catch{return cached||null}
  }
  async function warmAll(){
    if(warmPromise)return warmPromise;
    warmPromise=(async()=>{
      try{const r=await fetch(BASE,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();const rows=Array.isArray(j?.verses)?j.verses:[];if(!rows.length)throw new Error('empty');for(const v of rows){if(v?.verse_key&&v?.text_uthmani_tajweed)await put(v.verse_key,{verse_key:v.verse_key,text_uthmani_tajweed:v.text_uthmani_tajweed,source:'Quran Foundation / Quran.com API',at:Date.now()})}return rows.length;}catch{return 0}
    })();
    const n=await warmPromise;warmPromise=null;return n;
  }
  const names={
    ghunnah:'غنة',idgham_ghunnah:'إدغام بغنة',idgham_wo_ghunnah:'إدغام بغير غنة',idghaam_ghunnah:'إدغام بغنة',idghaam_no_ghunnah:'إدغام بغير غنة',
    ikhfa:'إخفاء حقيقي',ikhfa_shafawi:'إخفاء شفوي',iqlab:'إقلاب',qalqalah:'قلقلة',ham_wasl:'همزة وصل',hamzat_wasl:'همزة وصل',
    laam_shamsiyah:'لام شمسية',lam_shamsiyah:'لام شمسية',silent:'حرف صامت',
    madda_normal:'مد طبيعي',madda_permissible:'مد جائز منفصل',madda_obligatory:'مد واجب متصل',madda_necessary:'مد لازم',
    idgham_shafawi:'إدغام شفوي',idghaam_shafawi:'إدغام شفوي',idgham_mutajanisayn:'إدغام متجانسين',idghaam_mutajaanisain:'إدغام متجانسين',idgham_mutaqaribayn:'إدغام متقاربين',idghaam_mutaqaaribain:'إدغام متقاربين',
    madd_2:'مد طبيعي',madd_246:'مد عارض للسكون/مد لين',madd_muttasil:'مد واجب متصل',madd_munfasil:'مد جائز منفصل',madd_6:'مد لازم'
  };
  function ruleName(c){return names[c]||String(c||'').replace(/_/g,' ')}
  function safeRender(markup){
    const host=document.createElement('div');host.innerHTML=String(markup||'');
    const walk=node=>{
      if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue||'');
      if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
      const tag=node.tagName.toLowerCase();
      if(tag!=='tajweed'){
        const frag=document.createDocumentFragment();for(const c of node.childNodes)frag.appendChild(walk(c));return frag;
      }
      const span=document.createElement('span'), cls=(node.getAttribute('class')||'').replace(/[^a-z0-9_-]/gi,'');
      span.className='official-tajweed taj-'+cls;span.dataset.rule=cls;span.title=ruleName(cls);
      for(const c of node.childNodes)span.appendChild(walk(c));return span;
    };
    const frag=document.createDocumentFragment();for(const c of host.childNodes)frag.appendChild(walk(c));return frag;
  }
  window.RAFIQ_TAJWEED={fetchOne,warmAll,ruleName,safeRender,sourceUrl:'https://api-docs.quran.com/docs/content_apis_versioned/4.0.0/quran-verses-by-script/'};
  if(navigator.onLine)setTimeout(()=>warmAll(),1500);
})();
