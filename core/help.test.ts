// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type HelpItem, itemsForPage, paragraphs } from "./help";

const item = (over: Partial<HelpItem>): HelpItem => ({
    id: "h1",
    pageKey: "play",
    order: 0,
    text: "text",
    ...over,
});

describe("itemsForPage", () => {
    it("returns only the page's items, sorted by order", () => {
        const items = [
            item({ id: "b", pageKey: "play", order: 3 }),
            item({ id: "a", pageKey: "play", order: 1 }),
            item({ id: "x", pageKey: "home", order: 1 }),
        ];
        expect(itemsForPage(items, "play").map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("is a stable sort — equal orders hold arrival order", () => {
        const items = [
            item({ id: "first", pageKey: "home", order: 0 }),
            item({ id: "second", pageKey: "home", order: 0 }),
        ];
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
