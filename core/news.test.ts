// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isHttpsUrl, parseNews, parseNewsList } from "./news";

const valid = {
    id: "n1",
    imageUrl: "https://cdn.example.com/pic.png",
    imageAlt: "A promo picture",
    linkUrl: "https://example.com/news",
};

describe("isHttpsUrl", () => {
    it("accepts a well-formed https URL", () => {
        expect(isHttpsUrl("https://example.com/a.png")).toBe(true);
    });

    it("rejects http, data, javascript, and unparsable URLs", () => {
        expect(isHttpsUrl("http://example.com")).toBe(false);
        expect(isHttpsUrl("data:image/png;base64,AAAA")).toBe(false);
        expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
        expect(isHttpsUrl("not a url")).toBe(false);
        expect(isHttpsUrl(42)).toBe(false);
    });
});

describe("parseNews", () => {
    it("accepts a complete, safe payload", () => {
        expect(parseNews(valid)).toEqual(valid);
    });

    it("keeps an optional headline", () => {
        expect(parseNews({ ...valid, headline: "Big update" })?.headline).toBe("Big update");
    });

    it("drops a blank headline", () => {
        expect(parseNews({ ...valid, headline: "   " })?.headline).toBeUndefined();
    });

    it("rejects a non-https image or link", () => {
        expect(parseNews({ ...valid, imageUrl: "http://cdn.example.com/pic.png" })).toBeNull();
        expect(parseNews({ ...valid, linkUrl: "javascript:alert(1)" })).toBeNull();
    });

    it("requires a non-empty id and alt text", () => {
        expect(parseNews({ ...valid, id: "" })).toBeNull();
        expect(parseNews({ ...valid, imageAlt: "  " })).toBeNull();
    });

    it("rejects non-objects", () => {
        expect(parseNews(null)).toBeNull();
        expect(parseNews("news")).toBeNull();
        expect(parseNews(undefined)).toBeNull();
    });
});

describe("parseNewsList", () => {
    it("keeps the safe items in order and drops the unsafe ones", () => {
        const list = parseNewsList([
            { ...valid, id: "a" },
            { ...valid, id: "b", imageUrl: "http://cdn.example.com/x.png" },
            { ...valid, id: "c" },
        ]);
        expect(list.map((item) => item.id)).toEqual(["a", "c"]);
    });

    it("caps the list to the given maximum, taking the first safe items", () => {
        const raw = Array.from({ length: 5 }, (_, i) => ({ ...valid, id: `n${i}` }));
        expect(parseNewsList(raw, 3).map((item) => item.id)).toEqual(["n0", "n1", "n2"]);
    });

    it("returns an empty list for a non-array payload", () => {
        expect(parseNewsList(null)).toEqual([]);
        expect(parseNewsList(valid)).toEqual([]);
        expect(parseNewsList("news")).toEqual([]);
    });
});
