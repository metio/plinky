// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { fakeMidi } from "../adapters/fakeMidi";
import { ServicesProvider } from "../contexts/services";
import { dailyNumber, todayKey } from "../../core/daily";
import { browserStore } from "../adapters/browserStore";
import { createDailyStore } from "../stores/dailyStore";
import Daily from "./daily";

// OSMD renders only in a real browser, so this runs in the browser project.
// The browser context arrives with MIDI pre-granted; without a fake seam the
// provider would silently open a REAL Web MIDI connection under every test.
const midiFake = { midi: fakeMidi() };

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("Daily", () => {
    it("heads the page with the running challenge number", async () => {
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Daily />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        expect(await screen.findByRole("heading", { name: /Daily #\d+/ })).toBeTruthy();
        // The phrase leaves the page like any piece: print it, or take it as
        // MIDI / MusicXML from the title line.
        expect(screen.getByRole("button", { name: "Print" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Export MIDI" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Export MusicXML" })).toBeTruthy();
    });

    it("renders today's generated phrase through the graded viewer", async () => {
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Daily />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // The generated phrase renders through the graded score viewer, which leads with
        // its single primary action (Practice); Listen waits in the full-screen top bar.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        expect(screen.getByText("Practice")).toBeTruthy();
    });

    it("renders the score without a spurious horizontal scrollbar", async () => {
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Daily />
                    </MidiProvider>
                </ServicesProvider>
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Daily />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        // A locked-tempo challenge offers no tempo control anywhere at rest: the
        // Run-setup disclosure holds no trainer or transpose, and no slider exists.
        fireEvent.click(screen.getByRole("button", { name: "Set up your run" }));
        expect(screen.queryByText("Transpose")).toBeNull();
        expect(screen.queryByRole("switch", { name: "Tempo trainer" })).toBeNull();
        expect(document.querySelector('input[type="range"]')).toBeNull();
    });

    it("shows the stored result when the day's challenge is re-opened", async () => {
        // A finished daily persists its result; re-visiting the page must surface it
        // rather than a blank run, so the home "see your results" link has a result to
        // land on.
        const number = dailyNumber(todayKey(new Date()));
        createDailyStore(browserStore).saveResult(number, {
            grade: { accuracy: 91, timing: 80, flow: 70, dynamics: null, score: 82, letter: "B" },
            grid: [["best", "good", "ok", "weak", "none", "best"]],
            notes: [{ targetMs: 0, playedMs: 10, wrongBefore: 0 }],
            tolerance: 200,
        });
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Daily />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // The grade panel is seeded from the stored result, so its readouts appear
        // without playing a note.
        expect(await screen.findByText("91%")).toBeTruthy();
    });

    it("offers a warm-up mode that drills fresh generated phrases", async () => {
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Daily />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // The folded-in sprint: switching tabs reveals its controls and a phrase.
        fireEvent.click(await screen.findByText("Warm up"));
        expect(screen.getByText("New phrase")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
    });
});
