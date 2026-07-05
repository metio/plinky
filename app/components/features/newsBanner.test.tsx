// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeNews } from "../../adapters/fakeNews";
import { renderWithServices } from "../../testing/renderWithServices";
import { NewsBanner } from "./newsBanner";

afterEach(cleanup);

const item = {
    id: "n1",
    imageUrl: "https://cdn.example.com/pic.png",
    imageAlt: "A promo picture",
    linkUrl: "https://example.com/news",
    headline: "Big update",
};

describe("NewsBanner", () => {
    it("renders the published picture as a link", async () => {
        renderWithServices(<NewsBanner />, { news: fakeNews(item) });
        const img = await screen.findByAltText("A promo picture");
        expect(img.getAttribute("src")).toBe(item.imageUrl);
        expect(img.closest("a")?.getAttribute("href")).toBe(item.linkUrl);
        expect(screen.queryByText("Big update")).not.toBeNull();
    });

    it("renders nothing when no item is live", () => {
        const { container } = renderWithServices(<NewsBanner />, { news: fakeNews(null) });
        expect(container.childElementCount).toBe(0);
    });

    it("dismisses the item and remembers it by id", async () => {
        const { services } = renderWithServices(<NewsBanner />, { news: fakeNews(item) });
        await screen.findByAltText("A promo picture");
        fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
        expect(screen.queryByAltText("A promo picture")).toBeNull();
        expect(services.hints.seen("news:n1")).toBe(true);
    });
});
