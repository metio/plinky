// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

// The worker as shipped, run against a fake browser: named caches that are maps of URLs,
// a network that can be cut, and the clients the worker asks about. Every strategy in
// public/sw.js is exercised by dispatching the events the browser would, so what a player
// gets with no network is asserted on the file the deploy ships rather than on a
// description of it.

const ORIGIN = "https://plinky.fun";
const SOURCE = readFileSync("public/sw.js", "utf8")
    .replace("__BUILD_HASH__", "test")
    .replace("__PRECACHE__", "/assets/entry-abc.js");
const CACHE = "plinky-build-test";

type Handler = (event: FetchEventLike) => void;
type FetchEventLike = {
    request: { url: string; method: string; mode: string };
    clientId: string;
    respondWith: (response: Promise<Response>) => void;
    waitUntil: (work: Promise<unknown>) => void;
};
type WaitEvent = { waitUntil: (work: Promise<unknown>) => void; data?: unknown };

type World = {
    fetchEvent: (path: string, mode: "navigate" | "cors", clientId?: string) => Promise<Response>;
    install: () => Promise<void>;
    activate: () => Promise<void>;
    message: (data: unknown) => Promise<void>;
    network: { online: boolean; served: Map<string, string>; requested: string[] };
    caches: Map<string, Map<string, Response>>;
    clients: Map<string, string>;
};

function makeWorld(): World {
    const caches = new Map<string, Map<string, Response>>();
    const network = { online: true, served: new Map<string, string>(), requested: [] as string[] };
    const clients = new Map<string, string>();
    const handlers: Record<string, (event: never) => void> = {};
    const keyOf = (request: { url: string } | string) =>
        typeof request === "string" ? new URL(request, ORIGIN).href : request.url;
    const fetch = async (request: { url: string } | string) => {
        const url = keyOf(request);
        network.requested.push(new URL(url).pathname);
        if (!network.online) {
            throw new TypeError("Failed to fetch");
        }
        const body = network.served.get(new URL(url).pathname);
        return body === undefined
            ? new Response("not found", { status: 404 })
            : new Response(body, { status: 200 });
    };
    const open = (name: string) => {
        if (!caches.has(name)) {
            caches.set(name, new Map());
        }
        const store = caches.get(name)!;
        return {
            async add(url: string) {
                const response = await fetch(url);
                if (response.ok) {
                    store.set(keyOf(url), response);
                }
            },
            async put(request: { url: string }, response: Response) {
                store.set(keyOf(request), response);
            },
            async match(request: { url: string } | string) {
                return store.get(keyOf(request))?.clone();
            },
            async keys() {
                return [...store.keys()].map((url) => ({ url }));
            },
        };
    };
    const self = {
        location: { origin: ORIGIN },
        addEventListener(type: string, handler: (event: never) => void) {
            handlers[type] = handler;
        },
        clients: {
            async get(id: string) {
                const url = clients.get(id);
                return url === undefined ? undefined : { url };
            },
            async claim() {},
        },
        skipWaiting() {},
    };
    const context = vm.createContext({
        self,
        caches: {
            async open(name: string) {
                return open(name);
            },
            async keys() {
                return [...caches.keys()];
            },
            async delete(name: string) {
                return caches.delete(name);
            },
            async match(request: { url: string } | string) {
                for (const store of caches.values()) {
                    const held = store.get(keyOf(request));
                    if (held) {
                        return held.clone();
                    }
                }
                return undefined;
            },
        },
        fetch,
        Response,
        URL,
        Date,
        Promise,
        console,
        encodeURIComponent,
    });
    vm.runInContext(SOURCE, context);
    const waited = async (type: string, data?: unknown) => {
        let pending: Promise<unknown> = Promise.resolve();
        (handlers[type] as (event: WaitEvent) => void)({
            data,
            waitUntil: (work) => {
                pending = work;
            },
        });
        await pending;
    };
    return {
        network,
        caches,
        clients,
        install: () => waited("install"),
        activate: () => waited("activate"),
        message: (data) => waited("message", data),
        fetchEvent(path, mode, clientId = "") {
            let answered: Promise<Response> | null = null;
            (handlers.fetch as Handler)({
                request: { url: new URL(path, ORIGIN).href, method: "GET", mode },
                clientId,
                respondWith: (response) => {
                    answered = response;
                },
                waitUntil: () => {},
            });
            if (answered === null) {
                throw new Error(`the worker did not respond to ${path}`);
            }
            return answered;
        },
    };
}

let world: World;
const held = (path: string) => world.caches.get(CACHE)?.has(`${ORIGIN}${path}`) ?? false;

beforeEach(async () => {
    world = makeWorld();
    world.network.served.set("/", "root shell");
    world.network.served.set("/__spa-fallback.html", "spa shell");
    world.network.served.set("/offline.html", "offline page");
    world.network.served.set("/assets/entry-abc.js", "entry");
    world.network.served.set("/en/music/", "music page");
    await world.install();
});

