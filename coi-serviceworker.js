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

// Bump COI_BUILD when you change this file, so the console confirms the new
// service worker is actually live (vs a cached old one).
const COI_BUILD = 'coi-2';

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
    const safelog = (...a) => { try { (console && console.log || (() => {}))(...a); } catch (_) {} };
    safelog('[coi] page script:', COI_BUILD,
            '| isolated:', window.crossOriginIsolated,
            '| controlled:', !!navigator.serviceWorker?.controller);

    // Already isolated — nothing to do, reset the attempt counter.
    if (window.crossOriginIsolated) {
      sessionStorage.removeItem('coiAttempts');
      return;
    }
    if (!window.isSecureContext || !navigator.serviceWorker) {
      safelog('[coi] service workers unavailable — staying single-threaded');
      return;
    }

    // Allow up to 2 reload attempts per tab session, then give up (single-thread)
    // so we never get stuck in a reload loop if isolation can't be achieved.
    const attempts = +(sessionStorage.getItem('coiAttempts') || 0);
    const reloadOnce = (why) => {
      if (attempts >= 2) {
        safelog('[coi] isolation not achieved after retries — staying single-threaded');
        return;
      }
      sessionStorage.setItem('coiAttempts', String(attempts + 1));
      safelog('[coi] reloading to apply isolation headers —', why);
      window.location.reload();
    };

    const swUrl = document.currentScript.src;

    // When the worker activates it calls clients.claim(), firing controllerchange.
    navigator.serviceWorker.addEventListener('controllerchange', () => reloadOnce('controllerchange'));

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        safelog('[coi] registered, scope:', reg.scope, '| active:', !!reg.active);
        if (reg.active && !navigator.serviceWorker.controller) reloadOnce('active-not-controlling');
      })
      .catch((err) => safelog('[coi] registration failed:', err));

    // Controlled already but still not isolated → one reload to apply headers.
    if (navigator.serviceWorker.controller) reloadOnce('controlled-not-isolated');
  })();
}
