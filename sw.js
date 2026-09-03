const CACHE='rafiq-offline-v30';
const CORE=['./','./index.html','./css/app.css','./css/ambient-effects.css','./css/perfect-architecture.css','./css/ui-overrides.css','./css/memorization-core.css','./css/mobile.css','./js/tajweed-parser.js','./js/content-manager.js','./js/app.js','./js/settings.js','./js/ambient-effects.js','./js/mushaf-premium.js','./js/sw-register.js','./js/memorization-engine.js','./js/quran-index.js','./js/mobile-shell.js','./quran-uthmani.json','./daily-content.json','./content-manifest.json','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async c=>{for(const url of CORE){try{await c.add(url)}catch{}}}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rafiq-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
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
    return (await caches.match(req,{ignoreSearch:true}))||new Response('',{status:503,statusText:'Offline'});
  })());
});

// إشعار حقيقي وصل من سيرفر التذكيرات — بيظهر حتى لو التطبيق مقفول تمامًا.
self.addEventListener('push',event=>{
  let data={title:'رفيق القرآن ⏰',body:'حان وقت تذكيرك'};
  try{if(event.data)data={...data,...event.data.json()};}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'./assets/icon-192.png',
    badge:'./assets/icon-192.png',
    tag:'rafiq-push-'+data.body,
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const allClients=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of allClients){if('focus' in c)return c.focus();}
    if(clients.openWindow)return clients.openWindow('./');
  })());
});
