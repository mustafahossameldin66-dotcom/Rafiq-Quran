(() => {
  'use strict';
  const KEY='rafiq-quran-layout-index-v1';
  const CACHE='https://quran.wpdynamo.com/assets/quran';
  const mem=new Map();
  let indexPromise=null;
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}}
  function normalizeList(raw,unit){
    if(!raw)return [];
    const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.data)?raw.data:(Array.isArray(raw?.pages)?raw.pages:(Array.isArray(raw?.juz)?raw.juz:[])));
    return arr.map((x,i)=>{
      const n=Number(x?.page??x?.juz??x?.index??x?.id??i+1);
      const ayahs=Array.isArray(x?.ayahs)?x.ayahs:(Array.isArray(x?.verses)?x.verses:[]);
      const first=ayahs[0], last=ayahs[ayahs.length-1];
      const start=first?{s:Number(first.surah?.number??first.surah??first.s),a:Number(first.numberInSurah??first.a)}:x?.start;
      const end=last?{s:Number(last.surah?.number??last.surah??last.s),a:Number(last.numberInSurah??last.a)}:x?.end;
      return Number.isFinite(n)&&start&&end?{index:n,start,end,unit}:null;
    }).filter(Boolean);
  }
  async function fetchJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
  async function ensure(){
    const cached=read();
    if(cached?.pages?.length||cached?.juz?.length)return cached;
    if(indexPromise)return indexPromise;
    indexPromise=(async()=>{
      if(!navigator.onLine)return cached||{};
      const next={...(cached||{})};
      try{next.pages=normalizeList(await fetchJson(`${CACHE}/index_pages.json`),'page')}catch{}
      try{next.juz=normalizeList(await fetchJson(`${CACHE}/index_juz.json`),'juz')}catch{}
      if(next.pages?.length||next.juz?.length)write(next);
      return next;
    })();
    try{return await indexPromise}finally{indexPromise=null}
  }
  async function resolve(unit,index,amount=1){
    unit=String(unit);index=Math.max(1,Number(index)||1);amount=Math.max(1,Number(amount)||1);
    const cached=read()||{};
    const bucket=cached?.[unit];
    if(Array.isArray(bucket)){
      const first=bucket.find(x=>x.index===index);
      const last=bucket.find(x=>x.index===index+amount-1);
      if(first&&last)return{start:first.start,end:last.end,unit,index,amount};
    }
    await ensure();
    const after=read()||{};
    const b=after?.[unit];
    if(Array.isArray(b)){
      const first=b.find(x=>x.index===index),last=b.find(x=>x.index===index+amount-1);
      if(first&&last)return{start:first.start,end:last.end,unit,index,amount};
    }
    if((unit==='quarter'||unit==='juz')&&navigator.onLine){
      try{
        const url=`https://api.alquran.cloud/v1/${unit==='quarter'?'hizbQuarter':'juz'}/${index}/quran-uthmani`;
        const d=await fetchJson(url); const ayahs=d?.data?.ayahs||[];
        if(ayahs.length){const first=ayahs[0],last=ayahs[ayahs.length-1];const out={start:{s:first.surah.number,a:first.numberInSurah},end:{s:last.surah.number,a:last.numberInSurah},unit,index,amount};
          const all={...(after||{})};all[unit]=Array.isArray(all[unit])?all[unit]:[];
          all[unit]=all[unit].filter(x=>x.index!==index);all[unit].push(out);write(all);return out;
        }
      }catch{}
    }
    return null;
  }
  window.RAFIQ_QURAN_INDEX={ensure,resolve,read};
})();
