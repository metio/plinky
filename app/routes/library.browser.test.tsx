// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { buildScore, saveUserScore } from "../lib/catalog";
import { saveMastery } from "../lib/mastery";
import Library from "./library";

const USER_XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Tune</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

// Renders in the browser project so the catalogue glob and DOMParser-based grading
// run as they do in the app; the song manifest fetch 404s here, leaving the bundled
// exercises, which is what these assertions cover.
function renderLibrary() {
    return render(
        <MemoryRouter>
            <Library />
        </MemoryRouter>,
    );
}

describe("Library", () => {
    it("lists bundled scores and links each to its play page", async () => {
        renderLibrary();
        const ode = await screen.findByText("Ode to Joy");
        expect(ode.closest("a")?.getAttribute("href")).toContain("/play/ode-to-joy");
    });

    it("filters the list by the search box", async () => {
        renderLibrary();
        await screen.findByText("Ode to Joy");
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-piece" } });
        expect(await screen.findByText("No scores match your search.")).toBeTruthy();
    });

    it("offers a multi-select grade filter", async () => {
        renderLibrary();
        await screen.findByText("Ode to Joy");
        // Grade chips 1–8 narrow the catalogue by difficulty.
        const one = screen.getByLabelText("Grade 1");
        const two = screen.getByLabelText("Grade 8");
        expect(one).toBeTruthy();
        expect(two).toBeTruthy();
        // Each chip is an independent toggle, so several grades can be lit at once.
        fireEvent.click(one);
        fireEvent.click(two);
        expect(one.getAttribute("aria-pressed")).toBe("true");
        expect(two.getAttribute("aria-pressed")).toBe("true");
        // Clicking a lit chip clears just that grade.
        fireEvent.click(one);
        expect(one.getAttribute("aria-pressed")).toBe("false");
        expect(two.getAttribute("aria-pressed")).toBe("true");
    });

    it("stars and unstars a piece", async () => {
        renderLibrary();
        await screen.findByText("Ode to Joy");
        const star = screen.getAllByLabelText("Add to favorites")[0];
        if (!star) {
            throw new Error("no favorite control");
        }
        fireEvent.click(star);
        expect(await screen.findByLabelText("Remove from favorites")).toBeTruthy();
    });

    it("removes an imported score only after the delete is confirmed", async () => {
        saveUserScore(buildScore(USER_XML, []));
        renderLibrary();
        expect(await screen.findByText("My Tune")).toBeTruthy();
        // The first click only arms the confirm — the unrecoverable delete shouldn't
        // fire on a single misclick.
        fireEvent.click(screen.getByLabelText("Remove"));
        expect(screen.getByText("My Tune")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Remove?" }));
        await waitFor(() => expect(screen.queryByText("My Tune")).toBeNull());
    });

    it("filters to only the pieces due for review", async () => {
        // Ode to Joy is overdue; Twinkle has no mastery, so it isn't due.
        saveMastery("ode-to-joy", {
            bestScore: 90,
            learned: true,
            backlog: false,
            intervalDays: 5,
            reviewAt: Date.now() - 86_400_000,
            updatedAt: 0,
        });
        renderLibrary();
        expect(await screen.findByText("Twinkle, Twinkle, Little Star")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /due now/i }));
        expect(screen.getByText("Ode to Joy")).toBeTruthy();
        await waitFor(() => expect(screen.queryByText("Twinkle, Twinkle, Little Star")).toBeNull());
    });
});
