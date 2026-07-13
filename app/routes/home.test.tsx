// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "../ports/audioEngine";
import { MidiProvider } from "../contexts/midi";
import { renderWithServices } from "../testing/renderWithServices";
import Home from "./home";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderHome() {
    // The hero keyboard listens for MIDI, so it needs the provider the app supplies.
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Home />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Home", () => {
    it("offers the destination cards, and not the daily (it lives in the Today panel)", () => {
        renderHome();
        for (const label of ["Library →", "Assignments →", "Compose →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        // The daily is in the Today panel; ear/fingering are now modes on /play.
        expect(screen.queryByText("Daily challenge →")).toBeNull();
        expect(screen.queryByText("Ear training →")).toBeNull();
    });

    it("plinks a rising note on mouse hover over the feature cards, but not on touch", () => {
        const strike = vi.fn();
        const audio: AudioEngine = {
            now: () => 0,
            resume: () => {},
            unlock: () => {},
            strike,
            press: () => {},
            release: () => {},
            setPedal: () => {},
            click: () => {},
        };
        renderWithServices(
            <MemoryRouter>
                <MidiProvider>
                    <Home />
                </MidiProvider>
            </MemoryRouter>,
            { audio },
        );

        const card = screen.getByText("Library →").closest("a") as HTMLElement;
        fireEvent.pointerEnter(card, { pointerType: "mouse" });
        expect(strike).toHaveBeenCalledTimes(1);
        expect(strike.mock.calls[0]?.[0]?.note).toBe(60);

        // A tap fires pointerenter too; it must stay silent so touch browsing
        // doesn't read as phantom key presses.
        fireEvent.pointerEnter(card, { pointerType: "touch" });
        expect(strike).toHaveBeenCalledTimes(1);
    });

    it("routes into the library and the assignments", () => {
        renderHome();
        // Links are localized; the test setup pins the locale to the base.
        expect(screen.getByText("Library →").closest("a")?.getAttribute("href")).toBe(
            "/en/library",
        );
        expect(screen.getByText("Assignments →").closest("a")?.getAttribute("href")).toBe(
            "/en/assignments",
        );
    });
});
