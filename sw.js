// sw.js — OFFLINE-FIRST READER (GitHub Pages SAFE)

const VERSION = 'v4';
const STATIC_CACHE = `gkr-static-${VERSION}`;
const CHAPTER_CACHE = `gkr-chapters-${VERSION}`;

/* ===============================
   FILE LISTS
   =============================== */

/* App shell ONLY (must exist) */
const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'assets/cover-1600.webp'
];

/* Chapters that EXIST TODAY (optional) */
const CHAPTERS = [
  'chapters/notification.html',
  'chapters/resolution.html',
  'chapters/documents_accompanying.html',
  'chapters/ch1.html',
  'chapters/ch2.html'
];

/* ===============================
   INSTALL — SAFE CACHING
   =============================== */
self.addEventListener('install', event => {
  event.waitUntil((async () => {

    /* Cache app shell safely (no addAll) */
    const staticCache = await caches.open(STATIC_CACHE);
    for (const file of STATIC_ASSETS) {
      try {
        const res = await fetch(file);
        if (res.ok) {
          await staticCache.put(file, res.clone());
        }
      } catch (e) {
        console.warn('[SW] Static skipped:', file);
      }
    }

    /* Cache only existing chapters (optional) */
    const chapterCache = await caches.open(CHAPTER_CACHE);
    for (const ch of CHAPTERS) {
      try {
        const res = await fetch(ch);
        if (res.ok) {
          await chapterCache.put(ch, res.clone());
        }
      } catch (e) {
        console.warn('[SW] Chapter skipped:', ch);
      }
    }

    
  })());
});

/* ===============================
   ACTIVATE — CLEANUP
   =============================== */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![STATIC_CACHE, CHAPTER_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    )
  );
});


/* ===============================
   FETCH — OFFLINE FIRST
   =============================== */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* 📘 Chapters (lazy cache, iframe-safe) */
  if (url.pathname.includes('/chapters/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CHAPTER_CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const res = await fetch(event.request);
        if (res.ok) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch {
        return new Response(
          `<h3 style="padding:20px;font-family:serif">
            This chapter is not available offline yet.<br>
            Please open it once while online.
          </h3>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    })());
    return;
  }

  /* 🌐 Navigation (App Shell) */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('index.html'))
    );
    return;
  }

  /* 📦 Other assets */
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});
