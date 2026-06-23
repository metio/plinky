// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A small offline cache: precache the app shell, serve hashed build assets
// cache-first (their names change on rebuild, so a cached copy is never stale),
// and serve navigations network-first so updates land, falling back to the cached
// shell when offline.
const CACHE = "plinky-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/")));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            for (const key of await caches.keys()) {
                if (key !== CACHE) {
                    await caches.delete(key);
                }
            }
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
        return;
    }
    if (request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);
                    const cache = await caches.open(CACHE);
                    cache.put("/", response.clone());
                    return response;
                } catch {
                    return (await caches.match("/")) ?? Response.error();
                }
            })(),
        );
        return;
    }
    event.respondWith(
        (async () => {
            const cached = await caches.match(request);
            if (cached) {
                return cached;
            }
            const response = await fetch(request);
            if (response.ok) {
                const cache = await caches.open(CACHE);
                cache.put(request, response.clone());
            }
            return response;
        })(),
    );
});
