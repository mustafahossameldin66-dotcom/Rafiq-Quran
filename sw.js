const CACHE='rafiq-offline-v39';
const CORE=['./','./index.html','./css/app.css','./css/ambient-effects.css','./css/perfect-architecture.css','./css/ui-overrides.css','./css/memorization-core.css','./css/mobile.css','./js/tajweed-parser.js','./js/content-manager.js','./js/app.js','./js/settings.js','./js/ambient-effects.js','./js/mushaf-premium.js','./js/sw-register.js','./js/memorization-engine.js','./js/quran-index.js','./js/mobile-shell.js','./quran-uthmani.json','./daily-content.json','./content-manifest.json','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];

// Assets that are safe to serve from cache first. They are versioned through the ?v= query
// string in index.html, so a version bump produces a new cache key and fetches fresh bytes.
const STATIC_RE=/\.(?:css|js|json|png|jpg|jpeg|svg|webp|woff2?|webmanifest)$/i;

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(async c=>{for(const url of CORE){try{await c.add(url)}catch{}}}).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('rafiq-offline-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

// Exact match first so a ?v= bump is never answered with the previous build; the
// search-insensitive lookup only backs up un-versioned precache entries.
async function cacheLookup(req){
  const exact=await caches.match(req);
  if(exact)return exact;
  return caches.match(req,{ignoreSearch:true});
}

async function fromNetwork(req,init){
  const fresh=await fetch(req,init);
  if(fresh&&fresh.ok){
    const copy=fresh.clone();
    caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
  }
  return fresh;
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==location.origin)return;

  // HTML navigations stay network-first so a new build is picked up immediately.
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{const fresh=await fromNetwork(req,{cache:'no-store'});if(fresh&&fresh.ok)return fresh;}catch{}
      return (await cacheLookup(req))||(await caches.match('./index.html'))||new Response('',{status:503,statusText:'Offline'});
    })());
    return;
  }

  // Static assets are cache-first. This is what keeps the ~2.5 MB core (quran-uthmani.json
  // included) from being re-downloaded on every single launch.
  if(STATIC_RE.test(u.pathname)){
    event.respondWith((async()=>{
      const cached=await cacheLookup(req);
      if(cached){
        // Refresh in the background without blocking the response.
        event.waitUntil(fromNetwork(req).catch(()=>{}));
        return cached;
      }
      try{return await fromNetwork(req);}catch{}
      return new Response('',{status:503,statusText:'Offline'});
    })());
    return;
  }

  event.respondWith((async()=>{
    try{const fresh=await fromNetwork(req,{cache:'no-store'});if(fresh&&fresh.ok)return fresh;}catch{}
    return (await cacheLookup(req))||new Response('',{status:503,statusText:'Offline'});
  })());
});

// إشعار حقيقي وصل من سيرفر التذكيرات — بيظهر حتى لو التطبيق مقفول تمامًا.
self.addEventListener('push',event=>{
  let data={title:'رفيق القرآن ⏰',body:'حان وقت تذكيرك'};
  try{if(event.data)data={...data,...event.data.json()};}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'./assets/icon-192.png',
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
