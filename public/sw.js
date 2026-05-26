const CACHE_NAME = 'songnhac-v1.1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Bypass cache completely in development sandbox URLs to avoid bundle freezes
  if (url.includes('.run.app') || url.includes('localhost') || url.includes('127.0.0.1')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Do not intercept or cache stream audio clips or API proxy tracks
  if (url.match(/\.(mp3|flac|aac|ogg|wav|m4a)$/i) || url.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Standard safe static cache fallback for rapid bootups
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => fetch(e.request))
  );
});
