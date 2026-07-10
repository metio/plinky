// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { fakeMidi } from "../adapters/fakeMidi";
import { ServicesProvider } from "../contexts/services";
import { loadBundledScores } from "../lib/catalog";
import { browserStore } from "../adapters/browserStore";
import { httpFetcher } from "../adapters/httpFetcher";
import { createOnboardingStore } from "../stores/onboardingStore";
import Play from "./play";
import type { Route } from "./+types/play";

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

    it("opens straight into ear mode from a ?mode=ear deep link and marks it tried", async () => {
        const id = bundledId("twinkle");
        const props = { params: { scoreId: id } } as unknown as Route.ComponentProps;
        render(
            <MemoryRouter initialEntries={[`/play/${id}?mode=ear`]}>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Play {...props} />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // Ear mode is showing — its "Hear the phrase" control is on screen, not just
        // the default score viewer — so the discovery link lands on the activity.
        expect(
            await screen.findByRole("button", { name: /Hear the phrase/ }, { timeout: 30000 }),
        ).toBeTruthy();
        expect(createOnboardingStore(browserStore).marked().has("earTried")).toBe(true);
    });
});
