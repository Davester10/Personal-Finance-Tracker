const CACHE_NAME = 'myfinance-v5';
const APP_SHELL = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/income.html',
  '/expenses.html',
  '/budget.html',
  '/savings.html',
  '/reports.html',
  '/settings.html',
  '/transactions.html',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/reports.css',
  '/js/firebase-config.js',
  '/js/firebase.js',
  '/js/auth.js',
  '/js/smart-alerts.js',
  '/js/app-core.js',
  '/js/app-helpers.js',
  '/js/dashboard.js',
  '/js/income.js',
  '/js/expenses.js',
  '/js/transactions.js',
  '/js/budget.js',
  '/js/savings.js',
  '/js/reports.js',
  '/js/settings.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(e => console.warn('PWA precache note:', e)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com') || url.hostname.includes('firebaseapp.com')) {
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = fetch(request).then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => { });
      }
      return response;
    }).catch(() => cached);

    return cached || networkPromise;
  })());
});
