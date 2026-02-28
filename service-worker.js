/* service-worker.js — GP Prompt Database */
/* Cache-first strategy for all static assets */

const CACHE_NAME = 'gp-prompt-db-v1';

// All files to pre-cache for full offline support
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/js/app.js',
  '/js/db.js',
  '/js/screens/prompts.js',
  '/js/screens/settings.js',
  '/js/components/bottomSheet.js',
  '/js/components/tagInput.js',
  '/js/components/modal.js',
  '/js/utils/uuid.js',
  '/js/utils/search.js',
  '/js/utils/exportImport.js',
  '/js/utils/icons.js',
  '/fonts/playfair-display-600.woff2',
  '/fonts/playfair-display-700.woff2',
  '/fonts/inter-400.woff2',
  '/fonts/inter-500.woff2',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});
