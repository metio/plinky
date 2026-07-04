// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { browserStore } from "../adapters/browserStore";
import { memoryStore } from "../adapters/memoryStore";
import { loadFavorites } from "../lib/favorites";
import type { Fetcher } from "../ports/fetcher";
import { createSongSource } from "./songSource";

// The source takes its fetcher as a lambda, so a canned-response fake replaces
// a whole mock server.
const failing: Fetcher = () => Promise.resolve(new Response(null, { status: 500 }));

afterEach(() => localStorage.clear());

describe("songSource.manifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        const source = createSongSource(failing, memoryStore());
        expect(await source.manifest()).toEqual([]);
    });

    it("caches the manifest for the session", async () => {
        let fetches = 0;
        const source = createSongSource(() => {
            fetches++;
            return Promise.resolve(Response.json([]));
        }, memoryStore());
        await source.manifest();
        await source.manifest();
        expect(fetches).toBe(1);
    });
});

describe("songSource.ensureSeeded", () => {
    it("stars the seed songs once and is idempotent", async () => {
        let seedFetches = 0;
        const source = createSongSource((url) => {
            if (url.endsWith("seed.json")) {
                seedFetches++;
                return Promise.resolve(Response.json(["s1", "s2"]));
            }
            return Promise.resolve(new Response(null, { status: 404 }));
        }, browserStore);
        await source.ensureSeeded();
        expect([...loadFavorites()].sort()).toEqual(["s1", "s2"]);
        await source.ensureSeeded();
        // The second call short-circuits on its persisted flag — no re-fetch.
        expect(seedFetches).toBe(1);
    });

    it("does no network work when the seeded flag can't persist", async () => {
        let fetches = 0;
        const refusing = { ...memoryStore(), set: () => false };
        const source = createSongSource(() => {
            fetches++;
            return Promise.resolve(Response.json([]));
        }, refusing);
        await source.ensureSeeded();
        expect(fetches).toBe(0);
    });
});
