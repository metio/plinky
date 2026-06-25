// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { buildScore, saveUserScore } from "../lib/catalog";
import { toggleFavorite } from "../lib/favorites";
import Home from "./home";

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Score</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

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
    it("always offers the no-score training modes", () => {
        renderHome();
        for (const label of ["Sight-reading sprint →", "Daily challenge →", "Ear training →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it("links a favorited score to its play page", async () => {
        saveUserScore(buildScore(XML, []));
        toggleFavorite("my-score");
        renderHome();
        const link = await screen.findByText("My Score");
        // Links are localized; the test setup pins the locale to the base.
        expect(link.getAttribute("href")).toBe("/en/play/my-score");
    });

    it("prompts to star scores when none are favorited", async () => {
        saveUserScore(buildScore(XML, []));
        renderHome();
        // The score exists but isn't favorited, so home shows the pin prompt, not the score.
        expect(await screen.findByText(/Star scores to pin them here/)).toBeTruthy();
        expect(screen.queryByText("My Score")).toBeNull();
    });
});
