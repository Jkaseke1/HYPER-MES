export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const baseUrl = import.meta.env.BASE_URL || './';
      const swUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}sw.js?v=27`;
      
      navigator.serviceWorker
        // Do not let the HTTP cache delay discovery of a newly deployed worker.
        .register(swUrl, { scope: baseUrl, updateViaCache: 'none' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);

          // Auto-check for updates every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60000);

          // Handle automatic live updates when a new SW version is waiting
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[PWA] New version detected! Automatically activating update...');
                    installingWorker.postMessage({ type: 'SKIP_WAITING' });
                    // The controllerchange handler below reloads only after the
                    // new worker owns this page. Reloading here could serve the
                    // previous asset bundle and require several manual refreshes.
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });

      // Reload page when controller changes to apply new assets
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}
