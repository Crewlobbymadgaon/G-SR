// sw.js — stable PWA + iframe + offline chapters (GitHub Pages safe)

const VERSION = 'v2';
const STATIC_CACHE = `gkr-static-${VERSION}`;
const CHAPTER_CACHE = `gkr-chapters-${VERSION}`;

// IMPORTANT: relative URLs only (GitHub Pages)
const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'assets/cover-1600.webp'
];

// INSTALL
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![STATIC_CACHE, CHAPTER_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', evt => {
  const req = evt.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* ===============================
     1️⃣ CHAPTER FILES (iframe)
     cache-first, offline-safe
     =============================== */
  if (url.pathname.includes('/chapters/')) {
    evt.respondWith(
      caches.open(CHAPTER_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const fresh = await fetch(req);
          if (fresh && fresh.status === 200) {
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          return new Response(
            `<h2 style="font-family:serif;padding:20px">
              Chapter not available offline
            </h2>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })
    );
    return;
  }

  /* ===============================
     2️⃣ APP SHELL / NAVIGATION
     network-first, fallback cache
     =============================== */
  if (req.mode === 'navigate') {
    evt.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
          return resp;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  /* ===============================
     3️⃣ OTHER ASSETS (images, etc.)
     cache-first
     =============================== */
  evt.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
        }
        return resp;
      })
    )
  );
});
