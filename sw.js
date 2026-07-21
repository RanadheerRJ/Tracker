/* Timesheet Ledger — service worker
   Provides offline support so the app loads without a network and stays
   installable. App data itself is kept in IndexedDB (independent of this
   cache), so records survive refreshes and offline use. */
const CACHE = 'chrona-v4-security-profile';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './firebase-config.js',
  './local-security.js',
  './admin.html',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png'
];

// Install: precache the app shell so the UI works on the very first offline load.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches and take control immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests; let the browser handle everything else.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Page navigations: network-first so updates show when online, cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Same-origin assets: cache-first, then fetch and store.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
    return;
  }

  // Google Fonts: stale-while-revalidate so typography works offline after first visit.
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://www.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }
});
