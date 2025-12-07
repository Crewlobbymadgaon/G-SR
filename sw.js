const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/styles.css', '/main.js', // adjust to your files
  '/icons/icon-192.png', '/icons/icon-512.png'
];

// install -> pre-cache shell
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate -> cleanup old caches
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(`static-${VERSION}`)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// fetch -> cache-first for everything; for network fallback, try cache
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  // only handle GET
  if (req.method !== 'GET') return;
  // strategy: try cache, else network and cache result
  evt.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // don't cache opaque or external requests if you don't want them
        if (!networkRes || networkRes.status !== 200 || networkRes.type === 'opaque') return networkRes;
        const copy = networkRes.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(req, copy));
        return networkRes;
      }).catch(() => {
        // fallback: optionally return a fallback page for navigation
        if (req.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
