// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { fakeMidi } from "../adapters/fakeMidi";
import { ServicesProvider } from "../contexts/services";
import { loadBundledScores } from "../lib/catalog";
import { httpFetcher } from "../adapters/httpFetcher";
import Play from "./play";
import type { Route } from "./+types/play";
import { m } from "../paraglide/messages.js";

// Bundled scores are keyed by their content-fingerprint id, so look one up by title.
// The browser context arrives with MIDI pre-granted; without a fake seam the
// provider would silently open a REAL Web MIDI connection under every test.
const midiFake = { midi: fakeMidi() };

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
            <ServicesProvider services={midiFake}>
                <MidiProvider>
                    <Play {...props} />
                </MidiProvider>
            </ServicesProvider>
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

    it("offers a retry instead of 'not found' while the catalogue is unreachable", async () => {
        // The fetcher override rebuilds the song/exercise sources over it, so a
        // failing network is simulated at the injected seam.
        let offline = true;
        const flaky: typeof httpFetcher = (url, init) =>
            offline ? Promise.reject(new TypeError("offline")) : httpFetcher(url, init);
        const props = { params: { scoreId: "no-such-score" } } as unknown as Route.ComponentProps;
        render(
            <MemoryRouter>
                <ServicesProvider services={{ ...midiFake, fetcher: flaky }}>
                    <MidiProvider>
                        <Play {...props} />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // Unreachable is not "gone": the page must not claim the piece is absent.
        expect(await screen.findByText(/check your connection/)).toBeTruthy();
        expect(screen.queryByText("That score isn't on this device.")).toBeNull();
        // With the network back, the retry re-asks — and a genuinely unknown id
        // now gets the honest not-found answer.
        offline = false;
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("That score isn't on this device.")).toBeTruthy();
    });

    it("names what you can do to a piece on the piece's own page", async () => {
        // The twelve ways to work a piece used to live behind a fold called "Set up your
        // run" — and behind a second one for a beginner. What is about THIS piece is on
        // the page now; only the reading settings, which Settings owns as well, fold.
        renderPlay(bundledId("ode to joy"));
        expect(await screen.findByText(m.run_group_practice_title())).toBeTruthy();
        expect(screen.getByText(m.run_group_challenge_title())).toBeTruthy();
        // Named where they are chosen, rather than listed where they are not.
        expect(screen.getByText(m.sight_read())).toBeTruthy();
        expect(screen.getByText(m.race_ghost_toggle())).toBeTruthy();
        expect(screen.getByText(m.run_pace_label())).toBeTruthy();
        // The one fold left, closed at rest.
        const sheet = screen.getByRole("button", { name: m.run_group_sheet_title() });
        expect(sheet.getAttribute("aria-expanded")).toBe("false");
    });

    it("keeps the play surface free of MIDI-connect chrome", async () => {
        // Connecting a device is a one-time setup task that lives in Settings
        // (with a getting-started step pointing there); a playing surface never
        // grows a Connect button or the computer-keys disclosure.
        renderPlay(bundledId("twinkle"));
        await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
        expect(screen.queryByRole("button", { name: "Connect MIDI" })).toBeNull();
        expect(screen.queryByText(/No piano\?/)).toBeNull();
    }, 90000);
});
