// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeNews } from "../../adapters/fakeNews";
import { m } from "../../paraglide/messages.js";
import { advanceScheduler } from "../../testing/advanceScheduler";
import { fakeScheduler } from "../../testing/fakeScheduler";
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

const first = { ...item, id: "a", imageAlt: "First", headline: "First update" };
const second = { ...item, id: "b", imageAlt: "Second", headline: "Second update" };
const third = { ...item, id: "c", imageAlt: "Third", headline: "Third update" };

// The interval baked into the banner; a test advances the virtual clock by it to
// cross exactly one auto-rotation.
const ROTATE_MS = 7000;

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
        fireEvent.click(screen.getByRole("button", { name: m.action_dismiss() }));
        expect(screen.queryByAltText("A promo picture")).toBeNull();
        expect(services.hints.seen("news:n1")).toBe(true);
    });

    it("shows no carousel controls for a single item", async () => {
        renderWithServices(<NewsBanner />, { news: fakeNews(item) });
        await screen.findByAltText("A promo picture");
        expect(screen.queryByRole("button", { name: m.news_next() })).toBeNull();
        expect(screen.queryByRole("button", { name: m.news_previous() })).toBeNull();
    });

    it("auto-advances to the next item after the interval", async () => {
        const scheduler = fakeScheduler();
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]), scheduler });
        await screen.findByAltText("First");
        await advanceScheduler(scheduler, ROTATE_MS);
        expect(screen.queryByAltText("Second")).not.toBeNull();
        expect(screen.queryByAltText("First")).toBeNull();
    });

    it("wraps back to the first item after the last", async () => {
        const scheduler = fakeScheduler();
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]), scheduler });
        await screen.findByAltText("First");
        await advanceScheduler(scheduler, ROTATE_MS * 2);
        // Two intervals: forward to the second item and wrap back to the first.
        expect(screen.queryByAltText("First")).not.toBeNull();
        expect(screen.queryByAltText("Second")).toBeNull();
    });

    it("stops auto-advancing once the reader navigates by chevron", async () => {
        const scheduler = fakeScheduler();
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]), scheduler });
        await screen.findByAltText("First");
        fireEvent.click(screen.getByRole("button", { name: m.news_next() }));
        expect(screen.queryByAltText("Second")).not.toBeNull();
        // The clock keeps ticking, but the reader took over — nothing moves.
        await advanceScheduler(scheduler, ROTATE_MS * 3);
        expect(screen.queryByAltText("Second")).not.toBeNull();
        expect(screen.queryByAltText("First")).toBeNull();
    });

    it("a position dot jumps straight to its item and marks it current", async () => {
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second, third]) });
        await screen.findByAltText("First");
        fireEvent.click(screen.getByRole("button", { name: m.news_go_to({ position: 3 }) }));
        expect(screen.queryByAltText("Third")).not.toBeNull();
        const activeDot = screen.getByRole("button", { name: m.news_go_to({ position: 3 }) });
        expect(activeDot.getAttribute("aria-current")).toBe("true");
    });

    it("navigates on a horizontal swipe without following the link", async () => {
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]) });
        const img = await screen.findByAltText("First");
        const media = img.closest("div");
        if (!media) {
            throw new Error("media region missing");
        }
        fireEvent.pointerDown(media, { clientX: 200 });
        fireEvent.pointerUp(media, { clientX: 120 });
        expect(screen.queryByAltText("Second")).not.toBeNull();
    });

    it("ignores a tap that barely moves as a swipe", async () => {
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]) });
        const img = await screen.findByAltText("First");
        const media = img.closest("div");
        if (!media) {
            throw new Error("media region missing");
        }
        fireEvent.pointerDown(media, { clientX: 200 });
        fireEvent.pointerUp(media, { clientX: 195 });
        expect(screen.queryByAltText("First")).not.toBeNull();
    });

    it("holds one fixed aspect ratio across items, so a rotation never resizes the box", async () => {
        // The box is a fixed 16:9 for every item, so switching between pictures never
        // resizes it (the page-jump / CLS the reader hit) whatever their own shapes.
        const scheduler = fakeScheduler();
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]), scheduler });
        const box = (await screen.findByAltText("First")).closest("div");
        expect(box?.style.aspectRatio).toBe("16 / 9");
        await advanceScheduler(scheduler, ROTATE_MS);
        const next = (await screen.findByAltText("Second")).closest("div");
        expect(next?.style.aspectRatio).toBe("16 / 9");
    });

    it("dismissing the current item reveals the next one", async () => {
        renderWithServices(<NewsBanner />, { news: fakeNews([first, second]) });
        await screen.findByAltText("First");
        fireEvent.click(screen.getByRole("button", { name: m.action_dismiss() }));
        expect(screen.queryByAltText("First")).toBeNull();
        expect(screen.queryByAltText("Second")).not.toBeNull();
    });
});
