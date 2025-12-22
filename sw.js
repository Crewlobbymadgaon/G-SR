// sw.js — FULL OFFLINE-FIRST READER (GitHub Pages SAFE)

const VERSION = 'v3';
const STATIC_CACHE = `gkr-static-${VERSION}`;
const CHAPTER_CACHE = `gkr-chapters-${VERSION}`;

/* ===============================
   STATIC APP SHELL
   =============================== */
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/cover-1600.webp'
];

/* ===============================
   📘 CHAPTERS
   =============================== */
const CHAPTERS = [
  './chapters/notification.html',
  './chapters/resolution.html',
  './chapters/documents_accompanying.html',
  './chapters/ch1.html',
  './chapters/ch2.html',
  './chapters/ch3.html',
  './chapters/ch4.html',
  './chapters/ch5.html',
  './chapters/ch6.html',
  './chapters/ch7.html',
  './chapters/ch8.html',
  './chapters/ch9.html',
  './chapters/ch10.html',
  './chapters/ch11.html',
  './chapters/ch12.html',
  './chapters/ch13.html',
  './chapters/ch14.html',
  './chapters/ch15.html',
  './chapters/ch16.html',
  './chapters/ch17.html',
  './chapters/ch18.html',
  './chapters/appendix.html'
];

/* ===============================
   INSTALL
   =============================== */
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.addAll(STATIC_ASSETS);

      const chapterCache = await caches.open(CHAPTER_CACHE);
      for (const ch of CHAPTERS) {
        try {
          await chapterCache.add(ch);
        } catch (e) {
          console.warn('Chapter not cached:', ch);
        }
      }

      self.skipWaiting();
    })()
  );
});

/* ===============================
   ACTIVATE
   =============================== */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![STATIC_CACHE, CHAPTER_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ===============================
   FETCH
   =============================== */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 📘 Chapters (cache-first) */
  if (url.pathname.includes('/chapters/')) {
    event.respondWith(
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
            `<h2 style="padding:20px;font-family:serif">
              Chapter available after first online load
            </h2>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })
    );
    return;
  }

  /* 🌐 Navigation */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 📦 Other assets */
  event.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          caches.open(STATIC_CACHE).then(c => c.put(req, resp.clone()));
        }
        return resp;
      })
    )
  );
});
