const CACHE='rafiq-offline-714c733444';
const CORE=['./','./index.html','./css/app.css','./css/ambient-effects.css','./css/perfect-architecture.css','./css/ui-overrides.css','./css/memorization-core.css','./css/mobile.css','./js/tajweed-parser.js','./js/content-manager.js','./js/app.js','./js/settings.js','./js/ambient-effects.js','./js/mushaf-premium.js','./js/sw-register.js','./js/memorization-engine.js','./js/quran-index.js','./js/mobile-shell.js','./quran-uthmani.json','./daily-content.json','./content-manifest.json','./manifest.webmanifest','./assets/icon-192-maskable.png','./assets/icon-512-maskable.png','./assets/icon-192.png','./assets/icon-512.png'];
// Icons are nice-to-have; everything else must be cached or the install fails and is retried,
// so an "installed" offline app never silently misses its own code.
const OPTIONAL=['./assets/icon-192-maskable.png','./assets/icon-512-maskable.png','./assets/icon-192.png','./assets/icon-512.png','./daily-content.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async c=>{
  const results=await Promise.allSettled(CORE.map(url=>c.add(new Request(url,{cache:'reload'}))));
  const failed=CORE.filter((url,i)=>results[i].status==='rejected'&&!OPTIONAL.includes(url));
  if(failed.length)throw new Error('rafiq precache failed: '+failed.join(', '));
}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rafiq-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  // Google Fonts (CSS + font files): serve from cache instantly, refresh in the background, so the
  // Quran text keeps its font offline after the first online visit. Kept in a separate cache so it
  // survives app-version bumps (the activate step only deletes `rafiq-offline-*`).
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
    event.respondWith((async()=>{
      const c=await caches.open('rafiq-fonts-v1');
      const cached=await c.match(req);
      const refresh=fetch(req).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(req,res.clone()).catch(()=>{});return res}).catch(()=>null);
      if(cached){event.waitUntil(refresh);return cached}
      return (await refresh)||new Response('',{status:503,statusText:'Offline'});
    })());
    return;
  }
  if(u.origin!==location.origin)return;

  // Files loaded with a "?v=..." cache-busting query string get a brand-new URL every time
  // their content actually changes (the version string is bumped in index.html), so a cache
  // hit for the exact request URL is always safe and correct - no need to re-fetch every load.
  if(u.search.includes('v=')){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      if(cached)return cached;
      try{
        const fresh=await fetch(req);
        if(fresh.ok){const c=await caches.open(CACHE);c.put(req,fresh.clone()).catch(()=>{});}
        return fresh;
      }catch{
        return (await caches.match(req,{ignoreSearch:true}))||new Response('',{status:503,statusText:'Offline'});
      }
    })());
    return;
  }

  // The bundled Quran text is large and effectively static: answer instantly from cache when
  // available, and refresh the cache in the background so the next load stays current.
  if(u.pathname.endsWith('/quran-uthmani.json')){
    event.respondWith((async()=>{
      const cached=await caches.match(req,{ignoreSearch:true});
      const refresh=(async()=>{try{const fresh=await fetch(req,{cache:'no-cache'});if(fresh.status===200){const c=await caches.open(CACHE);c.put(req,fresh.clone()).catch(()=>{});}return fresh;}catch{return null}})();
      return cached||(await refresh)||new Response('',{status:503,statusText:'Offline'});
    })());
    return;
  }

  // Everything else (the app shell/index.html, daily content, manifest, icons...) can change
  // without a version bump, so keep checking the network first and falling back to cache offline.
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req,{cache:'no-cache'});
      if(fresh.ok){const c=await caches.open(CACHE);c.put(req,fresh.clone()).catch(()=>{});return fresh;}
    }catch{}
    return (await caches.match(req,{ignoreSearch:true}))||new Response('',{status:503,statusText:'Offline'});
  })());
});

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
