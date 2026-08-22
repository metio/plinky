// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { Fetcher } from "../ports/fetcher";
import { shardName } from "../../core/catalogShard";
import { createSongSource, type SongSource } from "./songSource";

// The source takes its fetcher as a lambda, so a canned response replaces a
// whole mock server.
const failing: Fetcher = () => Promise.resolve(new Response(null, { status: 500 }));

const sourceOver = (fetchUrl: Fetcher): SongSource => createSongSource(fetchUrl);

describe("songSource.manifest", () => {
    it("signals an unfetchable manifest as null, not as an empty catalogue", async () => {
        expect(await sourceOver(failing).manifest()).toBeNull();
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
        expect(await source.manifest()).toBeNull();
        expect((await source.manifest())?.[0]?.id).toBe("s1");
        // The recovered manifest is cached like any completed one.
        await source.manifest();
        expect(calls).toBe(2);
    });

    it("drops manifest rows without a usable id", async () => {
        const source = sourceOver(() =>
            Promise.resolve(Response.json([{ id: "ok" }, null, "junk"])),
        );
        expect(((await source.manifest()) ?? []).map((song) => song.id)).toEqual(["ok"]);
    });
});

describe("songSource.resolve", () => {
    it("reads one piece's slice of the catalogue, never the whole of it", async () => {
        // The point of the slices: a piece's page waits on this before it can engrave a
        // note, and the full manifest is six hundred kilobytes to read one row of.
        const asked: string[] = [];
        const source = sourceOver((url) => {
            asked.push(url);
            return Promise.resolve(
                url.includes("/songs/index/")
                    ? Response.json([{ id: "s1", license: "CC0-1.0" }])
                    : new Response(null, { status: 500 }),
            );
        });
        await source.resolve("s1");
        expect(asked).toContain(`/songs/index/${shardName("s1")}.json`);
        expect(asked.some((url) => url.endsWith("/songs/manifest.json"))).toBe(false);
    });

    it("is null — not unavailable — for an id its slice loaded and does not hold", async () => {
        // A slice that answered is an answer: the piece is not in the catalogue, so the
        // caller should fall through to the bundled and imported scores rather than
        // reporting a network problem nobody had.
        const asked: string[] = [];
        const source = sourceOver((url) => {
            asked.push(url);
            return Promise.resolve(Response.json([]));
        });
        expect(await source.resolve("s1")).toBeNull();
        expect(asked.some((url) => url.endsWith("/songs/manifest.json"))).toBe(false);
    });

    it("falls back to the whole manifest when the slice cannot be fetched", async () => {
        // A deploy mid-session can leave a cached page asking for a slice that has moved,
        // and a real piece must never read as nonexistent because of it.
        const source = sourceOver((url) =>
            Promise.resolve(
                url.includes("/songs/index/")
                    ? new Response(null, { status: 404 })
                    : url.includes("manifest")
                      ? Response.json([{ id: "s1" }])
                      : new Response(null, { status: 500 }),
            ),
        );
        // Found in the manifest, so the failure it reports is the .mxl's, not "no such
        // piece" — which is the whole distinction the fallback protects.
        expect(await source.resolve("s1")).toBe("unavailable");
    });

    it("is null for an id a loaded manifest does not know", async () => {
        const source = sourceOver(() => Promise.resolve(Response.json([])));
        expect(await source.resolve("no-such-song")).toBeNull();
    });

    it("is unavailable when the manifest cannot be fetched", async () => {
        expect(await sourceOver(failing).resolve("s1")).toBe("unavailable");
    });

    it("is unavailable when the song's .mxl cannot be fetched", async () => {
        const source = sourceOver((url) =>
            Promise.resolve(
                url.includes("manifest")
                    ? Response.json([{ id: "s1" }])
                    : new Response(null, { status: 500 }),
            ),
        );
        expect(await source.resolve("s1")).toBe("unavailable");
    });
});
