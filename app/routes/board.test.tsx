// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BoardArtist } from "../../core/board";
import { fakeBoard } from "../adapters/fakeBoard";
import { renderWithServices } from "../testing/renderWithServices";
import Board from "./board";

afterEach(cleanup);

const ada: BoardArtist = {
    id: "a-ada",
    name: "Ada Keys",
    order: 0,
    text: "Plays a nocturne a day, and shows every wrong note on the way.",
    imageUrl: "https://cdn.example.com/ada.png",
    imageAlt: "Ada at the piano",
    linkUrl: "https://www.instagram.com/adakeys",
};

describe("Board", () => {
    it("renders a pinned artist with picture, blurb, and a branded follow link", async () => {
        renderWithServices(<Board />, { board: fakeBoard([ada]) });
        expect(await screen.findByText("Ada Keys")).toBeTruthy();
        expect(screen.getByText(ada.text)).toBeTruthy();
        const img = screen.getByAltText("Ada at the piano");
        expect(img.getAttribute("src")).toBe(ada.imageUrl);
        const follow = screen.getByText("Follow on Instagram").closest("a");
        expect(follow?.getAttribute("href")).toBe(ada.linkUrl);
        expect(follow?.getAttribute("rel")).toContain("noreferrer");
    });

    it("falls back to a plain visit link for an unrecognized host", async () => {
        renderWithServices(<Board />, {
            board: fakeBoard([{ ...ada, linkUrl: "https://adakeys.example.com" }]),
        });
        expect(await screen.findByText(/Visit page/)).toBeTruthy();
    });

    it("shows the empty note once loading resolves to no artists", async () => {
        renderWithServices(<Board />, { board: fakeBoard() });
        expect(
            await screen.findByText("Nothing is pinned to the board yet — check back soon."),
        ).toBeTruthy();
    });
});
