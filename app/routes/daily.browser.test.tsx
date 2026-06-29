// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { dailyNumber, todayKey } from "../lib/daily";
import { saveDailyResult } from "../lib/dailyResult";
import Daily from "./daily";

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("Daily", () => {
    it("heads the page with the running challenge number", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        expect(await screen.findByText(/Plinky #\d+/)).toBeTruthy();
    });

    it("renders today's generated phrase through the graded viewer", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        // The generated phrase renders through the graded score viewer.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        expect(screen.getByText(/Listen/)).toBeTruthy();
        expect(screen.getByText("Practice")).toBeTruthy();
    });

    it("renders the score without a spurious horizontal scrollbar", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        // OSMD must render within its container: the scrollable region's content is
        // no wider than the region itself, so no horizontal scrollbar appears.
        await waitFor(
            () => {
                const region = screen.getByRole("img", { name: /Plinky #/ });
                expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1);
            },
            { timeout: 30000 },
        );
    });

    it("locks the tempo so everyone plays the day at one speed", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        // The tempo is shown but fixed — no slider to dial it to taste.
        expect(screen.getByText(/\d+ BPM/)).toBeTruthy();
        expect(document.querySelector('input[type="range"]')).toBeNull();
    });

    it("shows the stored result when the day's challenge is re-opened", async () => {
        // A finished daily persists its result; re-visiting the page must surface it
        // rather than a blank run, so the home "see your results" link has a result to
        // land on.
        const number = dailyNumber(todayKey(new Date()));
        saveDailyResult(number, {
            grade: { accuracy: 91, timing: 80, flow: 70, dynamics: null, score: 82, letter: "B" },
            grid: [["best", "good", "ok", "weak", "none", "best"]],
            notes: [{ targetMs: 0, playedMs: 10, wrongBefore: 0 }],
            tolerance: 200,
        });
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        // The grade panel is seeded from the stored result, so its readouts appear
        // without playing a note.
        expect(await screen.findByText("91%")).toBeTruthy();
    });

    it("offers a warm-up mode that drills fresh generated phrases", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        // The folded-in sprint: switching tabs reveals its controls and a phrase.
        fireEvent.click(await screen.findByText("Warm up"));
        expect(screen.getByText("New phrase")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
    });
});