describe("the service worker with no network", () => {
    it("serves a page it holds", async () => {
        await world.fetchEvent("/en/music/", "navigate");
        world.network.online = false;
        expect(await (await world.fetchEvent("/en/music/", "navigate")).text()).toBe("music page");
    });

    it("serves the shell for a page it has never seen", async () => {
        world.network.online = false;
        expect(await (await world.fetchEvent("/en/settings/", "navigate")).text()).toBe(
            "spa shell",
        );
    });

    it("answers the reload after a missing route module with the offline page", async () => {
        world.network.online = false;
        world.clients.set("tab", `${ORIGIN}/en/settings/`);
        await expect(world.fetchEvent("/assets/settings-xyz.js", "cors", "tab")).rejects.toThrow();
        expect(await (await world.fetchEvent("/en/settings/", "navigate")).text()).toBe(
            "offline page",
        );
    });

    it("keeps serving the shell to a page that did not miss a module", async () => {
        world.network.online = false;
        world.clients.set("tab", `${ORIGIN}/en/settings/`);
        await expect(world.fetchEvent("/assets/settings-xyz.js", "cors", "tab")).rejects.toThrow();
        expect(await (await world.fetchEvent("/en/stats/", "navigate")).text()).toBe("spa shell");
    });

    it("forgets a miss once the reload window has passed", async () => {
        world.network.online = false;
        world.clients.set("tab", `${ORIGIN}/en/settings/`);
        await expect(world.fetchEvent("/assets/settings-xyz.js", "cors", "tab")).rejects.toThrow();
        const realNow = Date.now;
        Date.now = () => realNow() + 60_000;
        try {
            expect(await (await world.fetchEvent("/en/settings/", "navigate")).text()).toBe(
                "spa shell",
            );
        } finally {
            Date.now = realNow;
        }
    });
});

describe("the service worker with a network", () => {
    it("precaches the offline page at install", () => {
        expect(held("/offline.html")).toBe(true);
        expect(held("/assets/entry-abc.js")).toBe(true);
    });

    it("serves a hashed asset from the cache once fetched", async () => {
        world.network.served.set("/assets/play-123.js", "play");
        await world.fetchEvent("/assets/play-123.js", "cors");
        world.network.online = false;
        expect(await (await world.fetchEvent("/assets/play-123.js", "cors")).text()).toBe("play");
    });
});

describe("keeping a language on the device", () => {
    beforeEach(() => {
        world.network.served.set(
            "/offline/de.json",
            JSON.stringify([
                "/assets/entry-abc.js",
                "/assets/settings-xyz.js",
                "/de/",
                "/songs/index/00.json",
            ]),
        );
        world.network.served.set("/assets/settings-xyz.js", "settings");
        world.network.served.set("/de/", "german home");
        world.network.served.set("/songs/index/00.json", "[]");
    });

    it("fetches everything on the language's list that it does not already hold", async () => {
        await world.message({ type: "KEEP_OFFLINE", locale: "de" });
        expect(held("/assets/settings-xyz.js")).toBe(true);
        expect(held("/de/")).toBe(true);
        expect(held("/songs/index/00.json")).toBe(true);
        // The entry chunk was precached at install and is not asked for again.
        expect(world.network.requested.filter((p) => p === "/assets/entry-abc.js")).toHaveLength(1);
    });

    it("then serves a never-opened page with no network", async () => {
        await world.message({ type: "KEEP_OFFLINE", locale: "de" });
        world.network.online = false;
        expect(await (await world.fetchEvent("/assets/settings-xyz.js", "cors")).text()).toBe(
            "settings",
        );
    });

    it("ignores a language it has no list for", async () => {
        await world.message({ type: "KEEP_OFFLINE", locale: "xx" });
        expect(held("/assets/settings-xyz.js")).toBe(false);
    });
});

describe("a new build taking over", () => {
    it("carries the hashed assets it still ships over from the old cache", async () => {
        const old = world.caches;
        old.set("plinky-build-old", new Map());
        old.get("plinky-build-old")!.set(`${ORIGIN}/assets/shared-111.js`, new Response("shared"));
        old.get("plinky-build-old")!.set(`${ORIGIN}/de/`, new Response("stale page"));
        await world.activate();
        expect(world.caches.has("plinky-build-old")).toBe(false);
        expect(held("/assets/shared-111.js")).toBe(true);
        // Un-hashed pages are not carried: they may have changed under the same URL.
        expect(held("/de/")).toBe(false);
    });

    it.each(["plinky-v1", "plinky-0123456789ab"])(
        "evicts %s, a build cache named the way earlier workers named them",
        async (name) => {
            world.caches.set(
                name,
                new Map([[`${ORIGIN}/assets/kept-222.js`, new Response("kept")]]),
            );
            await world.activate();
            expect(world.caches.has(name)).toBe(false);
            expect(held("/assets/kept-222.js")).toBe(true);
        },
    );

    it("keeps the piano recordings the page stored in a cache of its own", async () => {
        const recording = "https://samples.plinky.fun/v1/C4v8.m4a";
        world.caches.set("plinky-piano-v1", new Map([[recording, new Response("C4")]]));
        await world.activate();
        const piano = world.caches.get("plinky-piano-v1");
        expect(piano?.has(recording)).toBe(true);
        expect(await piano?.get(recording)?.text()).toBe("C4");
        // Nor are they copied into the build's cache, which the next deploy evicts.
        expect(world.caches.get(CACHE)?.has(recording)).toBe(false);
    });

    it("keeps a cache whose name is not a build's at all", async () => {
        world.caches.set("someone-else", new Map([[`${ORIGIN}/x`, new Response("x")]]));
        await world.activate();
        expect(world.caches.has("someone-else")).toBe(true);
    });

    it("keeps its own cache and what it holds", async () => {
        await world.activate();
        expect(held("/offline.html")).toBe(true);
    });
});
