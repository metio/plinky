// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Fetcher } from "../ports/fetcher";
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
