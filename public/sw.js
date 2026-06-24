// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A small offline cache with three strategies, chosen per request:
//   - navigations: network-first, falling back to the cached app shell so the
//     client router can render the route offline.
//   - hashed build assets under /assets/: cache-first. Their filenames carry a
//     content hash, so a cached copy can never be stale — a changed file is a
//     changed URL.
//   - every other same-origin GET (the song registry, manifest, icons, og image):
//     stale-while-revalidate. The cached copy is served immediately, while a
//     background fetch refreshes it for the next visit. Cache-first here would
//     freeze these un-hashed files at their first-seen version forever, so a
//     grown song pack or a new icon would never reach returning visitors.
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

function isHashedAsset(url) {
    return url.pathname.startsWith("/assets/");
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) {
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

    if (isHashedAsset(url)) {
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
        return;
    }

    // Stale-while-revalidate for un-hashed static files.
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE);
            const cached = await cache.match(request);
            const network = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached ?? Response.error());
            return cached ?? network;
        })(),
    );
});
