// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { buildScore, saveUserScore } from "../lib/catalog";
import Library from "./library";

const USER_XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Tune</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderScores() {
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Library />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Scores catalogue", () => {
    it("lists bundled scores and renders the selected one with OSMD", async () => {
        renderScores();
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        // The auto-selected first piece renders through the score viewer.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        expect(screen.getByText(/Listen/)).toBeTruthy();
        expect(screen.getByText("Practice")).toBeTruthy();
    });

    it("filters the list by the search box", async () => {
        renderScores();
        await screen.findByText("Ode to Joy");
        fireEvent.change(screen.getByRole("searchbox"), {
            target: { value: "no-such-piece" },
        });
        expect(await screen.findByText("No scores match your search.")).toBeTruthy();
    });

    it("hides the selected viewer when a filter excludes that piece", async () => {
        renderScores();
        await screen.findByText("Ode to Joy");
        // The auto-selected piece's viewer is showing its controls.
        await waitFor(() => expect(screen.queryByText("Practice")).toBeTruthy(), { timeout: 8000 });
        fireEvent.change(screen.getByRole("searchbox"), {
            target: { value: "no-such-piece" },
        });
        await screen.findByText("No scores match your search.");
        // With the selection filtered out, its viewer must not linger below.
        expect(screen.queryByText("Practice")).toBeNull();
    });

    it("selects a piece when its title is clicked", async () => {
        renderScores();
        const scale = await screen.findByText("C major scale");
        fireEvent.click(scale);
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
    });

    it("stars and unstars a piece", async () => {
        renderScores();
        await screen.findByText("Ode to Joy");
        const star = screen.getAllByLabelText("Add to favorites")[0];
        if (!star) {
            throw new Error("no favorite control");
        }
        fireEvent.click(star);
        expect(await screen.findByLabelText("Remove from favorites")).toBeTruthy();
    });

    it("removes an imported score from the catalogue", async () => {
        saveUserScore(buildScore(USER_XML, []));
        renderScores();
        expect(await screen.findByText("My Tune")).toBeTruthy();
        fireEvent.click(screen.getByLabelText("Remove"));
        await waitFor(() => expect(screen.queryByText("My Tune")).toBeNull());
    });
});
