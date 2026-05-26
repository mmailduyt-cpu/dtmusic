const CACHE_NAME = 'songnhac-v2.0';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Always fetch HTML, SW, API from network
  if (url.endsWith('/') || url.includes('/index.html') || url.includes('/sw.js') || url.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Bypass dev URLs
  if (url.includes('.run.app') || url.includes('localhost') || url.includes('127.0.0.1')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Do not cache audio files
  if (url.match(/\.(mp3|flac|aac|ogg|wav|m4a)$/i)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets cache-first (JS, CSS, images, fonts)
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
