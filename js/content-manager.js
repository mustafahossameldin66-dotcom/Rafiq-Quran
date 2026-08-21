(function(){
  'use strict';
  const BASE='https://api.quranpedia.net/v1';
  const QP_WEB='https://quranpedia.net';
  const DB_NAME='rafiq-content-v4';
  const DB_VERSION=1;
  const STORE='entries';
  const BOOKS={
    2012:{name:'التفسير الميسر',kind:'tafsir',dump:'https://quranpedia.net/dumps/tafsir-book-2012.json.gz'},
    2013:{name:'معاني الكلمات من كتاب السراج في بيان غريب القرآن',kind:'meanings',dump:'https://quranpedia.net/dumps/tafsir-book-2013.json.gz'},
    2919:{name:'أسباب نزول القرآن - الواحدي',kind:'asbab',dump:'https://quranpedia.net/dumps/asbab-book-2919.json.gz'}
  };
  const mem=new Map();
  let dbPromise=null;
  let dumpPromises={};
  let objectUrlSet=new Set();
  const refreshPromises=new Map();
  const BOOK_REFRESH_MS=24*60*60*1000;
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,DB_VERSION);
      r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    return dbPromise;
  }
  async function get(key){
    if(mem.has(key))return mem.get(key);
    try{const db=await openDb();const value=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const q=tx.objectStore(STORE).get(key);q.onsuccess=()=>res(q.result??null);q.onerror=()=>rej(q.error)});if(value!==null)mem.set(key,value);return value}catch{return null}
  }
  async function put(key,value){
    mem.set(key,value);try{const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');const q=tx.objectStore(STORE).put(value,key);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)});return true}catch{return false}}
  async function del(key){mem.delete(key);try{const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');const q=tx.objectStore(STORE).delete(key);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}catch{}}
  function timeoutSignal(ms=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return {signal:c.signal,done:()=>clearTimeout(t)};}
  async function fetchJson(url,ms=12000){const x=timeoutSignal(ms);try{const r=await fetch(url,{cache:'no-store',signal:x.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{x.done()}}
  function bookDef(book){return BOOKS[Number(book)]||null}
  function cacheKey(s,a,book){return `qp-book:${book}:${s}:${a}`}
  function normalizeContent(payload,s,a,book){
    if(!payload)return null;
    const content=Array.isArray(payload.content)?payload.content:payload.content?[payload.content]:[];
    const text=content.map(x=>String(x?.text??x?.content??x?.value??'').trim()).filter(Boolean).join('\n\n').trim();
    if(!text && typeof payload.text==='string')return {text:payload.text.trim(),book:payload.book||bookDef(book),source:`Quranpedia · كتاب ${book}`,fetchedAt:Date.now()};
    if(!text)return null;
    return {text,content,book:payload.book||bookDef(book),source:'Quranpedia',ref:`${s}:${a}`,fetchedAt:Date.now()};
  }
  async function fetchBookFresh(s,a,book){
    const key=cacheKey(s,a,book);
    if(!navigator.onLine)return null;
    try{
      const payload=await fetchJson(`${BASE}/ayah/${s}/${a}/book/${book}`);
      const data=normalizeContent(payload,s,a,book);
      if(data){await put(key,data);return {...data,offline:false,stale:false}}
    }catch{}
    try{
      const dumpData=await getFromDump(s,a,book);
      if(dumpData?.text){await put(key,dumpData);return {...dumpData,offline:false,stale:false}}
    }catch{}
    return null;
  }
  function refreshBookInBackground(s,a,book){
    const key=cacheKey(s,a,book);
    if(refreshPromises.has(key))return refreshPromises.get(key);
    const promise=fetchBookFresh(s,a,book).catch(()=>null).finally(()=>refreshPromises.delete(key));
    refreshPromises.set(key,promise);
    return promise;
  }
  async function getBookContent(s,a,book,{force=false}={}){
    s=Number(s);a=Number(a);book=Number(book);const key=cacheKey(s,a,book);
    if(!force){
      const cached=await get(key);
      if(cached?.text){
        const age=Date.now()-Number(cached.fetchedAt||0);
        const stale=navigator.onLine && age>BOOK_REFRESH_MS;
        if(stale)refreshBookInBackground(s,a,book);
        return {...cached,offline:!navigator.onLine,stale};
      }
    }
    const fresh=await fetchBookFresh(s,a,book);
    if(fresh)return fresh;
    try{
      const dumpData=await getFromDump(s,a,book);
      if(dumpData?.text)return {...dumpData,offline:true,stale:false};
    }catch{}
    return null;
  }
  async function getAyahOptions(s,a){
    const key=`qp-options:${s}:${a}`;const cached=await get(key);if(cached)return cached;
    if(!navigator.onLine)return null;
    try{const data=await fetchJson(`${BASE}/ayah/${Number(s)}/${Number(a)}/options`);await put(key,data);return data}catch{return null}
  }
  function parseDumpValue(value,s,a,book){
    if(!value)return null;
    if(value.text && typeof value.text==='string')return {text:value.text,book:value.book||bookDef(book),source:'Quranpedia · official dump',ref:`${s}:${a}`,fetchedAt:Date.now()};
    if(Array.isArray(value)){
      const texts=value.map(v=>String(v?.text??v?.content??'').trim()).filter(Boolean);
      if(texts.length)return {text:texts.join('\n\n'),content:value,book:bookDef(book),source:'Quranpedia · official dump',ref:`${s}:${a}`,fetchedAt:Date.now()};
    }
    if(value.content && Array.isArray(value.content))return normalizeContent(value,s,a,book);
    return null;
  }
  async function inflateGzip(buffer){
    if(typeof DecompressionStream==='undefined')throw new Error('Gzip decompression unsupported');
    const ds=new DecompressionStream('gzip');
    const stream=new Blob([buffer]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }
  async function downloadDump(book,{force=false,onProgress}={}){
    const def=bookDef(book);if(!def)throw new Error('Unknown book');
    const key=`qp-dump:${book}`;
    if(!force){const cached=await get(key);if(cached?.json)return cached}
    if(!navigator.onLine)throw new Error('offline');
    if(dumpPromises[book])return dumpPromises[book];
    dumpPromises[book]=(async()=>{
      const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),60000);
      try{
        const r=await fetch(def.dump,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);
        const total=Number(r.headers.get('content-length')||0);let buffer;
        if(r.body&&r.body.getReader){const reader=r.body.getReader();const chunks=[];let loaded=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;if(onProgress)onProgress(total?Math.round(loaded/total*100):null,loaded,total)}const merged=new Uint8Array(chunks.reduce((n,c)=>n+c.byteLength,0));let off=0;for(const c of chunks){merged.set(c,off);off+=c.byteLength}buffer=merged.buffer}else buffer=await r.arrayBuffer();
        const jsonText=await inflateGzip(buffer);const json=JSON.parse(jsonText);const entry={json,version:'2026-08-20',downloadedAt:Date.now(),book:def};await put(key,entry);mem.set(key,entry);return entry;
      }finally{clearTimeout(timer);delete dumpPromises[book]}
    })();
    return dumpPromises[book];
  }
  let parsedDumpIndex={};
  function indexDump(book,json){
    const index=new Map();
    const add=(s,a,value)=>{if(Number.isFinite(Number(s))&&Number.isFinite(Number(a))){const parsed=parseDumpValue(value,s,a,book);if(parsed)index.set(`${Number(s)}:${Number(a)}`,parsed)}};
    const walk=(node,path=[],depth=0)=>{
      if(depth>4||node==null)return;
      if(Array.isArray(node)){node.forEach(v=>walk(v,path,depth+1));return}
      if(typeof node!=='object')return;
      const s=node.s??node.surah??node.surah_id??node.surahNumber;
      const a=node.a??node.ayah??node.ayah_number??node.number_in_ayah;
      if(s!==undefined&&a!==undefined&&((node.text&&typeof node.text==='string')||node.content))add(s,a,node);
      for(const [k,v] of Object.entries(node)){
        if(/^\d{1,3}:\d{1,3}$/.test(k)){const [ks,ka]=k.split(':').map(Number);add(ks,ka,v)}
        else if(depth<4)walk(v,path.concat(k),depth+1);
      }
    };
    walk(json);
    parsedDumpIndex[book]=index;
    return index;
  }
  async function getDumpIndex(book){
    if(parsedDumpIndex[book])return parsedDumpIndex[book];
    const entry=await get(`qp-dump:${book}`);if(!entry?.json)return null;return indexDump(book,entry.json)
  }
  async function getFromDump(s,a,book){const idx=await getDumpIndex(book);return idx?.get(`${Number(s)}:${Number(a)}`)||null}
  async function preloadStudyPacks({onProgress}={}){
    const ids=[2012,2013,2919];let done=0;const errors=[];
    for(const id of ids){try{await downloadDump(id,{onProgress:(pct)=>onProgress?.({book:id,done,total:ids.length,pct})});done++;onProgress?.({book:id,done,total:ids.length,pct:100})}catch(e){errors.push({book:id,error:String(e?.message||e)})}}
    return {ok:errors.length===0,done,total:ids.length,errors,version:'2026-08-20'};
  }
  async function studyPackStatus(){const out={};for(const id of Object.keys(BOOKS)){const x=await get(`qp-dump:${id}`);out[id]=!!x?.json}return out}
  async function saveAudio(url){
    if(!url)return false;
    try{const cache=await caches.open('rafiq-audio-v1');const existing=await cache.match(url);if(existing)return true;const r=await fetch(url,{mode:'cors',cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);await cache.put(url,r.clone());return true}catch{return false}
  }
  async function hasAudio(url){try{const c=await caches.open('rafiq-audio-v1');return !!(await c.match(url))}catch{return false}}
  async function getPlayableAudio(url){if(!url)return url;try{const c=await caches.open('rafiq-audio-v1');const r=await c.match(url);if(!r)return url;const blob=await r.blob();const objectUrl=URL.createObjectURL(blob);objectUrlSet.add(objectUrl);return objectUrl}catch{return url}}
  function revokeAudioUrl(url){if(objectUrlSet.has(url)){URL.revokeObjectURL(url);objectUrlSet.delete(url)}}
  async function clearAudioCache(){try{const ok=await caches.delete('rafiq-audio-v1');return ok}catch{return false}}
  window.RAFIQ_CONTENT={
    BOOKS,QP_BASE:BASE,QP_WEB,
    getBookContent,getAyahOptions,preloadStudyPacks,studyPackStatus,downloadDump,
    saveAudio,hasAudio,getPlayableAudio,revokeAudioUrl,clearAudioCache
  };
})();
