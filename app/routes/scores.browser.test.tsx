// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import Scores from "./scores";

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderScores() {
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Scores />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Scores", () => {
    it("lists the bundled scores and renders the selected one with OSMD", async () => {
        renderScores();
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        expect(screen.getByText("Twinkle, Twinkle, Little Star")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });

        fireEvent.click(screen.getByText("Twinkle, Twinkle, Little Star"));
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
    });

    it("plays and stops the selected score", async () => {
        renderScores();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        fireEvent.click(screen.getByText(/Listen/));
        await waitFor(() => expect(screen.getByText(/Stop/)).toBeTruthy());
        fireEvent.click(screen.getByText(/Stop/));
        await waitFor(() => expect(screen.getByText(/Listen/)).toBeTruthy());
    });

    it("advances the cursor as the score is played correctly", async () => {
        renderScores();
        await screen.findByText("Twinkle, Twinkle, Little Star");
        fireEvent.click(screen.getByText("Twinkle, Twinkle, Little Star"));
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });

        fireEvent.click(screen.getByText("Practice"));
        // Twinkle: C C G G A A G F F E E D D C (MIDI), 14 notes.
        const twinkle = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60];
        expect(await screen.findByText(/0 \/ 14/)).toBeTruthy();
        for (const note of twinkle) {
            await act(async () => {
                window.__plinky?.play(note);
                window.__plinky?.release(note);
            });
        }
        // A clean run (no wrong notes) grades 100% accuracy and shows the grade card.
        expect(await screen.findByText("Accuracy")).toBeTruthy();
        expect(screen.getByText("100%")).toBeTruthy();
        // The ghost-timing timeline plots the run (ghost vs you).
        expect(screen.getByText("Ideal")).toBeTruthy();
        expect(screen.getByText("You")).toBeTruthy();
    });

    it("marks a score learned and toggles the backlog", async () => {
        renderScores();
        await screen.findByText("Twinkle, Twinkle, Little Star");
        fireEvent.click(screen.getByText("Twinkle, Twinkle, Little Star"));
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });

        fireEvent.click(screen.getByText("Mark learned"));
        expect(await screen.findByText("Move to backlog")).toBeTruthy();
        fireEvent.click(screen.getByText("Move to backlog"));
        expect(await screen.findByText("Resume reviews")).toBeTruthy();
    });
});
