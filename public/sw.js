// Service Worker for FocusFlow Daily Task Tracker PWA
// Vanilla JS on purpose (served as-is from /public, not bundled).
//
// Caching rules:
// - Only static, non-personal assets are cached (hashed Next.js bundles, icons, badges, offline page).
// - Page navigations, RSC payloads, API routes and Supabase calls are NEVER cached: they carry
//   per-user data and must not be served to the next person on a shared device or after logout.
// - Navigations are network-only, falling back to a static offline page.
//
// Bump CACHE_VERSION whenever these rules or the precache list change; old caches are deleted on activate.
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `focusflow-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
    OFFLINE_URL,
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png',
];

// Public files that are safe to cache (no user data)
const PUBLIC_ASSET_PATTERN = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Remove every other cache, including the v1 cache that held authenticated HTML
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Cross-origin (Supabase, etc.): let the browser handle it untouched
    if (url.origin !== self.location.origin) return;

    // Page navigations: always go to the network; show the static offline page if that fails
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // Hashed build output is immutable: cache-first is safe
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Icons, badges, fonts: serve from cache, refresh in the background
    if (PUBLIC_ASSET_PATTERN.test(url.pathname) || url.pathname === '/manifest.json') {
        event.respondWith(staleWhileRevalidate(event, request));
        return;
    }

    // Everything else (RSC payloads, /api/*, dynamic data): network only, not intercepted
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
    }
    return response;
}

async function staleWhileRevalidate(event, request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);

    const network = fetch(request)
        .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);

    if (cached) {
        event.waitUntil(network);
        return cached;
    }
    return network;
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const title = event.data.title || 'FocusFlow Reminder';
        const options = {
            body: event.data.body || 'Don\'t forget to complete your habits for today!',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: { url: '/' }
        };
        event.waitUntil(self.registration.showNotification(title, options));
    }
});

// Notification click: focus an open app window or open a new one
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
