const CACHE_NAME = 'plant-control-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[ServiceWorker] Installing PlantControl...');
      const scope = self.registration.scope;
      const indexUrl = new URL('index.html', scope).href;
      try {
        await cache.addAll([scope, indexUrl]);
      } catch (err) {
        console.warn('[ServiceWorker] Install caching warning:', err);
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip non-HTTP(S) schemes
  if (!url.protocol.startsWith('http')) return;

  // 2. Do not intercept Supabase REST/Realtime requests
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/')) return;

  // 3. Only handle GET requests
  if (request.method !== 'GET') return;

  // 4. For Navigation and HTML requests: Network-First with automatic fallback to index.html
  const isHtmlNavigation = request.mode === 'navigate' || 
                           request.headers.get('accept')?.includes('text/html') || 
                           url.pathname.endsWith('index.html');

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
            return networkResponse;
          }
          // If network returns 404 or bad response, fallback to index.html
          const scope = self.registration.scope;
          const indexUrl = new URL('index.html', scope).href;
          const cachedIndex = (await caches.match(indexUrl)) || (await caches.match(scope));
          if (cachedIndex) return cachedIndex;
          return fetch(indexUrl);
        })
        .catch(async () => {
          const scope = self.registration.scope;
          const indexUrl = new URL('index.html', scope).href;
          const cachedIndex = (await caches.match(indexUrl)) || (await caches.match(scope));
          if (cachedIndex) return cachedIndex;
          return new Response('PlantControl loading...', { status: 200, headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  // 5. For JS/CSS assets in /assets/: Network-First with Cache fallback
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 5. For static media assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      }).catch(() => {
        return new Response('Offline resource unavailable', {
          status: 503,
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
