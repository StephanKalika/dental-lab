// Service Worker for Dental Lab  
// Version 2.2.0

const CACHE_NAME = 'dental-lab-v2-2';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  '/favicon.svg',
  '/site.webmanifest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap'
  // Add your images here when available:
  // '/images/hero-image.png',
  // '/images/hero-image.webp'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.warn('SW: Cache failed', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  // Never intercept serverless/API endpoints.
  if (event.request.url.includes('/.netlify/functions/')) {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://fonts.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then(fetchResponse => {
          // Don't cache non-successful responses
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response for caching
          const responseToCache = fetchResponse.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              // Only cache GET requests
              if (event.request.method === 'GET') {
                cache.put(event.request, responseToCache);
              }
            });

          return fetchResponse;
        }).catch(err => {
          console.warn('SW: Fetch failed:', err);
          
          // Return offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background sync for form submissions (future enhancement)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    // Handle offline form submissions
  }
});

// Push notifications (future enhancement)
self.addEventListener('push', event => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      },
      actions: [
        {
          action: 'explore',
          title: 'Перейти до сайту',
          icon: '/favicon.svg'
        },
        {
          action: 'close',
          title: 'Закрити',
          icon: '/favicon.svg'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification('Dental Lab', options)
    );
  }
});