// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { createSanityHelp, type SanityHelpConfig } from "./sanityHelp";

const config: SanityHelpConfig = {
    projectId: "abc123",
    dataset: "production",
    apiVersion: "2024-01-01",
    query: "*",
};

const item = {
    id: "h1",
    pageKey: "play",
    order: 1,
    text: "Press a key to play the note.",
    imageUrl: "https://cdn.sanity.io/play.png",
    imageAlt: "The play screen",
    linkUrl: "https://plinky.fun",
};

function jsonResponse(result: unknown, ok = true): Response {
    return new Response(JSON.stringify({ result }), { status: ok ? 200 : 500 });
}

describe("createSanityHelp", () => {
    it("maps a Sanity query result into help items", async () => {
        const source = createSanityHelp(async () => jsonResponse([item]), config);
        expect(await source.fetchItems("en")).toEqual([item]);
    });

    it("skips malformed items in the result", async () => {
        const source = createSanityHelp(
            async () => jsonResponse([item, { id: "", pageKey: "play", text: "x" }]),
            config,
        );
        expect(await source.fetchItems("en")).toHaveLength(1);
    });

    it("passes the requested language as the $lang query parameter", async () => {
        let requested = "";
        const fetcher = async (url: string) => {
            requested = url;
            return jsonResponse([item]);
        };
        await createSanityHelp(fetcher, config).fetchItems("de");
        expect(requested).toContain(
            "https://abc123.apicdn.sanity.io/v2024-01-01/data/query/production",
        );
        expect(requested).toContain(`${encodeURIComponent('"de"')}`);
    });

    it("reads past the browser cache so a published edit is never stale", async () => {
        let init: RequestInit | undefined;
        const fetcher = async (_url: string, requestInit?: RequestInit) => {
            init = requestInit;
            return jsonResponse([item]);
        };
        await createSanityHelp(fetcher, config).fetchItems("en");
        expect(init?.cache).toBe("no-store");
    });

    it("returns empty without fetching when no project is configured", async () => {
        let called = false;
        const fetcher = async () => {
            called = true;
            return jsonResponse([item]);
        };
        expect(await createSanityHelp(fetcher, null).fetchItems("en")).toEqual([]);
        expect(called).toBe(false);
    });

    it("returns empty on a non-OK response or a thrown fetch", async () => {
        const notOk = createSanityHelp(async () => jsonResponse([item], false), config);
        expect(await notOk.fetchItems("en")).toEqual([]);
        const throws = createSanityHelp(async () => {
            throw new Error("offline");
        }, config);
        expect(await throws.fetchItems("en")).toEqual([]);
    });
});
