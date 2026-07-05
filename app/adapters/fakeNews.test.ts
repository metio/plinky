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
    it("resolves to the given item", async () => {
        expect(await fakeNews(item).fetchActive()).toEqual(item);
    });

    it("resolves to null by default", async () => {
        expect(await fakeNews().fetchActive()).toBeNull();
    });
});
