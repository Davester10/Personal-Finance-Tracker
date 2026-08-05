const CACHE_NAME = 'myfinance-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/income.html',
  '/expenses.html',
  '/budget.html',
  '/savings.html',
  '/reports.html',
  '/settings.html',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/reports.css',
  '/js/firebase-config.js',
  '/js/firebase.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/income.js',
  '/js/expenses.js',
  '/js/transactions.js',
  '/js/budget.js',
  '/js/savings.js',
  '/js/reports.js',
  '/js/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});
