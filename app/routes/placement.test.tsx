// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { memoryStore } from "../adapters/memoryStore";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import { usePrefs } from "../hooks/usePrefs";
import Placement from "./placement";

// OSMD only renders in a real browser, so the score itself is a stub here; what
// this covers is the surface around it — the ladder's state on screen, and the
// result being written once.
// The stub reads the preferences the drill hands it, so a test can assert what the run
// is actually given rather than what the page meant to give it.
const seenPrefs = vi.fn();
vi.mock("../components/features/scoreViewer", () => ({
    ScoreViewer: () => {
        seenPrefs(usePrefs().prefs);
        return <div data-testid="score" />;
    },
}));

afterEach(cleanup);

function mount(seed: Record<string, string> = {}) {
    const store = memoryStore(seed);
    const view = renderWithServices(
        <MemoryRouter>
            <Placement />
        </MemoryRouter>,
        { store },
    );
    return { store, ...view };
}

describe("Placement", () => {
    it("offers the test before it offers a score", () => {
        mount();

        expect(screen.getByRole("button", { name: m.placement_start() })).toBeTruthy();
        expect(screen.queryByRole("progressbar")).toBeNull();
    });

    it("shows the ladder once reading begins", () => {
        mount();

        fireEvent.click(screen.getByRole("button", { name: m.placement_start() }));

        expect(screen.getByText(m.placement_level({ level: 1 }))).toBeTruthy();
        expect(screen.getByText(m.placement_strikes({ used: 0, total: 3 }))).toBeTruthy();
        expect(screen.getByRole("progressbar")).toBeTruthy();
    });

    it("remembers the last result and offers another go", () => {
        mount({
            "plinky:placement": JSON.stringify({ rating: 900, grade: 3, takenAt: 1 }),
        });

        expect(screen.getByText(m.placement_last({ rating: 900, grade: 3 }))).toBeTruthy();
        expect(screen.getByRole("button", { name: m.placement_again() })).toBeTruthy();
    });

    it("keeps a device that has never been tested free of a result", () => {
        const { store } = mount();

        fireEvent.click(screen.getByRole("button", { name: m.placement_start() }));

        // Nothing is written until the ladder actually ends.
        expect(store.get("plinky:placement")).toBeNull();
    });

    it("reads on its own terms, whatever the player turned on", () => {
        // Every aid on: coloured noteheads, labelled keys, the notes falling down a
        // highway, the next key always shown. A test taken like that measures nothing.
        const helped = JSON.stringify({
            colorNotes: true,
            noteLabels: "all",
            noteHints: "always",
            highway: true,
            showFingerings: true,
            hiddenNotes: true,
            keyLights: true,
        });
        seenPrefs.mockClear();
        mount({ "plinky:prefs": helped });
        fireEvent.click(screen.getByRole("button", { name: m.placement_start() }));

        const prefs = seenPrefs.mock.calls.at(-1)?.[0];
        expect(prefs.colorNotes).toBe(false);
        expect(prefs.noteLabels).toBe("off");
        expect(prefs.noteHints).toBe("never");
        expect(prefs.highway).toBe(false);
        expect(prefs.showFingerings).toBe(false);
        expect(prefs.hiddenNotes).toBe(false);
        expect(prefs.keyLights).toBe(false);
    });
});
