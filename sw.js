const CACHE='rafiq-offline-v3';
const CORE=['./','./index.html','./css/app.css','./css/ambient-effects.css','./css/perfect-architecture.css','./js/content-manager.js','./js/app.js','./js/settings.js','./js/ambient-effects.js','./js/mushaf-premium.js','./js/sw-register.js','./quran-uthmani.json','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async c=>{for(const url of CORE){try{await c.add(url)}catch{}}}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==location.origin)return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req,{cache:'no-store'});
      if(fresh.ok){const c=await caches.open(CACHE);c.put(req,fresh.clone()).catch(()=>{});return fresh;}
    }catch{}
    return (await caches.match(req))||new Response('',{status:503,statusText:'Offline'});
  })());
});
