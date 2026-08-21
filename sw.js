const CACHE='rafiq-v98-stable-final-2';
const CORE=[
  './', './index.html', './manifest.webmanifest', './quran-uthmani.json',
  './css/app.css','./css/ambient-effects.css',
  './js/app.js','./js/settings.js','./js/sw-register.js','./js/ambient-effects.js','./js/study-modal.js','./js/mushaf-premium.js',
  './icon.svg','./icon-192.png','./icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  event.respondWith(
    caches.match(req).then(cached=>{
      const network=fetch(req).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}return res}).catch(()=>null);
      return cached||network||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    })
  );
});
