// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { buildSong, saveUserSong } from "../lib/catalog";
import { toggleFavorite } from "../lib/favorites";
import Home from "./home";

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Song</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderHome() {
    return render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>,
    );
}

describe("Home", () => {
    it("always offers the no-song training modes", () => {
        renderHome();
        for (const label of ["Sight-reading sprint →", "Daily challenge →", "Ear training →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it("links a favorited song to its play page", async () => {
        saveUserSong(buildSong(XML, []));
        toggleFavorite("my-song");
        renderHome();
        const link = await screen.findByText("My Song");
        expect(link.getAttribute("href")).toBe("/play/my-song");
    });

    it("prompts to star songs when none are favorited", async () => {
        saveUserSong(buildSong(XML, []));
        renderHome();
        // The song exists but isn't favorited, so home shows the pin prompt, not the song.
        expect(await screen.findByText(/Star songs to pin them here/)).toBeTruthy();
        expect(screen.queryByText("My Song")).toBeNull();
    });
});
