// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { memoryStore } from "../adapters/memoryStore";
import { usePrefs } from "../hooks/usePrefs";
import { renderWithServices } from "../testing/renderWithServices";
import Basics from "./basics";

// The tour drives audio and a live keyboard; what this covers is the preferences the page
// hands it, which is what decides whether there is anything left to find.
const seenPrefs = vi.fn();
vi.mock("../components/features/keyboardTour", () => ({
    KeyboardTour: () => {
        seenPrefs(usePrefs().prefs);
        return <div data-testid="tour" />;
    },
}));

afterEach(cleanup);

describe("Basics", () => {
    it("shows the keyboard unaided, whatever the player turned on", () => {
        seenPrefs.mockClear();
        renderWithServices(
            <MemoryRouter>
                <Basics />
            </MemoryRouter>,
            {
                store: memoryStore({
                    "plinky:prefs": JSON.stringify({
                        noteLabels: "all",
                        colorNotes: true,
                        noteHints: "always",
                        highway: true,
                    }),
                }),
            },
        );

        const prefs = seenPrefs.mock.calls.at(-1)?.[0];
        // Every key labelled is the answer to the question the lesson asks.
        expect(prefs.noteLabels).toBe("off");
        expect(prefs.colorNotes).toBe(false);
        expect(prefs.noteHints).toBe("never");
        expect(prefs.highway).toBe(false);
        expect(screen.getByTestId("tour")).toBeTruthy();
    });

    it("leaves the player's own instrument alone", () => {
        seenPrefs.mockClear();
        renderWithServices(
            <MemoryRouter>
                <Basics />
            </MemoryRouter>,
            {
                store: memoryStore({
                    "plinky:prefs": JSON.stringify({ volume: 25, sound: false }),
                }),
            },
        );

        const prefs = seenPrefs.mock.calls.at(-1)?.[0];
        expect(prefs.volume).toBe(25);
        expect(prefs.sound).toBe(false);
    });
});
