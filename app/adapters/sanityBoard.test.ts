// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { createSanityBoard, type SanityBoardConfig } from "./sanityBoard";

const config: SanityBoardConfig = {
    projectId: "abc123",
    dataset: "production",
    apiVersion: "2024-01-01",
    query: "*",
};

const artist = {
    id: "a1",
    name: "Ada Keys",
    order: 1,
    text: "Plays a nocturne a day.",
    imageUrl: "https://cdn.sanity.io/ada.png",
    imageAlt: "Ada at the piano",
    linkUrl: "https://www.instagram.com/adakeys",
};

function jsonResponse(result: unknown, ok = true): Response {
    return new Response(JSON.stringify({ result }), { status: ok ? 200 : 500 });
}

describe("createSanityBoard", () => {
    it("maps a Sanity query result into board artists", async () => {
        const source = createSanityBoard(async () => jsonResponse([artist]), config);
        expect(await source.fetchArtists("en")).toEqual([artist]);
    });

    it("skips malformed entries in the result", async () => {
        const source = createSanityBoard(
            async () => jsonResponse([artist, { id: "", name: "x", text: "x" }]),
            config,
        );
        expect(await source.fetchArtists("en")).toHaveLength(1);
    });

    it("passes the requested language as the $lang query parameter", async () => {
        let requested = "";
        const fetcher = async (url: string) => {
            requested = url;
            return jsonResponse([artist]);
        };
        await createSanityBoard(fetcher, config).fetchArtists("de");
        expect(requested).toContain(
            "https://abc123.apicdn.sanity.io/v2024-01-01/data/query/production",
        );
        expect(requested).toContain(`${encodeURIComponent('"de"')}`);
    });

    it("reads past the browser cache so a published edit is never stale", async () => {
        let init: RequestInit | undefined;
        const fetcher = async (_url: string, requestInit?: RequestInit) => {
            init = requestInit;
            return jsonResponse([artist]);
        };
        await createSanityBoard(fetcher, config).fetchArtists("en");
        expect(init?.cache).toBe("no-store");
    });

    it("returns empty without fetching when no project is configured", async () => {
        let called = false;
        const fetcher = async () => {
            called = true;
            return jsonResponse([artist]);
        };
        expect(await createSanityBoard(fetcher, null).fetchArtists("en")).toEqual([]);
        expect(called).toBe(false);
    });

    it("returns empty on a non-OK response or a thrown fetch", async () => {
        const notOk = createSanityBoard(async () => jsonResponse([artist], false), config);
        expect(await notOk.fetchArtists("en")).toEqual([]);
        const throws = createSanityBoard(async () => {
            throw new Error("offline");
        }, config);
        expect(await throws.fetchArtists("en")).toEqual([]);
    });
});
