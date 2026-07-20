// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { httpFetcher } from "../../adapters/httpFetcher";
import { createSanityNews } from "../../adapters/sanityNews";
import type { SanityConfig } from "../../adapters/sanity";
import { m } from "../../paraglide/messages.js";
import { server } from "../../test-setup.node";
import { fakeScheduler } from "../../testing/fakeScheduler";
import { renderWithServices } from "../../testing/renderWithServices";
import { NewsBanner } from "./newsBanner";

afterEach(cleanup);

// The whole pipeline against a mocked Sanity API: the banner renders through the
// real Sanity adapter and the real fetcher, with Mock Service Worker answering at
// the network layer.
const config: SanityConfig = {
    projectId: "testproj",
    dataset: "production",
    apiVersion: "2024-01-01",
    query: "*",
};

const QUERY_URL = "https://testproj.apicdn.sanity.io/v2024-01-01/data/query/production";

const news = { news: createSanityNews(httpFetcher, config) };

const item = {
    id: "n1",
    imageUrl: "https://cdn.sanity.io/images/news.png",
    imageAlt: "A new piece",
    linkUrl: "https://plinky.fun/en/library",
    headline: "New pieces this week",
};

describe("NewsBanner against a mocked Sanity API", () => {
    it("shows the published item as a linked picture with its headline", async () => {
        server.use(http.get(QUERY_URL, () => HttpResponse.json({ result: { items: [item] } })));
        renderWithServices(<NewsBanner />, news);
        const img = await screen.findByAltText("A new piece");
        expect(img.getAttribute("src")).toBe(item.imageUrl);
        expect(img.closest("a")?.getAttribute("href")).toBe(item.linkUrl);
        expect(screen.getByText("New pieces this week")).toBeTruthy();
    });

    it("renders nothing when the master switch is off", async () => {
        server.use(
            http.get(QUERY_URL, () =>
                HttpResponse.json({ result: { enabled: false, items: [item] } }),
            ),
        );
        const { container } = renderWithServices(<NewsBanner />, news);
        // Give the fetch a beat; the banner must stay absent, not flash in.
        await waitFor(() => expect(container.querySelector("section")).toBeNull());
        expect(screen.queryByAltText("A new piece")).toBeNull();
    });

    it("renders nothing when the API errors", async () => {
        server.use(http.get(QUERY_URL, () => new HttpResponse(null, { status: 500 })));
        const { container } = renderWithServices(<NewsBanner />, news);
        await waitFor(() => expect(container.querySelector("section")).toBeNull());
    });

    it("rotates through several published items and hands control to the reader", async () => {
        const second = {
            ...item,
            id: "n2",
            imageUrl: "https://cdn.sanity.io/images/two.png",
            imageAlt: "Another piece",
            headline: "One more this week",
        };
        server.use(
            http.get(QUERY_URL, () => HttpResponse.json({ result: { items: [item, second] } })),
        );
        const scheduler = fakeScheduler();
        renderWithServices(<NewsBanner />, { ...news, scheduler });
        await screen.findByAltText("A new piece");
        // The auto-advance timer is armed in a passive effect once the items load;
        // flush that effect before driving the clock, or the advance can cross an
        // interval that was never armed and nothing rotates (a full-suite flake).
        await act(async () => {});
        // It advances on its own...
        act(() => scheduler.advance(7000));
        expect(screen.queryByAltText("Another piece")).not.toBeNull();
        // ...until the reader steps back, after which the clock no longer moves it.
        act(() => void screen.getByRole("button", { name: m.news_previous() }).click());
        expect(screen.queryByAltText("A new piece")).not.toBeNull();
        act(() => scheduler.advance(7000 * 3));
        expect(screen.queryByAltText("A new piece")).not.toBeNull();
    });
});
