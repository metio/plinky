// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { httpFetcher } from "../adapters/httpFetcher";
import { createSanityBoard, type SanityBoardConfig } from "../adapters/sanityBoard";
import { server } from "../test-setup.node";
import { renderWithServices } from "../testing/renderWithServices";
import Board from "./board";

afterEach(cleanup);

// The whole pipeline against a mocked Sanity API: the page renders through the
// real Sanity adapter and the real fetcher, with Mock Service Worker answering at
// the network layer — so the URL, the response envelope, the parsing, and the
// layout are all exercised together.
const config: SanityBoardConfig = {
    projectId: "testproj",
    dataset: "production",
    apiVersion: "2024-01-01",
    query: "*",
};

const QUERY_URL = "https://testproj.apicdn.sanity.io/v2024-01-01/data/query/production";

const board = { board: createSanityBoard(httpFetcher, config) };

const ada = {
    id: "a-ada",
    name: "Ada Keys",
    order: 2,
    text: "Plays a nocturne a day.",
    imageUrl: "https://cdn.sanity.io/images/ada.png",
    imageAlt: "Ada at the piano",
    linkUrl: "https://www.instagram.com/adakeys",
};
const ben = {
    id: "a-ben",
    name: "Ben Pedal",
    order: 1,
    text: "One tiny étude a week.",
    linkUrl: "https://www.youtube.com/@benpedal",
};

describe("Board against a mocked Sanity API", () => {
    it("renders the published artists in order, badging each follow link", async () => {
        server.use(
            http.get(QUERY_URL, () =>
                HttpResponse.json({ result: [ada, ben, { id: "", name: "x", text: "x" }] }),
            ),
        );
        renderWithServices(<Board />, board);
        expect(await screen.findByText("Ada Keys")).toBeTruthy();
        const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
        expect(names).toEqual(["Ben Pedal", "Ada Keys"]);
        expect(screen.getByText("Follow on Instagram").closest("a")?.getAttribute("href")).toBe(
            ada.linkUrl,
        );
        expect(screen.getByText("Follow on YouTube").closest("a")?.getAttribute("href")).toBe(
            ben.linkUrl,
        );
        expect(screen.getByAltText("Ada at the piano").getAttribute("src")).toBe(ada.imageUrl);
    });

    it("asks Sanity for the reader's language", async () => {
        let requested = "";
        server.use(
            http.get(QUERY_URL, ({ request }) => {
                requested = request.url;
                return HttpResponse.json({ result: [ada] });
            }),
        );
        renderWithServices(<Board />, board);
        await screen.findByText("Ada Keys");
        expect(requested).toContain(`$lang=${encodeURIComponent('"en"')}`);
    });

    it("shows the empty note when the API errors", async () => {
        server.use(http.get(QUERY_URL, () => new HttpResponse(null, { status: 500 })));
        renderWithServices(<Board />, board);
        expect(
            await screen.findByText("Nothing is pinned to the board yet — check back soon."),
        ).toBeTruthy();
    });

    it("shows the empty note on the default empty-project answer", async () => {
        renderWithServices(<Board />, board);
        expect(
            await screen.findByText("Nothing is pinned to the board yet — check back soon."),
        ).toBeTruthy();
    });
});
