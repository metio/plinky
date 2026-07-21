// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    croppedImageUrl,
    DEFAULT_NEWS_ASPECT,
    imageAspect,
    isHttpsUrl,
    parseNews,
    parseNewsList,
} from "./news";

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

describe("croppedImageUrl", () => {
    const url = "https://cdn.example.com/pic.jpg";
    const dimensions = { width: 1000, height: 1000 };

    it("bakes a Studio crop into a server-side rect", () => {
        const crop = { top: 0.1, bottom: 0.2, left: 0.1, right: 0.1 };
        // x = 0.1*1000, y = 0.1*1000, w = (1-0.1-0.1)*1000, h = (1-0.1-0.2)*1000.
        expect(croppedImageUrl(url, crop, dimensions)).toBe(`${url}?rect=100,100,800,700`);
    });

    it("joins the rect with & when the URL already has a query", () => {
        const crop = { top: 0, bottom: 0, left: 0.2, right: 0 };
        expect(croppedImageUrl(`${url}?w=800`, crop, dimensions)).toBe(
            `${url}?w=800&rect=200,0,800,1000`,
        );
    });

    it("leaves the URL alone when there is no crop to apply", () => {
        expect(croppedImageUrl(url, null, dimensions)).toBe(url);
        expect(croppedImageUrl(url, undefined, undefined)).toBe(url);
        // The Studio default is an all-zero crop — nothing to trim.
        expect(croppedImageUrl(url, { top: 0, bottom: 0, left: 0, right: 0 }, dimensions)).toBe(url);
    });

    it("ignores a malformed crop or degenerate dimensions", () => {
        expect(croppedImageUrl(url, { top: 0.1 }, dimensions)).toBe(url);
        expect(croppedImageUrl(url, { top: -0.1, bottom: 0, left: 0, right: 0 }, dimensions)).toBe(
            url,
        );
        // An over-trim that leaves no image can't produce a valid rect.
        expect(croppedImageUrl(url, { top: 0.6, bottom: 0.6, left: 0, right: 0 }, dimensions)).toBe(
            url,
        );
        expect(
            croppedImageUrl(url, { top: 0, bottom: 0, left: 0.2, right: 0 }, { width: 0, height: 0 }),
        ).toBe(url);
    });
});

describe("imageAspect", () => {
    it("takes the cropped shape when a crop applies, not the padded original", () => {
        // A 16:9 asset with 10% trimmed off each side is 3200x1800 visible -> 16:9 is
        // gone; the trimmed region is (1-0.2)*3200 = 2560 wide, 1800 tall = 1.422.
        const aspect = imageAspect(
            { top: 0, bottom: 0, left: 0.1, right: 0.1 },
            { width: 3200, height: 1800 },
        );
        expect(aspect).toBeCloseTo(2560 / 1800, 5);
    });

    it("falls back to the whole asset's shape without a crop", () => {
        expect(imageAspect(null, { width: 1600, height: 900 })).toBeCloseTo(16 / 9, 5);
        expect(imageAspect({ top: 0, bottom: 0, left: 0, right: 0 }, { width: 1000, height: 500 })).toBe(
            2,
        );
    });

    it("is null when the dimensions are missing, so the caller keeps its default", () => {
        expect(imageAspect(null, null)).toBeNull();
        expect(imageAspect({ top: 0, bottom: 0, left: 0.1, right: 0.1 }, undefined)).toBeNull();
    });
});

describe("parseNews", () => {
    it("accepts a complete, safe payload, defaulting to a 16:9 box", () => {
        expect(parseNews(valid)).toEqual({ ...valid, aspect: DEFAULT_NEWS_ASPECT });
    });

    it("bakes an image's Studio crop into the served URL and the box shape", () => {
        const item = parseNews({
            ...valid,
            crop: { top: 0, bottom: 0, left: 0.1, right: 0.1 },
            dimensions: { width: 2000, height: 1000 },
        });
        expect(item?.imageUrl).toBe(`${valid.imageUrl}?rect=200,0,1600,1000`);
        // The box hugs the cropped 1600x1000, not the padded 2000x1000.
        expect(item?.aspect).toBeCloseTo(1.6, 5);
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
