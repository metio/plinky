// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A small offline cache with three strategies, chosen per request:
//   - navigations: network-first, falling back to the cached app shell so the
//     client router can render the route offline.
//   - hashed build assets under /assets/: cache-first. Their filenames carry a
//     content hash, so a cached copy can never be stale — a changed file is a
//     changed URL.
//   - every other same-origin GET (manifest, icons, og image):
//     stale-while-revalidate. The cached copy is served immediately, while a
//     background fetch refreshes it for the next visit. Cache-first here would
//     freeze these un-hashed files at their first-seen version forever, so a
//     new icon or manifest would never reach returning visitors.
//
// The cache name carries a build hash stamped in at build time (dev/stamp-sw.mjs),
// so every deploy yields a new cache that the activate handler swaps to, evicting
// HTML that points at hashed chunks the deploy has since removed.
const CACHE = "plinky-__BUILD_HASH__";

// The generic shell for routes that were not prerendered to their own document.
const SPA_FALLBACK = "/__spa-fallback.html";

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", SPA_FALLBACK])));
    // Deliberately no skipWaiting() here: a new build parks in "waiting" instead of
    // seizing control of open tabs. Activating immediately would evict the old cache
    // (see the activate handler) out from under a running tab, whose HTML still points
    // at the previous build's hashed chunks — the next lazy route import would 404 and
    // the router would hard-reload mid-interaction. The client offers the update as a
    // banner and posts SKIP_WAITING only when the user accepts.
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
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

function isImmutable(url) {
    // Hashed build chunks carry a content hash; song files (.mxl) are named by their
    // content CID. Neither can change at a given URL, so a cached copy never stales.
    return url.pathname.startsWith("/assets/") || url.pathname.endsWith(".mxl");
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
                const cache = await caches.open(CACHE);
                try {
                    const response = await fetch(request);
                    // Cache each route under its own URL: the app prerenders a
                    // distinct document per route, so collapsing them onto "/"
                    // would serve the wrong page (and wrong asset preloads) offline.
                    if (response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                } catch {
                    return (
                        (await cache.match(request)) ??
                        (await cache.match(SPA_FALLBACK)) ??
                        (await cache.match("/")) ??
                        Response.error()
                    );
                }
            })(),
        );
        return;
    }

    if (isImmutable(url)) {
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
