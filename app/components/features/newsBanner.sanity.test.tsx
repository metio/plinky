// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { httpFetcher } from "../../adapters/httpFetcher";
import { createSanityNews } from "../../adapters/sanityNews";
import type { SanityConfig } from "../../adapters/sanity";
import { server } from "../../test-setup.node";
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
        server.use(http.get(QUERY_URL, () => HttpResponse.json({ result: { item } })));
        renderWithServices(<NewsBanner />, news);
        const img = await screen.findByAltText("A new piece");
        expect(img.getAttribute("src")).toBe(item.imageUrl);
        expect(img.closest("a")?.getAttribute("href")).toBe(item.linkUrl);
        expect(screen.getByText("New pieces this week")).toBeTruthy();
    });

    it("renders nothing when the master switch is off", async () => {
        server.use(
            http.get(QUERY_URL, () => HttpResponse.json({ result: { enabled: false, item } })),
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
});
