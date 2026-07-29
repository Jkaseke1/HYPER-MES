export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const baseUrl = import.meta.env.BASE_URL || './';
      const swUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}sw.js`;
      navigator.serviceWorker
        .register(swUrl, { scope: baseUrl })
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });
  }
}
