// Static Service Worker for FocusFlow Daily Task Tracker PWA
const CACHE_NAME = 'focusflow-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png',
];

// Install Event
self.addEventListener('install', (event: any) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    (self as any).skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event: any) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    (self as any).clients.claim();
});

// Fetch Event (Offline first fallback to Network)
self.addEventListener('fetch', (event: any) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache new static requests Dynamically
                if (
                    networkResponse.status === 200 &&
                    (event.request.url.startsWith(self.location.origin) ||
                        event.request.url.includes('fonts.googleapis.com'))
                ) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline backup fallback if fetch fails
                return caches.match('/');
            });
        })
    );
});
