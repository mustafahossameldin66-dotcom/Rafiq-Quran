const CACHE='rafiq-v97-release-candidate-v1';
const API_CACHE='rafiq-v97-api-v1';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./'])).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>![CACHE,API_CACHE].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    try{
      const res=await fetch(req);
      const copy=res.clone();
      const cache=await caches.open(CACHE);
      cache.put(req,copy).catch(()=>{});
      return res;
    }catch{
      return cached||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    }
  })());
});
