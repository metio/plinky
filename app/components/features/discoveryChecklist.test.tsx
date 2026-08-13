// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { DiscoveryChecklist } from "./discoveryChecklist";
import { m } from "../../paraglide/messages.js";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

// The checklist watches the MIDI connection for its connect step, so it needs
// the provider — over a fake, never the real Web MIDI.
function mount() {
    return render(
        <MemoryRouter>
            {/* The store stays the default browser one — the tests seed via
                localStorage — only the MIDI adapter is faked. */}
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <DiscoveryChecklist />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
}

describe("DiscoveryChecklist", () => {
    it("offers a brand-new player the three things that tailor the rest", async () => {
        // Empty device → nothing set up yet → the strip shows.
        mount();
        expect(await screen.findByText(m.discover_heading())).toBeTruthy();
        expect(screen.getByRole("link", { name: m.discover_midi() })).toBeTruthy();
        expect(screen.getByRole("link", { name: m.grades_start_hand() })).toBeTruthy();
        expect(screen.getByRole("link", { name: m.discover_keys() })).toBeTruthy();
    });

    it("carries setting up and nothing else", async () => {
        mount();
        await screen.findByText(m.discover_heading());
        // Meeting the keyboard, the first piece, the daily and the app's corners are
        // all offered by the day's practice above. A second list of suggestions beside
        // it would only ask the reader which list to read.
        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(3);
        for (const link of links) {
            expect(link.getAttribute("href")).toBe("/en/settings/");
        }
    });

    it("goes once every part of the set-up is done", async () => {
        // A hand span on both hands, a remembered MIDI device and a touched key map
        // are the three; with all of them the strip has nothing left to say.
        localStorage.setItem("plinky:prefs", JSON.stringify({ handSpan: { left: 9, right: 9 } }));
        localStorage.setItem(
            "plinky:discovered",
            JSON.stringify(["midiConnected", "keysCustomized"]),
        );
        mount();
        await waitFor(() => expect(screen.queryByText(m.discover_heading())).toBeNull());
    });

    it("dismisses for good when the ✕ is clicked", async () => {
        mount();
        await screen.findByText(m.discover_heading());
        fireEvent.click(screen.getByRole("button", { name: m.action_dismiss() }));
        await waitFor(() => expect(screen.queryByText(m.discover_heading())).toBeNull());
        // The dismissal persists, so it stays gone on the next visit.
        expect(localStorage.getItem("plinky:seen-hints")).toContain("discovery-panel");
    });

    it("stays hidden for a player who has already dismissed it", async () => {
        localStorage.setItem("plinky:seen-hints", JSON.stringify(["discovery-panel"]));
        mount();
        // Give the post-mount read a chance to run, then confirm it never appears.
        await waitFor(() => expect(screen.queryByText(m.discover_heading())).toBeNull());
    });
});
