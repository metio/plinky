// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { httpFetcher } from "../adapters/httpFetcher";
import { createSanityHelp, type SanityHelpConfig } from "../adapters/sanityHelp";
import { server } from "../test-setup.node";
import { renderWithServices } from "../testing/renderWithServices";
import Help from "./help";

afterEach(cleanup);

// The whole pipeline against a mocked Sanity API: the page renders through the
// real Sanity adapter and the real fetcher, with Mock Service Worker answering at
// the network layer.
const config: SanityHelpConfig = {
    projectId: "testproj",
    dataset: "production",
    apiVersion: "2024-01-01",
    query: "*",
};

const QUERY_URL = "https://testproj.apicdn.sanity.io/v2024-01-01/data/query/production";

const help = { help: createSanityHelp(httpFetcher, config) };

const playItem = {
    id: "h-play",
    pageKey: "play",
    order: 0,
    text: "Press a key to play the note under the cursor.",
    imageUrl: "https://cdn.sanity.io/images/play.png",
    imageAlt: "The play screen",
    linkUrl: "https://plinky.fun/en/play",
};

describe("Help against a mocked Sanity API", () => {
    it("renders a published block under its section, with picture and link", async () => {
        server.use(http.get(QUERY_URL, () => HttpResponse.json({ result: [playItem] })));
        const { container } = renderWithServices(<Help />, help);
        expect(await screen.findByText(playItem.text)).toBeTruthy();
        expect(container.querySelector("#play")?.textContent).toContain(playItem.text);
        expect(screen.getByAltText("The play screen").getAttribute("src")).toBe(playItem.imageUrl);
        expect(
            screen
                .getByText(/Learn more/)
                .closest("a")
                ?.getAttribute("href"),
        ).toBe(playItem.linkUrl);
    });

    it("falls back to the section skeleton when the API errors", async () => {
        server.use(http.get(QUERY_URL, () => new HttpResponse(null, { status: 500 })));
        renderWithServices(<Help />, help);
        await waitFor(() =>
            expect(screen.getAllByText("Help for this area is on the way.").length).toBeGreaterThan(
                0,
            ),
        );
    });
});
