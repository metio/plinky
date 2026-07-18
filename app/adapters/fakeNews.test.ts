// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { fakeNews } from "./fakeNews";

const item = {
    id: "n1",
    imageUrl: "https://cdn.example.com/pic.png",
    imageAlt: "A promo",
    linkUrl: "https://example.com",
};

describe("fakeNews", () => {
    it("wraps a single item in a list", async () => {
        expect(await fakeNews(item).fetchActive()).toEqual([item]);
    });

    it("passes a list through unchanged", async () => {
        const second = { ...item, id: "n2" };
        expect(await fakeNews([item, second]).fetchActive()).toEqual([item, second]);
    });

    it("resolves to an empty list by default", async () => {
        expect(await fakeNews().fetchActive()).toEqual([]);
    });
});
