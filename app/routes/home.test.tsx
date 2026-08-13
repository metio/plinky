// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { m } from "../paraglide/messages.js";
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
    it("leads with the day rather than with a pitch", async () => {
        renderHome();
        // The day's own session owns the heading, since only the reader's clock knows
        // which day it is. It arrives naming the weekday and the part of it.
        const heading = await screen.findByRole("heading", { level: 1 });
        expect(heading.textContent).toBeTruthy();
        expect(screen.queryByRole("heading", { level: 1, name: m.home_heading() })).toBeNull();
    });

    it("keeps the introduction in the document for a first visit", () => {
        renderHome();
        // Prerendered, so a crawler and a stranger both read it. The pre-paint
        // bootstrap hides it on a device that has played, which is a class on
        // <html> rather than a different tree — so it is always rendered here.
        expect(screen.getByText(m.home_heading())).toBeTruthy();
        expect(screen.getByText(m.home_eyebrow())).toBeTruthy();
    });

    it("leaves the keyboard to the warm-up rather than the pitch", () => {
        renderHome();
        // Somewhere to put your hands belongs to the day's practice, where it is the
        // first thing asked of them — not to the paragraph explaining what Plinky is.
        expect(screen.queryByText(m.home_keyboard_hint())).toBeNull();
    });

    it("sends browsing to the two hubs instead of listing destinations itself", () => {
        renderHome();
        // The destination cards moved onto Music and Learn: a page that suggests
        // four times over has decided nothing for the reader.
        expect(screen.queryByText(`${m.home_assignments()} →`)).toBeNull();
        expect(screen.queryByText(`${m.play_compose()} →`)).toBeNull();
        expect(screen.queryByText(`${m.ear_title()} →`)).toBeNull();
    });
});
