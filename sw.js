const C='curious-path-v8-voice-profiles';
const A=['./','./index.html','./styles.css','./manifest.webmanifest','./garden.css',
  ...['app','engine','content','maths-data','words-data','word-engine','word-lab','voice-spelling','attempts','quiz','reports','explanations','garden','garden-model','garden-picture','local-data','data-store','profiles','profile-panel','sync-model','firebase-config','cloud-sync','sync-transport'].map(name=>`./src/${name}.js`)];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('curious-path-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===self.location.origin)e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));});
