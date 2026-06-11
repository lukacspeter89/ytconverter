/*
 * coi-serviceworker.js
 * ---------------------
 * Enables cross-origin isolation (COOP + COEP) on static hosts such as GitHub
 * Pages, which can't set HTTP headers themselves. Isolation makes
 * SharedArrayBuffer available, so ffmpeg.wasm can run multi-threaded.
 *
 * One file, two roles:
 *   - When loaded as a service worker, it injects the isolation headers into
 *     every response it serves.
 *   - When loaded as a normal page <script>, it registers itself and reloads
 *     the page once so the worker takes control.
 *
 * Approach based on the well-known coi-serviceworker pattern (MIT, Guido Zuidhof).
 */

if (typeof window === 'undefined') {
  // ----- Service Worker context -----
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'deregister') {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => clients.forEach((client) => client.navigate(client.url)));
    }
  });

  self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Leave range/cache-only requests alone.
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Opaque responses (status 0) can't be modified — pass through.
          if (response.status === 0) return response;

          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          // Lets cross-origin subresources (fonts, CDN) embed under require-corp.
          headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        })
        .catch((err) => console.error('[coi] fetch failed:', err))
    );
  });
} else {
  // ----- Page context: register self, then reload once to gain control -----
  (() => {
    // Already isolated — nothing to do, clear the reload guard.
    if (window.crossOriginIsolated) {
      sessionStorage.removeItem('coiReloaded');
      return;
    }
    if (!window.isSecureContext || !navigator.serviceWorker) return;

    const reloadOnce = () => {
      if (sessionStorage.getItem('coiReloaded')) return; // already tried — avoid loops
      sessionStorage.setItem('coiReloaded', '1');
      window.location.reload();
    };

    navigator.serviceWorker
      .register(document.currentScript.src)
      .then((registration) => {
        registration.addEventListener('updatefound', reloadOnce);
        if (registration.active && !navigator.serviceWorker.controller) reloadOnce();
      })
      .catch((err) => console.error('[coi] SW registration failed:', err));
  })();
}
