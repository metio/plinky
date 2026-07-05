// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isHttpsUrl, parseNews } from "./news";

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

    it("rejects http, data, javascript, and unparseable URLs", () => {
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

    it("keeps an optional headline and aspect", () => {
        const item = parseNews({ ...valid, headline: "Big update", aspect: 2 });
        expect(item?.headline).toBe("Big update");
        expect(item?.aspect).toBe(2);
    });

    it("drops a blank headline and a non-positive aspect", () => {
        const item = parseNews({ ...valid, headline: "   ", aspect: 0 });
        expect(item?.headline).toBeUndefined();
        expect(item?.aspect).toBeUndefined();
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
