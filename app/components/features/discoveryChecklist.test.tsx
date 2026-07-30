// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { makeAssignment } from "../../../core/assignment";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { FIRST_SONG_ID } from "../../lib/catalog";
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
    it("offers a brand-new player the tour with its feature steps", async () => {
        // Empty device → nothing discovered yet → the checklist shows.
        mount();
        expect(await screen.findByText("Getting started")).toBeTruthy();
        expect(screen.getByRole("link", { name: m.discover_compose() })).toBeTruthy();
    });

    it("opens with the keyboard tour, then settings, then the first piece", async () => {
        mount();
        await screen.findByText("Getting started");
        const links = screen.getAllByRole("link");
        // Meeting the keyboard leads: it is the only step that needs no piano, no cable
        // and no reading, and everything after it assumes you know what a key is.
        expect(links[0]?.getAttribute("href")).toBe("/en/basics/");
        // Then setting yourself up — the MIDI piano, hand size, the key mapping — and
        // playing your first piece follows.
        expect(links[1]?.getAttribute("href")).toBe("/en/settings/");
        expect(links[2]?.getAttribute("href")).toBe("/en/settings/");
        expect(links[3]?.getAttribute("href")).toBe("/en/settings/");
        expect(links[4]?.getAttribute("href")).toBe(`/en/play/${FIRST_SONG_ID}/`);
        // Then finding your level — after the first piece on purpose, so the test reads
        // someone who already knows the cursor and the colours, and ahead of every
        // corner so a pianist meets their shortcut in the first screenful.
        expect(links[5]?.getAttribute("href")).toBe("/en/placement/");
        expect(links[6]?.getAttribute("href")).toBe("/en/daily/");
    });

    it("leaves finding your level off the jump-straight-in shortcuts", async () => {
        mount();
        await screen.findByText("Getting started");

        // The pill is for steps that put fingers on keys now. A graded test that climbs
        // until you fail is not that, however early it sits.
        const level = screen.getByRole("link", { name: m.discover_placement() });
        expect(level.textContent).not.toContain(m.discover_jump_in());
    });

    it("marks the straight-to-the-keys steps with the jump-in pill", async () => {
        mount();
        await screen.findByText("Getting started");
        // Exactly the two steps that start you playing immediately — the first
        // piece and the daily challenge — carry the shortcut marker.
        expect(screen.getAllByText("Jump right in")).toHaveLength(2);
    });

    it("points the play step at the first assignment when one exists", async () => {
        localStorage.setItem(
            "plinky:assignments",
            JSON.stringify([makeAssignment({ name: "My set", items: [{ id: "some-piece" }] })]),
        );
        mount();
        await screen.findByText("Getting started");
        expect(
            screen.getByRole("link", { name: "Play your first piece" }).getAttribute("href"),
        ).toBe("/en/play/some-piece/");
    });

    it("dismisses for good when the ✕ is clicked", async () => {
        mount();
        await screen.findByText("Getting started");
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        await waitFor(() => expect(screen.queryByText("Getting started")).toBeNull());
        // The dismissal persists, so it stays gone on the next visit.
        expect(localStorage.getItem("plinky:seen-hints")).toContain("discovery-panel");
    });

    it("stays hidden for a player who has already dismissed it", async () => {
        localStorage.setItem("plinky:seen-hints", JSON.stringify(["discovery-panel"]));
        mount();
        // Give the post-mount read a chance to run, then confirm it never appears.
        await waitFor(() => expect(screen.queryByText("Getting started")).toBeNull());
    });
});
