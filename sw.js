const CACHE='rafiq-offline-v4';
const CORE=['./','./index.html','./css/app.css','./css/ambient-effects.css','./js/app.js','./js/quran-data.js','./js/settings.js','./js/ambient-effects.js','./js/mushaf-premium.js','./js/sw-register.js','./quran-uthmani.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;e.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(res=>{if(res.ok)caches.open(CACHE).then(c=>c.put(r,res.clone())).catch(()=>{});return res}).catch(()=>cached||new Response('',{status:503}))));});
