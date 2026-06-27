// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
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
    it("offers the feature cards, and not the daily (it lives in the Today panel)", () => {
        renderHome();
        for (const label of ["Compose →", "Ear training →", "Fingering →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        expect(screen.queryByText("Daily challenge →")).toBeNull();
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
