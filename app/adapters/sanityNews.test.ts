// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { createSanityNews, type SanityConfig } from "./sanityNews";

const config: SanityConfig = {
    projectId: "abc123",
    dataset: "production",
    apiVersion: "2024-01-01",
    query: "*",
};

const item = {
    id: "n1",
    imageUrl: "https://cdn.sanity.io/pic.png",
    imageAlt: "A promo",
    linkUrl: "https://example.com/news",
};

const second = { ...item, id: "n2", linkUrl: "https://example.com/other" };

// The default query returns an { enabled, items } envelope: the master switch plus
// the shown news items, newest first.
function jsonResponse(result: unknown, ok = true): Response {
    return new Response(JSON.stringify({ result }), { status: ok ? 200 : 500 });
}

describe("createSanityNews", () => {
    it("maps a Sanity query result into a list of NewsItems", async () => {
        const source = createSanityNews(
            async () => jsonResponse({ enabled: true, items: [item, second] }),
            config,
        );
        expect(await source.fetchActive()).toEqual([item, second]);
    });

    it("shows news when no settings document exists (master switch absent)", async () => {
        const source = createSanityNews(
            async () => jsonResponse({ enabled: null, items: [item] }),
            config,
        );
        expect(await source.fetchActive()).toEqual([item]);
    });

    it("hides news when the master switch is off, even with valid items", async () => {
        const source = createSanityNews(
            async () => jsonResponse({ enabled: false, items: [item] }),
            config,
        );
        expect(await source.fetchActive()).toEqual([]);
    });

    it("builds the apicdn query URL from the config", async () => {
        let requested = "";
        const fetcher = async (url: string) => {
            requested = url;
            return jsonResponse({ enabled: true, items: [item] });
        };
        await createSanityNews(fetcher, config).fetchActive();
        expect(requested).toContain(
            "https://abc123.apicdn.sanity.io/v2024-01-01/data/query/production",
        );
    });

    it("reads past the browser cache, so a toggled banner is never served stale", async () => {
        let init: RequestInit | undefined;
        const fetcher = async (_url: string, requestInit?: RequestInit) => {
            init = requestInit;
            return jsonResponse({ enabled: true, items: [item] });
        };
        await createSanityNews(fetcher, config).fetchActive();
        expect(init?.cache).toBe("no-store");
    });

    it("returns an empty list without fetching when no project is configured", async () => {
        let called = false;
        const fetcher = async () => {
            called = true;
            return jsonResponse({ enabled: true, items: [item] });
        };
        expect(await createSanityNews(fetcher, null).fetchActive()).toEqual([]);
        expect(called).toBe(false);
    });

    it("returns an empty list on a non-OK response", async () => {
        const source = createSanityNews(
            async () => jsonResponse({ enabled: true, items: [item] }, false),
            config,
        );
        expect(await source.fetchActive()).toEqual([]);
    });

    it("drops unsafe items and keeps the safe ones", async () => {
        const httpImage = { ...item, id: "bad", imageUrl: "http://cdn.sanity.io/pic.png" };
        const source = createSanityNews(
            async () => jsonResponse({ enabled: true, items: [httpImage, second] }),
            config,
        );
        expect(await source.fetchActive()).toEqual([second]);
    });

    it("returns an empty list when items are missing or empty", async () => {
        const empty = createSanityNews(
            async () => jsonResponse({ enabled: true, items: [] }),
            config,
        );
        expect(await empty.fetchActive()).toEqual([]);
        const missing = createSanityNews(
            async () => jsonResponse({ enabled: true, items: null }),
            config,
        );
        expect(await missing.fetchActive()).toEqual([]);
    });

    it("returns an empty list when the fetch throws", async () => {
        const source = createSanityNews(async () => {
            throw new Error("offline");
        }, config);
        expect(await source.fetchActive()).toEqual([]);
    });
});
