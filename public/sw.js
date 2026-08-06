const CACHE_NAME = 'hyper-mes-v4';

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

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately & update in background if online (Stale-While-Revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.protocol.startsWith('http')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* Offline - silent fallback */});
        return cachedResponse;
      }

      // If not cached, fetch from network and cache
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || !url.protocol.startsWith('http')) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      }).catch(async () => {
        // Fallback for HTML navigation requests when offline
        if (request.headers.get('accept')?.includes('text/html') || request.mode === 'navigate') {
          const scope = self.registration.scope;
          const indexUrl = new URL('index.html', scope).href;
          const cachedIndex = (await caches.match(indexUrl)) || (await caches.match(scope));
          if (cachedIndex) return cachedIndex;
        }
        
        // Return a valid offline Response instead of undefined to prevent TypeError: Failed to convert value to 'Response'
        return new Response('Offline resource unavailable', {
          status: 503,
          statusText: 'Offline',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
