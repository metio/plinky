// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { itemsForPage, paragraphs, parseHelp, parseHelpItem } from "./help";

const raw = {
    id: "h1",
    pageKey: "play",
    order: 2,
    text: "Press a key to play the note under the cursor.",
    imageUrl: "https://cdn.sanity.io/play.png",
    imageAlt: "The play screen",
    linkUrl: "https://plinky.fun/en/play",
};

describe("parseHelpItem", () => {
    it("maps a well-formed raw entry", () => {
        expect(parseHelpItem(raw)).toEqual(raw);
    });

    it("rejects an entry missing id, pageKey, or text", () => {
        expect(parseHelpItem({ ...raw, id: "" })).toBeNull();
        expect(parseHelpItem({ ...raw, pageKey: "  " })).toBeNull();
        expect(parseHelpItem({ ...raw, text: "" })).toBeNull();
        expect(parseHelpItem(null)).toBeNull();
    });

    it("defaults a missing or non-finite order to 0", () => {
        expect(parseHelpItem({ ...raw, order: undefined })?.order).toBe(0);
        expect(parseHelpItem({ ...raw, order: Number.NaN })?.order).toBe(0);
    });

    it("keeps the item but drops an unsafe image or link URL", () => {
        const item = parseHelpItem({
            ...raw,
            imageUrl: "http://cdn.sanity.io/play.png",
            linkUrl: "javascript:alert(1)",
        });
        expect(item?.text).toBe(raw.text);
        expect(item?.imageUrl).toBeUndefined();
        expect(item?.imageAlt).toBeUndefined();
        expect(item?.linkUrl).toBeUndefined();
    });

    it("defaults alt to an empty string when the image is present but alt is missing", () => {
        const item = parseHelpItem({ ...raw, imageAlt: undefined });
        expect(item?.imageUrl).toBe(raw.imageUrl);
        expect(item?.imageAlt).toBe("");
    });
});

describe("parseHelp", () => {
    it("keeps well-formed entries and skips the rest", () => {
        const items = parseHelp([raw, { id: "", pageKey: "play", text: "x" }, 7, null]);
        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe("h1");
    });

    it("returns an empty list for a non-array", () => {
        expect(parseHelp(null)).toEqual([]);
        expect(parseHelp({})).toEqual([]);
    });
});

describe("itemsForPage", () => {
    it("returns only the page's items, sorted by order", () => {
        const items = parseHelp([
            { id: "b", pageKey: "play", order: 3, text: "third" },
            { id: "a", pageKey: "play", order: 1, text: "first" },
            { id: "x", pageKey: "home", order: 1, text: "other" },
        ]);
        expect(itemsForPage(items, "play").map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("is a stable sort — equal orders hold arrival order", () => {
        const items = parseHelp([
            { id: "first", pageKey: "home", order: 0, text: "a" },
            { id: "second", pageKey: "home", order: 0, text: "b" },
        ]);
        expect(itemsForPage(items, "home").map((i) => i.id)).toEqual(["first", "second"]);
    });
});

describe("paragraphs", () => {
    it("splits on blank lines, trims, and drops empties", () => {
        expect(paragraphs("one\n\ntwo\n\n\n  three  ")).toEqual(["one", "two", "three"]);
    });

    it("keeps a single-newline block as one paragraph", () => {
        expect(paragraphs("line one\nline two")).toEqual(["line one\nline two"]);
    });
});
