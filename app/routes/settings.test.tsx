// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { m } from "../paraglide/messages.js";
import { choose } from "../testing/controls";
import { switchOn, toggle } from "../testing/controls";
import { renderWithServices } from "../testing/renderWithServices";
import Settings, { meta } from "./settings";

afterEach(cleanup);

describe("Settings meta", () => {
    it("keeps the personal settings page out of the search index", () => {
        const tags = meta({} as Parameters<typeof meta>[0]) as Record<string, string>[];
        expect(tags).toContainEqual({ name: "robots", content: "noindex, follow" });
    });
});

const mount = () =>
    renderWithServices(
        <MemoryRouter>
            <MidiProvider>
                <Settings />
            </MidiProvider>
        </MemoryRouter>,
    );

describe("Settings", () => {
    it("persists a flipped switch through the prefs store", () => {
        const { services } = mount();
        expect(services.prefs.load().sound).toBe(true);

        toggle(m.settings_play_sounds);
        expect(services.prefs.load().sound).toBe(false);
        expect(switchOn(m.settings_play_sounds)).toBe(false);
    });

    it("persists a segmented choice and marks it selected", () => {
        const { services } = mount();

        choose(m.settings_mastery_threshold, "S");
        expect(services.prefs.load().masteryThreshold).toBe("S");
    });

    it("disables the volume slider while sound is off, and persists the level", () => {
        const { services } = mount();
        const slider = screen.getByLabelText<HTMLInputElement>(m.settings_volume());

        fireEvent.change(slider, { target: { value: "25" } });
        expect(services.prefs.load().volume).toBe(25);

        toggle(m.settings_play_sounds);
        expect(slider.disabled).toBe(true);
    });

    it("relabels the example piano when the note-labels choice changes", () => {
        const { services } = mount();
        // The default labels every key, so a non-C key carries its letter.
        expect(services.prefs.load().noteLabels).toBe("all");
        expect(screen.getByLabelText("D 4").textContent).toContain("D");

        choose(m.settings_note_labels, m.note_labels_c);
        expect(services.prefs.load().noteLabels).toBe("c");
        // Only the C landmarks stay labelled now.
        expect(screen.getByLabelText("D 4").textContent).not.toContain("D");
    });

    it("stays in sync with a save made by a nested panel", () => {
        const { services } = mount();

        // The Hand size panel saves independently; the page-level controls must
        // keep editing the latest prefs rather than clobbering that save.
        services.prefs.save({ ...services.prefs.load(), handSpan: { left: 9, right: null } });
        toggle(m.settings_show_fingerings);

        const stored = services.prefs.load();
        expect(stored.showFingerings).toBe(true);
        expect(stored.handSpan).toEqual({ left: 9, right: null });
    });

    it("hides the MIDI section where Web MIDI is unsupported", () => {
        mount();
        // jsdom has no navigator.requestMIDIAccess, so the whole panel is gone.
        expect(screen.queryByText(m.settings_connect_midi())).toBeNull();
    });
});
