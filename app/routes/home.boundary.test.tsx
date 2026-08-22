// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { m } from "../paraglide/messages.js";
import Home from "./home";

// A panel that throws for real, in its own file so the mock reaches only this test.
//
// The front page is built from panels that each read their own store and know nothing
// of their neighbours. Without a boundary per panel, one of them throwing unwinds
// through the whole page to the router's boundary and the reader loses everything —
// the introduction, the hero keyboard, the rest of the panels — over one fault.
vi.mock("../components/features/homeToday", () => ({
    HomeToday: () => {
        throw new Error("today panel exploded");
    },
}));

beforeEach(() => {
    // React prints the caught error and its stack by design; the throw is the point.
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("Home with a broken panel", () => {
    it("loses that panel and keeps the rest of the page", () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Home />
                </MidiProvider>
            </MemoryRouter>,
        );

        // The panel is replaced in place…
        expect(screen.getByText(m.feature_broken())).toBeTruthy();
        // …and everything around it still works.
        // The day's heading goes down with the panel that owns it; what the page says
        // Plinky is does not.
        expect(screen.getByText(m.home_heading())).toBeTruthy();
        expect(screen.getByText(m.home_eyebrow())).toBeTruthy();
        expect(screen.getByRole("button", { name: m.action_try_again() })).toBeTruthy();
    });
});
