const CACHE_NAME = 'hyper-mes-v2';

// Dynamic installation - cache scope root and index.html safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[ServiceWorker] Installing & caching app shell...');
      const scope = self.registration.scope;
      const indexUrl = new URL('index.html', scope).href;
      
      try {
        await cache.addAll([scope, indexUrl]);
        console.log('[ServiceWorker] Successfully cached app shell scope:', scope);
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
            console.log('[ServiceWorker] Deleting old cache:', cache);
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

  // Do not intercept Supabase REST/Realtime requests or external APIs
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/')) {
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version if found
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache (Stale-While-Revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* Offline */});
        return cachedResponse;
      }

      // If not cached, fetch from network and cache
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      }).catch(async () => {
        // Fallback for HTML navigation requests when offline
        if (request.headers.get('accept')?.includes('text/html')) {
          const scope = self.registration.scope;
          const indexUrl = new URL('index.html', scope).href;
          const cachedIndex = await caches.match(indexUrl) || await caches.match(scope);
          if (cachedIndex) return cachedIndex;
        }
      });
    })
  );
});
