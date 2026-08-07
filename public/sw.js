const CACHE_NAME = 'hyper-mes-v16';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[ServiceWorker] Installing new version v16...');
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

  // 1. Skip non-HTTP(S) schemes (e.g. chrome-extension://, edge-extension://, data:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 2. Do not intercept Supabase REST/Realtime requests
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/')) {
    return;
  }

  // 3. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 4. For HTML & JS Assets: Network-First to guarantee live auto-updates on deployment
  const isCodeAsset = request.headers.get('accept')?.includes('text/html') || 
                      url.pathname.endsWith('index.html') || 
                      url.pathname.includes('/assets/');

  if (isCodeAsset) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, serve from cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          
          if (request.headers.get('accept')?.includes('text/html') || request.mode === 'navigate') {
            const scope = self.registration.scope;
            const indexUrl = new URL('index.html', scope).href;
            const cachedIndex = (await caches.match(indexUrl)) || (await caches.match(scope));
            if (cachedIndex) return cachedIndex;
          }

          return new Response('Offline resource unavailable', {
            status: 503,
            statusText: 'Offline',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        })
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
