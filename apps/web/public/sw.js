const PUBLIC_CACHE = 'dripwell-public-v2';
const PUBLIC_ASSETS = ['/favicon.svg', '/icon-192.svg', '/icon-512.svg', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PUBLIC_CACHE).then(cache => cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== PUBLIC_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !PUBLIC_ASSETS.includes(url.pathname) || url.search) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
