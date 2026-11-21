const CACHE_NAME = 'mindsensei-v2';
const ROUTES = ['/', '/dashboard', '/train', '/train/focus', '/train/memory', '/train/reaction', '/train/logic', '/settings'];
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const assets = new Set(['/brain.svg', '/manifest.json']);
        for (const route of ROUTES) {
            const response = await fetch(new Request(route, { headers: { Accept: 'text/html' }, cache: 'reload' }));
            if (!response.ok) throw new Error(`Cannot prepare ${route} for offline training`);
            const html = await response.clone().text();
            await cache.put(route, response);
            for (const match of html.matchAll(/(?:src|href)="([^"\s]+)"/g)) {
                const url = new URL(match[1].replaceAll('&amp;', '&'), self.location.origin);
                if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) assets.add(url.href);
            }
        }
        await cache.addAll([...assets]);
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('mindsensei-') && key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok && ROUTES.includes(url.pathname)) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(url.pathname, response.clone());
                }
                return response;
            } catch {
                return await caches.match(url.pathname) ?? new Response('This page is not available offline. Open Mind Sensei while connected to prepare offline training.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
            }
        })());
    } else if (url.pathname.startsWith('/_next/static/') || url.pathname === '/brain.svg' || url.pathname === '/manifest.json') {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            const response = await fetch(request);
            if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); }
            return response;
        })());
    }
    // RSC responses depend on router headers. Let Next handle a failed RSC fetch
    // by navigating to the fully cached HTML rather than serving the wrong variant.
});
