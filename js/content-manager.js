(function(){
  'use strict';
  const BASE='https://api.quranpedia.net/v1';
  const QP_WEB='https://quranpedia.net';
  const DB_NAME='rafiq-content-v8';
  const DB_VERSION=7;
  const STORE='entries';
  const CONTENT_VERSION='2026-08-19';
  const TAJWEED_VERSION='qf-uthmani-tajweed-4.0.0';
  const TAJWEED_PRIMARY='https://api.quran.com/api/v4/quran/verses/uthmani_tajweed';
  const TAJWEED_FALLBACK='https://api.alquran.cloud/v1/quran/quran-tajweed';
  const BOOKS={
    2012:{id:32,name:'التفسير الميسر',kind:'tafsir',dump:'https://quranpedia.net/dumps/tafsir-book-32.json.gz'},
    2013:{name:'معاني الكلمات من كتاب السراج في بيان غريب القرآن',kind:'meanings',dump:'https://quranpedia.net/dumps/tafsir-book-2013.json.gz'},
    2919:{name:'أسباب نزول القرآن - الواحدي',kind:'asbab',dump:'https://quranpedia.net/dumps/asbab-book-2919.json.gz'}
  };
  const mem=new Map();
  const dumpPromises=new Map();
  const bookFetchPromises=new Map();
  const refreshPromises=new Map();
  const objectUrlSet=new Set();
  const tajweedAyahPromises=new Map();
  let tajweedPromise=null;
  let dbPromise=null;
  const parsedDumpIndex=new Map();
  const BOOK_REFRESH_MS=24*60*60*1000;

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,DB_VERSION);
      r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
      r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
    });
    return dbPromise;
  }
  async function get(key){
    if(mem.has(key))return mem.get(key);
    try{
      const db=await openDb();
      const value=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const q=tx.objectStore(STORE).get(key);q.onsuccess=()=>res(q.result??null);q.onerror=()=>rej(q.error)});
      if(value!==null)mem.set(key,value);
      return value;
    }catch{return null}
  }
  async function put(key,value){
    mem.set(key,value);
    try{
      const db=await openDb();
      await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');const q=tx.objectStore(STORE).put(value,key);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)});
      return true;
    }catch{return false}
  }
  function timeoutSignal(ms=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return {signal:c.signal,done:()=>clearTimeout(t)}}
  async function fetchJson(url,ms=12000){const x=timeoutSignal(ms);try{const r=await fetch(url,{cache:'no-store',signal:x.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{x.done()}}
  function bookDef(book){return BOOKS[Number(book)]||null}
  function cacheKey(s,a,book){return `qp-book:${Number(book)}:${Number(s)}:${Number(a)}`}
  function normalizeContent(payload,s,a,book){
    if(!payload)return null;
    const content=Array.isArray(payload.content)?payload.content:(payload.content?[payload.content]:[]);
    const text=content.map(x=>String(x?.text??x?.content??x?.value??'').trim()).filter(Boolean).join('\n\n').trim();
    if(!text && typeof payload.text==='string')return {text:payload.text.trim(),book:payload.book||bookDef(book),source:`Quranpedia · ${bookDef(book)?.name||'كتاب'}`,ref:`${s}:${a}`,fetchedAt:Date.now()};
    if(!text)return null;
    return {text,content,book:payload.book||bookDef(book),source:'Quranpedia',ref:`${s}:${a}`,fetchedAt:Date.now()};
  }
  function parseDumpValue(value,s,a,book){
    if(!value)return null;
    if(value.text&&typeof value.text==='string')return {text:value.text,book:value.book||bookDef(book),source:'Quranpedia · official dump',ref:`${s}:${a}`,fetchedAt:Date.now()};
    if(Array.isArray(value)){const texts=value.map(v=>String(v?.text??v?.content??'').trim()).filter(Boolean);if(texts.length)return {text:texts.join('\n\n'),content:value,book:bookDef(book),source:'Quranpedia · official dump',ref:`${s}:${a}`,fetchedAt:Date.now()};}
    if(value.content&&Array.isArray(value.content))return normalizeContent(value,s,a,book);
    return null;
  }
  function indexDump(book,json){
    const index={};
    const add=(s,a,v)=>{const ss=Number(s),aa=Number(a);if(!Number.isFinite(ss)||!Number.isFinite(aa))return;const parsed=parseDumpValue(v,ss,aa,book);if(parsed)index[`${ss}:${aa}`]=parsed};
    const walk=(node,depth=0)=>{
      if(depth>6||node==null)return;
      if(Array.isArray(node)){for(const v of node)walk(v,depth+1);return;}
      if(typeof node!=='object')return;
      const s=node.s??node.surah??node.surah_id??node.surahNumber;
      const a=node.a??node.ayah??node.ayah_number??node.number_in_ayah;
      if(s!==undefined&&a!==undefined&&((typeof node.text==='string')||node.content))add(s,a,node);
      for(const [k,v] of Object.entries(node)){
        if(/^\d{1,3}:\d{1,3}$/.test(k)){const [ks,ka]=k.split(':').map(Number);add(ks,ka,v)}
        else if(depth<5)walk(v,depth+1);
      }
    };
    walk(json); parsedDumpIndex.set(Number(book),index); return index;
  }
  async function getFromDump(s,a,book){
    const b=Number(book); let index=parsedDumpIndex.get(b);
    if(!index){const entry=await get(`qp-dump-v2:${b}`);if(!entry?.index)return null;index=entry.index;parsedDumpIndex.set(b,index)}
    return index?.[`${Number(s)}:${Number(a)}`]||null;
  }
  async function fetchBookFresh(s,a,book){
    s=Number(s);a=Number(a);book=Number(book);const key=cacheKey(s,a,book);
    if(!navigator.onLine)return null;
    if(bookFetchPromises.has(key))return bookFetchPromises.get(key);
    const p=(async()=>{
      try{const apiBook=bookDef(book)?.id||book;const data=normalizeContent(await fetchJson(`${BASE}/ayah/${s}/${a}/book/${apiBook}`,7000),s,a,book);if(data){await put(key,data);return {...data,offline:false,stale:false};}}catch{}
      return null;
    })().finally(()=>bookFetchPromises.delete(key));
    bookFetchPromises.set(key,p);return p;
  }
  function refreshBookInBackground(s,a,book){
    const key=cacheKey(s,a,book);if(refreshPromises.has(key))return refreshPromises.get(key);
    const p=fetchBookFresh(s,a,book).catch(()=>null).finally(()=>refreshPromises.delete(key));refreshPromises.set(key,p);return p;
  }
  async function getBookContent(s,a,book,{force=false}={}){
    s=Number(s);a=Number(a);book=Number(book);const key=cacheKey(s,a,book);
    if(!force){
      const cached=await get(key);
      if(cached?.text){const age=Date.now()-Number(cached.fetchedAt||0);const stale=navigator.onLine&&age>BOOK_REFRESH_MS;if(stale)refreshBookInBackground(s,a,book);return {...cached,offline:!navigator.onLine,stale};}
    }
    const dump=await getFromDump(s,a,book);if(dump?.text)return {...dump,offline:!navigator.onLine,stale:false};
    const fresh=await fetchBookFresh(s,a,book);if(fresh)return fresh;
    return null;
  }
  async function inflateGzip(buffer){
    if(typeof DecompressionStream==='undefined')throw new Error('Gzip decompression unsupported');
    const ds=new DecompressionStream('gzip');
    return await new Response(new Blob([buffer]).stream().pipeThrough(ds)).text();
  }
  async function downloadDump(book,{force=false,onProgress}={}){
    const b=Number(book),def=bookDef(b),key=`qp-dump-v2:${b}`;if(!def)throw new Error('Unknown book');
    if(!force){const cached=await get(key);if(cached?.json&&cached?.index)return cached;}
    if(!navigator.onLine)throw new Error('offline');
    if(dumpPromises.has(b))return dumpPromises.get(b);
    const p=(async()=>{
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),60000);
      try{
        const r=await fetch(def.dump,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);
        let buffer,total=Number(r.headers.get('content-length')||0);
        if(r.body?.getReader){const reader=r.body.getReader(),chunks=[];let loaded=0;for(;;){const x=await reader.read();if(x.done)break;chunks.push(x.value);loaded+=x.value.byteLength;onProgress?.(total?Math.round(loaded/total*100):null,loaded,total)}const merged=new Uint8Array(chunks.reduce((n,c)=>n+c.byteLength,0));let off=0;for(const c of chunks){merged.set(c,off);off+=c.byteLength}buffer=merged.buffer;}else buffer=await r.arrayBuffer();
        const json=JSON.parse(await inflateGzip(buffer));const index=indexDump(b,json);const entry={json,index,version:CONTENT_VERSION,downloadedAt:Date.now(),book:def};await put(key,entry);return entry;
      }finally{clearTimeout(timer)}
    })().finally(()=>dumpPromises.delete(b));
    dumpPromises.set(b,p);return p;
  }
  async function preloadStudyPacks({onProgress}={}){
    const ids=[2012,2013,2919];let done=0;const errors=[];
    await Promise.all(ids.map(id=>downloadDump(id,{onProgress:(pct,loaded,total)=>onProgress?.({book:id,pct,loaded,total,done,totalBooks:ids.length})}).then(()=>{done++;onProgress?.({book:id,pct:100,done,total:ids.length})}).catch(error=>errors.push({book:id,error:String(error?.message||error)}))));
    return {ok:errors.length===0,done,total:ids.length,errors,version:CONTENT_VERSION};
  }
  async function studyPackStatus(){const out={};for(const id of Object.keys(BOOKS)){const x=await get(`qp-dump-v2:${id}`);out[id]=!!x?.json&&!!x?.index}return out}

  function normalizeTajweedEntries(payload){
    const out={};
    for(const v of (Array.isArray(payload?.verses)?payload.verses:[])){const key=String(v?.verse_key||'');const html=String(v?.text_uthmani_tajweed||v?.text||'').trim();if(/^\d+:\d+$/.test(key)&&html)out[key]={html,source:'Quran Foundation · Uthmani Tajweed',version:TAJWEED_VERSION,fetchedAt:Date.now()};}
    for(const v of (Array.isArray(payload?.data?.ayahs)?payload.data.ayahs:[])){const s=Number(v?.surah?.number),a=Number(v?.numberInSurah),html=String(v?.text||'').trim();if(s&&a&&html)out[`${s}:${a}`]={html,source:'Al Quran Cloud · tajweed',version:'alquran-cloud-tajweed',fetchedAt:Date.now()};}
    return out;
  }
  async function ensureTajweedPack({force=false,onProgress}={}){
    if(!force){const cached=await get('tajweed-pack-v1');if(cached?.entries&&Object.keys(cached.entries).length>=6000)return cached;}
    if(!navigator.onLine)throw new Error('offline');
    if(tajweedPromise&&!force)return tajweedPromise;
    tajweedPromise=(async()=>{
      const entries=normalizeTajweedEntries(await fetchJson(TAJWEED_FALLBACK,45000));
      if(Object.keys(entries).length<6000)throw new Error('tajweed-pack-incomplete');
      const pack={entries,source:'Al Quran Cloud · quran-tajweed',version:'alquran-cloud-tajweed',downloadedAt:Date.now()};
      await put('tajweed-pack-v1',pack);onProgress?.(100);return pack;
    })().finally(()=>tajweedPromise=null);
    return tajweedPromise;
  }
  async function getTajweed(s,a){
    const sn=Number(s),an=Number(a),key=`${sn}:${an}`;
    const pack=await get('tajweed-pack-v1');if(pack?.entries?.[key])return pack.entries[key];
    const cached=await get(`taj:${key}`);if(cached?.html)return cached;
    const surahCacheKey=`taj-surah:${sn}`;
    const surahCached=await get(surahCacheKey);
    if(surahCached?.entries?.[key]){await put(`taj:${key}`,surahCached.entries[key]);return surahCached.entries[key];}
    if(!navigator.onLine)return null;
    if(tajweedAyahPromises.has(key))return tajweedAyahPromises.get(key);
    const p=(async()=>{
      try{
        const j=await fetchJson(`https://api.alquran.cloud/v1/surah/${sn}/quran-tajweed`,10000);
        const entries=normalizeTajweedEntries(j);
        if(entries[key]){
          await put(surahCacheKey,{entries,source:'Al Quran Cloud · quran-tajweed',version:'alquran-cloud-tajweed',downloadedAt:Date.now()});
          await put(`taj:${key}`,entries[key]);
          return entries[key];
        }
      }catch{}
      try{
        const j=await fetchJson(`https://api.alquran.cloud/v1/ayah/${encodeURIComponent(key)}/quran-tajweed`,10000);
        const entries=normalizeTajweedEntries(j);
        if(entries[key]){await put(`taj:${key}`,entries[key]);return entries[key];}
      }catch{}
      return null;
    })().finally(()=>tajweedAyahPromises.delete(key));
    tajweedAyahPromises.set(key,p);return p;
  }
  async function tajweedStatus(){const p=await get('tajweed-pack-v1');return !!(p?.entries&&Object.keys(p.entries).length>=6000)}
  async function ensureOfflineCore({force=false,onProgress}={}){
    const [study,taj]=await Promise.allSettled([
      preloadStudyPacks({onProgress}),
      ensureTajweedPack({force,onProgress:()=>onProgress?.({tajweed:100})})
    ]);
    const studyResult=study.status==='fulfilled'?study.value:{ok:false,done:0,total:3,errors:[String(study.reason||'failed')]};
    return {study:studyResult,tajweed:taj.status==='fulfilled',ready:Boolean(studyResult.ok&&taj.status==='fulfilled')};
  }
  async function offlineStatus(){return {quran:true,study:await studyPackStatus(),tajweed:await tajweedStatus()}}
  async function getAyahOptions(s,a){const key=`qp-options:${Number(s)}:${Number(a)}`,cached=await get(key);if(cached)return cached;if(!navigator.onLine)return null;try{const d=await fetchJson(`${BASE}/ayah/${Number(s)}/${Number(a)}/options`,9000);await put(key,d);return d}catch{return null}}
  async function saveAudio(url){if(!url)return false;try{const c=await caches.open('rafiq-audio-v1');if(await c.match(url))return true;const r=await fetch(url,{mode:'cors',cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);await c.put(url,r.clone());return true}catch{return false}}
  async function hasAudio(url){try{const c=await caches.open('rafiq-audio-v1');return !!(await c.match(url))}catch{return false}}
  async function getPlayableAudio(url){if(!url)return url;try{const c=await caches.open('rafiq-audio-v1');const r=await c.match(url);if(!r)return url;const u=URL.createObjectURL(await r.blob());objectUrlSet.add(u);return u}catch{return url}}
  function revokeAudioUrl(url){if(objectUrlSet.has(url)){URL.revokeObjectURL(url);objectUrlSet.delete(url)}}
  async function clearAudioCache(){try{return await caches.delete('rafiq-audio-v1')}catch{return false}}
  async function getCacheValue(key){return get(key)}
  async function putCacheValue(key,value){return put(key,value)}
  window.RAFIQ_CONTENT={BOOKS,QP_BASE:BASE,QP_WEB,getBookContent,getAyahOptions,downloadDump,preloadStudyPacks,studyPackStatus,ensureTajweedPack,getTajweed,tajweedStatus,ensureOfflineCore,offlineStatus,getCacheValue,putCacheValue,saveAudio,hasAudio,getPlayableAudio,revokeAudioUrl,clearAudioCache,CONTENT_VERSION,TAJWEED_VERSION};
})();
