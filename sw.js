const CACHE_NAME = 'krishix-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/index.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
  'https://cdn.tailwindcss.com?plugins=typography',
  'https://checkout.razorpay.com/v1/checkout.js'
];

// Install Event: Cache Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network First with Cache Fallback
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (except for specific CDNs we want to cache)
  const url = new URL(event.request.url);
  const isCachableHost = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.tailwindcss.com',
    'checkout.razorpay.com'
  ].includes(url.hostname) || url.origin === self.location.origin;

  if (!isCachableHost || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response to store it in cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});

// Background Sync for Marketplace Transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-marketplace') {
    console.log('SW: Syncing marketplace transactions...');
    event.waitUntil(syncMarketplace());
  }
});

async function syncMarketplace() {
  // This is where we would process the IndexedDB queue if we had one
  // For now, Firestore persistence handles most of this, but we can 
  // add custom logic here if needed.
  return Promise.resolve();
}
