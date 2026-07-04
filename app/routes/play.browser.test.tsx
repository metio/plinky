// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_PREFS } from "../../core/prefs";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { loadBundledScores } from "../lib/catalog";
import { discoveries } from "../lib/onboarding";
import Play from "./play";
import type { Route } from "./+types/play";

// Bundled scores are keyed by their content-fingerprint id, so look one up by title.
const bundledId = (titleFragment: string): string =>
    loadBundledScores().find((score) => score.title.toLowerCase().includes(titleFragment))?.id ??
    "";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderPlay(scoreId: string) {
    const props = { params: { scoreId } } as unknown as Route.ComponentProps;
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Play {...props} />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Play", () => {
    it("renders the requested bundled piece", async () => {
        renderPlay(bundledId("ode to joy"));
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
    });

    it("reports a missing score", async () => {
        renderPlay("no-such-score");
        expect(await screen.findByText("That score isn't on this device.")).toBeTruthy();
    });

    it("opens straight into ear mode from a ?mode=ear deep link and marks it tried", async () => {
        const id = bundledId("twinkle");
        const props = { params: { scoreId: id } } as unknown as Route.ComponentProps;
        render(
            <MemoryRouter initialEntries={[`/play/${id}?mode=ear`]}>
                <MidiProvider>
                    <Play {...props} />
                </MidiProvider>
            </MemoryRouter>,
        );
        // Ear mode is showing — its "Hear the phrase" control is on screen, not just
        // the default score viewer — so the discovery link lands on the activity.
        expect(
            await screen.findByRole("button", { name: /Hear the phrase/ }, { timeout: 30000 }),
        ).toBeTruthy();
        expect(discoveries({ prefs: DEFAULT_PREFS, masteredCount: 0, history: {} }).earTried).toBe(
            true,
        );
    });
});
