const CACHE_NAME = 'myeshim-v45-cache';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon-16.png',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-192.png',
  './icon-256.png',
  './icon-512.png',
  './logo.png',
  './offline.html',
  './screenshots/home-mobile.png',
  './screenshots/home-desktop-wide.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => Promise.all(clients.map(client => client.postMessage({ type: 'SW_UPDATED' }))))
  );
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Network-first for HTML / navigation: always fetch fresh markup after a deploy
  const isNavigation = event.request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname === '/'
    || url.pathname.endsWith('/');
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('./offline.html'))
      )
    );
    return;
  }
  // Cache-first for all other assets (icons, JS, images, …)
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./offline.html')))
  );
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'MYEShim – dnešní verš 📖';
  const body = data.body || data.verse || 'Otevři appku a přečti si dnešní verš.';
  const ref = data.ref || '';
  const tag = data.tag || 'myeshim-daily';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: './icon-192.png',
      badge: './icon-96.png',
      tag: tag,
      renotify: false,
      data: { ref: ref, url: self.registration.scope }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const ref = event.notification.data && event.notification.data.ref ? event.notification.data.ref : '';
  const targetUrl = (event.notification.data && event.notification.data.url ? event.notification.data.url : self.registration.scope) + (ref ? '#' + ref : '');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          if (ref) client.postMessage({ type: 'NAVIGATE_TO_REF', ref: ref });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
