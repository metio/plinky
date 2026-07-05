// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import type { Fetcher } from "../ports/fetcher";
import { createFavoritesStore } from "./favoritesStore";
import { createSongSource, type SongSource } from "./songSource";

// The source takes its fetcher and stores as lambdas and fakes, so a canned
// response and a memory store replace a whole mock server and browser.
const failing: Fetcher = () => Promise.resolve(new Response(null, { status: 500 }));

const sourceOver = (fetchUrl: Fetcher, kv = memoryStore()): SongSource =>
    createSongSource(fetchUrl, kv, createFavoritesStore(kv));

describe("songSource.manifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        expect(await sourceOver(failing).manifest()).toEqual([]);
    });

    it("caches the manifest for the session", async () => {
        let fetches = 0;
        const source = sourceOver(() => {
            fetches++;
            return Promise.resolve(Response.json([]));
        });
        await source.manifest();
        await source.manifest();
        expect(fetches).toBe(1);
    });

    it("shares one request across concurrent first-render callers", async () => {
        let fetches = 0;
        const source = sourceOver(() => {
            fetches++;
            return Promise.resolve(Response.json([{ id: "s1" }]));
        });
        // Both callers hit an empty cache before the first fetch resolves; they must
        // await the same in-flight request, not each start their own.
        const [a, b] = await Promise.all([source.manifest(), source.manifest()]);
        expect(fetches).toBe(1);
        expect(a).toEqual(b);
    });

    it("retries after a failure instead of caching an empty catalogue for the session", async () => {
        let calls = 0;
        const source = sourceOver(() => {
            calls++;
            return calls === 1
                ? Promise.reject(new TypeError("network down"))
                : Promise.resolve(Response.json([{ id: "s1" }]));
        });
        expect(await source.manifest()).toEqual([]);
        expect((await source.manifest())[0]?.id).toBe("s1");
        // The recovered manifest is cached like any completed one.
        await source.manifest();
        expect(calls).toBe(2);
    });

    it("drops manifest rows without a usable id", async () => {
        const source = sourceOver(() =>
            Promise.resolve(Response.json([{ id: "ok" }, null, "junk"])),
        );
        expect((await source.manifest()).map((song) => song.id)).toEqual(["ok"]);
    });
});

describe("songSource.ensureSeeded", () => {
    const seedFetcher =
        (counter: { fetches: number }): Fetcher =>
        (url) => {
            if (url.endsWith("seed.json")) {
                counter.fetches++;
                return Promise.resolve(Response.json(["s1", "s2"]));
            }
            return Promise.resolve(new Response(null, { status: 404 }));
        };

    it("stars the seed songs once and is idempotent", async () => {
        const counter = { fetches: 0 };
        const kv = memoryStore();
        const favorites = createFavoritesStore(kv);
        const source = createSongSource(seedFetcher(counter), kv, favorites);
        await source.ensureSeeded();
        expect([...favorites.load()].sort()).toEqual(["s1", "s2"]);
        await source.ensureSeeded();
        // The second call short-circuits on its persisted flag — no re-fetch.
        expect(counter.fetches).toBe(1);
    });

    it("writes the seed through the injected favorites store, not a global one", async () => {
        // Two fully isolated worlds over two memory stores: seeding one must not
        // leak into the other — the injected-persistence contract end to end.
        const counter = { fetches: 0 };
        const kvA = memoryStore();
        const favoritesA = createFavoritesStore(kvA);
        const kvB = memoryStore();
        const favoritesB = createFavoritesStore(kvB);
        await createSongSource(seedFetcher(counter), kvA, favoritesA).ensureSeeded();
        expect(favoritesA.load().size).toBe(2);
        expect(favoritesB.load().size).toBe(0);
        expect(kvB.keys()).toEqual([]);
    });

    it("keeps a song the user already starred instead of un-starring it", async () => {
        const counter = { fetches: 0 };
        const kv = memoryStore();
        const favorites = createFavoritesStore(kv);
        favorites.toggle("s1");
        await createSongSource(seedFetcher(counter), kv, favorites).ensureSeeded();
        // Seeding tops up what's missing; the pre-starred song stays starred.
        expect([...favorites.load()].sort()).toEqual(["s1", "s2"]);
    });

    it("does no network work when the seeded flag can't persist", async () => {
        let fetches = 0;
        const kv = { ...memoryStore(), set: () => false };
        const source = createSongSource(
            () => {
                fetches++;
                return Promise.resolve(Response.json([]));
            },
            kv,
            createFavoritesStore(kv),
        );
        await source.ensureSeeded();
        expect(fetches).toBe(0);
    });
});
