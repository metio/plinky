// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
const CACHE = "plinky-build-__BUILD_HASH__";

// Which caches are a build's, and so the activate handler's to evict. Cache Storage is
// shared with the page, which keeps caches of its own on the origin — the piano
// recordings in "plinky-piano-v1", fetched once and meant to outlast every deploy — so
// eviction touches only names this worker creates. The second arm is the names earlier
// workers created ("plinky-v1", then "plinky-" and a twelve-digit build hash), so a device
// still holding one has it evicted like any other old build.
function isBuildCache(name) {
    return name.startsWith("plinky-build-") || /^plinky-(?:v1|[0-9a-f]{12})$/.test(name);
}

// The generic shell for routes that were not prerendered to their own document.
const SPA_FALLBACK = "/__spa-fallback.html";

// What a page never opened on this device gets when there is no network. A static
// document with its copy stamped in for every language (dev/stamp-sw.mjs), so it needs
// no chunk of its own to render.
const OFFLINE_PAGE = "/offline.html";

// The hashed shell chunks the prerendered documents load, stamped in at build time
// (dev/stamp-sw.mjs) as newline-joined URLs. Precaching them at install means a new build's
// cache holds what its HTML references, so the app still boots offline after a background
// update — without this, activate evicts the old chunks and a fresh cache holding only the
// shell HTML would white-screen on the next offline open. Unstamped this is the empty list.
const PRECACHE = "__PRECACHE__".split("\n").filter((url) => url.startsWith("/"));

self.addEventListener("install", (event) => {
    // Add each entry rather than addAll: addAll is atomic and one stray 404 would abort the
    // whole install, so a single missing asset can't block the SW updating.
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) =>
                Promise.allSettled(
                    ["/", SPA_FALLBACK, OFFLINE_PAGE, ...PRECACHE].map((url) => cache.add(url)),
                ),
            ),
    );
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
    if (event.data?.type === "KEEP_OFFLINE" && typeof event.data.locale === "string") {
        event.waitUntil(keepOffline(event.data.locale));
    }
});

// Fetch everything a language's pages need into the current cache, so every page works
// without a connection and not only the ones already opened. The list is written per
// language at deploy (dev/stamp-sw.mjs) from the build's own route manifest, so it names
// exactly this build's chunks; the app sends the message on every visit while the
// setting is on, which is what keeps the cache current across deploys. What is already
// held is not fetched again, so a visit with nothing new costs one small request.
const KEEP_AT_ONCE = 6;

async function keepOffline(locale) {
    const list = await fetch(`/offline/${encodeURIComponent(locale)}.json`);
    if (!list.ok) {
        return;
    }
    const urls = await list.json();
    const cache = await caches.open(CACHE);
    const wanted = [];
    for (const url of urls) {
        if (!(await cache.match(url))) {
            wanted.push(url);
        }
    }
    // A few at a time rather than all at once: a couple of hundred requests fired
    // together would stall the page the reader is on.
    for (let at = 0; at < wanted.length; at += KEEP_AT_ONCE) {
        await Promise.allSettled(wanted.slice(at, at + KEEP_AT_ONCE).map((url) => cache.add(url)));
    }
}

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const current = await caches.open(CACHE);
            for (const key of await caches.keys()) {
                if (key !== CACHE && isBuildCache(key)) {
                    await carryOver(await caches.open(key), current);
                    await caches.delete(key);
                }
            }
            await self.clients.claim();
        })(),
    );
});

// Hashed assets the previous build also shipped move into the new cache instead of being
// fetched again. Their names carry a content hash, so a URL both builds know is the same
// bytes; a chunk the new build dropped is never requested and costs nothing but space
// until the next activate. Without this, every deploy emptied the cache and a device
// keeping the whole app offline downloaded all of it again, unchanged chunks included.
async function carryOver(previous, current) {
    for (const request of await previous.keys()) {
        if (!isImmutable(new URL(request.url))) {
            continue;
        }
        const held = await previous.match(request);
        if (held && !(await current.match(request))) {
            await current.put(request, held);
        }
    }
}

// Where a route's code last failed to arrive. React Router answers a route module that
// will not load by reloading the page, unconditionally, and a reload with no network gets
// the same cached shell, the same missing module and the same reload: a loop that never
// paints and never ends. The worker sees both halves of it, the module fetch that failed
// and the navigation that follows from the same page, so remembering the one lets it
// answer the other with the offline page instead of the shell. Scoped to the page that
// missed and to the seconds a reload takes, so a tab on a page it does hold is unaffected.
let missing = { url: "", at: 0 };
const RELOAD_WINDOW_MS = 10_000;

async function noteMissingModule(event) {
    const client = event.clientId ? await self.clients.get(event.clientId) : null;
    missing = { url: client?.url ?? "", at: Date.now() };
}

function reloadingAfterMiss(request) {
    return missing.url !== "" && missing.url === request.url && Date.now() - missing.at < RELOAD_WINDOW_MS;
}

// A cached response a navigation can be answered with. A navigation's redirect mode is
// "manual", and a service worker that answers one with a response that arrived through a
// redirect gets a network error in its place: the player sees the browser's own error page.
// Every fallback install stores arrived that way — the edge sends the bare "/" on to a
// language's page, and the host sends "/offline.html" and "/__spa-fallback.html" on to the
// same paths without ".html" — because cache.add follows the redirect and keeps the flag.
// Rebuilt from its body and headers, the response is the same page with no redirect behind it.
function navigable(response) {
    return response.redirected
        ? new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
          })
        : response;
}

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
                    if (reloadingAfterMiss(request)) {
                        const offline = await cache.match(OFFLINE_PAGE);
                        if (offline) {
                            return navigable(offline);
                        }
                    }
                    const held =
                        (await cache.match(request)) ??
                        (await cache.match(SPA_FALLBACK)) ??
                        (await cache.match("/"));
                    return held ? navigable(held) : Response.error();
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
                let response;
                try {
                    response = await fetch(request);
                } catch (error) {
                    if (url.pathname.endsWith(".js")) {
                        await noteMissingModule(event);
                    }
                    throw error;
                }
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
