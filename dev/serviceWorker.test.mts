// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

// The worker as shipped, run against a fake browser: a cache that is a map of URLs, a
// network that can be cut, and the clients the worker asks about. Every strategy in
// public/sw.js is exercised by dispatching fetch events the way the browser would, so
// what a player gets with no network is asserted on the file the deploy ships rather
// than on a description of it.

const ORIGIN = "https://plinky.fun";
const SOURCE = readFileSync("public/sw.js", "utf8")
    .replace("__BUILD_HASH__", "test")
    .replace("__PRECACHE__", "/assets/entry-abc.js");

type Handler = (event: FetchEventLike) => void;
type FetchEventLike = {
    request: { url: string; method: string; mode: string };
    clientId: string;
    respondWith: (response: Promise<Response>) => void;
    waitUntil: (work: Promise<unknown>) => void;
};

type World = {
    fetchEvent: (path: string, mode: "navigate" | "cors", clientId?: string) => Promise<Response>;
    install: () => Promise<void>;
    network: { online: boolean; served: Map<string, string> };
    cache: Map<string, Response>;
    clients: Map<string, string>;
};

function makeWorld(): World {
    const cache = new Map<string, Response>();
    const network = { online: true, served: new Map<string, string>() };
    const clients = new Map<string, string>();
    const handlers: Record<
        string,
        Handler | ((event: { waitUntil: (p: Promise<unknown>) => void }) => void)
    > = {};
    const keyOf = (request: { url: string } | string) =>
        typeof request === "string" ? new URL(request, ORIGIN).href : request.url;
    const fetch = async (request: { url: string } | string) => {
        const url = keyOf(request);
        if (!network.online) {
            throw new TypeError("Failed to fetch");
        }
        const body = network.served.get(new URL(url).pathname);
        return body === undefined
            ? new Response("not found", { status: 404 })
            : new Response(body, { status: 200 });
    };
    const cacheApi = {
        async add(url: string) {
            const response = await fetch(url);
            if (response.ok) {
                cache.set(keyOf(url), response);
            }
        },
        async put(request: { url: string }, response: Response) {
            cache.set(keyOf(request), response);
        },
        async match(request: { url: string } | string) {
            return cache.get(keyOf(request))?.clone();
        },
        async keys() {
            return [...cache.keys()].map((url) => ({ url }));
        },
    };
    const self = {
        location: { origin: ORIGIN },
        addEventListener(type: string, handler: Handler) {
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
            async open() {
                return cacheApi;
            },
            async keys() {
                return ["plinky-test"];
            },
            async delete() {
                return true;
            },
            match: cacheApi.match,
        },
        fetch,
        Response,
        URL,
        Date,
        Promise,
        console,
    });
    vm.runInContext(SOURCE, context);
    return {
        network,
        cache,
        clients,
        async install() {
            let pending: Promise<unknown> = Promise.resolve();
            (handlers.install as (event: { waitUntil: (p: Promise<unknown>) => void }) => void)({
                waitUntil: (work) => {
                    pending = work;
                },
            });
            await pending;
        },
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
        expect(world.cache.has(`${ORIGIN}/offline.html`)).toBe(true);
        expect(world.cache.has(`${ORIGIN}/assets/entry-abc.js`)).toBe(true);
    });

    it("serves a hashed asset from the cache once fetched", async () => {
        world.network.served.set("/assets/play-123.js", "play");
        await world.fetchEvent("/assets/play-123.js", "cors");
        world.network.online = false;
        expect(await (await world.fetchEvent("/assets/play-123.js", "cors")).text()).toBe("play");
    });
});
