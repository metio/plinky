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

function jsonResponse(body: unknown, ok = true): Response {
    return new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
}

describe("createSanityNews", () => {
    it("maps a Sanity query result into a NewsItem", async () => {
        const source = createSanityNews(async () => jsonResponse({ result: item }), config);
        expect(await source.fetchActive()).toEqual(item);
    });

    it("builds the apicdn query URL from the config", async () => {
        let requested = "";
        const fetcher = async (url: string) => {
            requested = url;
            return jsonResponse({ result: item });
        };
        await createSanityNews(fetcher, config).fetchActive();
        expect(requested).toContain(
            "https://abc123.apicdn.sanity.io/v2024-01-01/data/query/production",
        );
    });

    it("returns null without fetching when no project is configured", async () => {
        let called = false;
        const fetcher = async () => {
            called = true;
            return jsonResponse({ result: item });
        };
        expect(await createSanityNews(fetcher, null).fetchActive()).toBeNull();
        expect(called).toBe(false);
    });

    it("returns null on a non-OK response", async () => {
        const source = createSanityNews(async () => jsonResponse({ result: item }, false), config);
        expect(await source.fetchActive()).toBeNull();
    });

    it("returns null on an unsafe or empty result", async () => {
        const httpImage = { ...item, imageUrl: "http://cdn.sanity.io/pic.png" };
        const unsafe = createSanityNews(async () => jsonResponse({ result: httpImage }), config);
        expect(await unsafe.fetchActive()).toBeNull();
        const empty = createSanityNews(async () => jsonResponse({ result: null }), config);
        expect(await empty.fetchActive()).toBeNull();
    });

    it("returns null when the fetch throws", async () => {
        const source = createSanityNews(async () => {
            throw new Error("offline");
        }, config);
        expect(await source.fetchActive()).toBeNull();
    });
});
