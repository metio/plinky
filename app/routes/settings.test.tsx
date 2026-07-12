// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { renderWithServices } from "../testing/renderWithServices";
import Settings from "./settings";

afterEach(cleanup);

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

        fireEvent.click(screen.getByRole("switch", { name: "Play note sounds" }));
        expect(services.prefs.load().sound).toBe(false);
    });

    it("persists a segmented choice and marks it selected", () => {
        const { services } = mount();

        const s = screen.getByRole("tab", { name: "S" });
        fireEvent.click(s);
        expect(services.prefs.load().masteryThreshold).toBe("S");
        expect(s.getAttribute("aria-selected")).toBe("true");
    });

    it("disables the volume slider while sound is off, and persists the level", () => {
        const { services } = mount();
        const slider = screen.getByLabelText<HTMLInputElement>("Volume");

        fireEvent.change(slider, { target: { value: "25" } });
        expect(services.prefs.load().volume).toBe(25);

        fireEvent.click(screen.getByRole("switch", { name: "Play note sounds" }));
        expect(slider.disabled).toBe(true);
    });

    it("relabels the example piano when the note-labels choice changes", () => {
        const { services } = mount();
        // The default labels only the C keys as landmarks.
        expect(services.prefs.load().noteLabels).toBe("c");

        fireEvent.click(screen.getByRole("tab", { name: "Every key" }));
        expect(services.prefs.load().noteLabels).toBe("all");
        // The example octave now prints a label on a non-C key too.
        expect(screen.getByLabelText("D4").textContent).toContain("D");
    });

    it("stays in sync with a save made by a nested panel", () => {
        const { services } = mount();

        // The Hand size panel saves independently; the page-level controls must
        // keep editing the latest prefs rather than clobbering that save.
        services.prefs.save({ ...services.prefs.load(), handSpan: { left: 9, right: null } });
        fireEvent.click(
            screen.getByRole("switch", { name: "Show finger position hints while practicing" }),
        );

        const stored = services.prefs.load();
        expect(stored.showFingerings).toBe(true);
        expect(stored.handSpan).toEqual({ left: 9, right: null });
    });

    it("hides the MIDI section where Web MIDI is unsupported", () => {
        mount();
        // jsdom has no navigator.requestMIDIAccess, so the whole panel is gone.
        expect(screen.queryByText("Connect MIDI")).toBeNull();
    });
});
