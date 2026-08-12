// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { FavoriteButton } from "./favoriteButton";

afterEach(cleanup);

const star = () => screen.getByRole("button", { name: /favou?rite/i });

describe("FavoriteButton", () => {
    it("stars a piece and unstars it again, writing through to the store", () => {
        const { services } = renderWithServices(<FavoriteButton id="star-me" />);
        expect(star().getAttribute("aria-label")).toBe(m.scores_favorite());
        expect(star().getAttribute("aria-pressed")).toBe("false");

        fireEvent.click(star());
        expect(services.favorites.load().has("star-me")).toBe(true);
        expect(star().getAttribute("aria-pressed")).toBe("true");
        expect(star().getAttribute("aria-label")).toBe(m.scores_unfavorite());

        fireEvent.click(star());
        expect(services.favorites.load().has("star-me")).toBe(false);
        expect(star().getAttribute("aria-pressed")).toBe("false");
    });

    it("fills the star once the piece is kept, and leaves it outlined until then", () => {
        // Shape carries the state, not colour alone — the same star the library row draws.
        renderWithServices(<FavoriteButton id="fill" />);
        expect(star().querySelector("path")?.getAttribute("fill")).toBe("none");
        fireEvent.click(star());
        expect(star().querySelector("path")?.getAttribute("fill")).toBe("currentColor");
    });

    it("shows a piece already starred elsewhere as starred", () => {
        // The library and the play page read one set, so a piece starred in the list is
        // starred here without anything having to tell this button about it.
        const { services } = renderWithServices(<FavoriteButton id="known" />);
        expect(star().getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(star());
        expect(services.favorites.load().has("known")).toBe(true);
    });

    it("stars only the piece it was given", () => {
        const { services } = renderWithServices(<FavoriteButton id="mine" />);
        fireEvent.click(star());
        expect([...services.favorites.load()]).toEqual(["mine"]);
    });
});
