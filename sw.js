// sw.js — GitHub Pages friendly, robust caching + offline fallback
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const FALLBACK_CACHE = `fallback-${VERSION}`;

// IMPORTANT: use relative URLs (no leading slash) for GitHub Pages
const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'index.css',      // replace with your actual CSS filename or remove if none
  'index.js',       // replace with your actual JS filename or remove if none
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png'
];

// optional fallback page (create offline.html and list it here if you want)
const OFFLINE_PAGE = 'index.html';

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        // some requests may fail (e.g., because of CORS); still continue install
        console.warn('Some static assets failed to cache during install', err);
      }
      // warm a fallback cache if needed
      const fcache = await caches.open(FALLBACK_CACHE);
      // put offline page into fallback cache for navigation fallback
      try { await fcache.add(OFFLINE_PAGE); } catch(e) {}
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== FALLBACK_CACHE)
            .map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Helper: is request for navigation (page)
function isNavigationRequest(req){
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
}

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  // only deal with GET requests
  if (req.method !== 'GET') return;

  // Navigation requests: network-first with fallback to cache/offline
  if (isNavigationRequest(req)){
    evt.respondWith((async () => {
      try {
        const networkResp = await fetch(req);
        // successful network -> optionally update cache
        if (networkResp && networkResp.status === 200){
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, networkResp.clone()).catch(()=>{});
        }
        return networkResp;
      } catch (err) {
        // offline -> try cache
        const cached = await caches.match(req);
        if (cached) return cached;
        // final fallback to offline page from fallback cache
        const f = await caches.match(OFFLINE_PAGE);
        if (f) return f;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // For non-navigation requests: cache-first then network, but don't cache opaque or non-200
  evt.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const networkResp = await fetch(req);
      if (!networkResp || networkResp.status !== 200 || networkResp.type === 'opaque') {
        return networkResp;
      }
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, networkResp.clone()).catch(()=>{});
      return networkResp;
    } catch (err) {
      // network failure -> try cache
      const fallback = await caches.match(req);
      if (fallback) return fallback;
      return new Response(null, { status: 504, statusText: 'Gateway Timeout' });
    }
  })());
});
