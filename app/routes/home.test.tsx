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
    it("always offers the no-score training modes", () => {
        renderHome();
        for (const label of ["Daily challenge →", "Ear training →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it("routes into the library and the guided tracks", () => {
        renderHome();
        // Links are localized; the test setup pins the locale to the base.
        expect(screen.getByText("All scores →").closest("a")?.getAttribute("href")).toBe(
            "/en/library",
        );
        expect(screen.getByText("Tracks →").closest("a")?.getAttribute("href")).toBe("/en/tracks");
    });
});
