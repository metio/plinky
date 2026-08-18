// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DEFAULT_DRILL, generateDrill } from "../../../core/drill";
import { buildScore } from "../../../core/musicxmlBuild";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { testPrefsStore } from "../../testing/stores";
import { ScoreViewer } from "./scoreViewer";

// The notes-highway reading mode covers the staff with a tall highway while playing.
// OSMD must stay mounted and drive the run underneath, so this verifies both: the
// highway appears, and a run still completes through the covered staff. OSMD renders
// only in a real browser.

const mount = (xml: string) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <ScoreViewer id="hw" xml={xml} title="Highway" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("notes-highway reading mode", () => {
    it("covers the staff while playing, and the run still completes through it", async () => {
        // Turn the reading mode on (the app's prefs store reads the same localStorage).
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        // A one-bar phrase whose every note is C5, so one key clears each position.
        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 1, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);

        // The highway is up once the run starts.
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();

        // Play the four notes on the on-screen key — the matcher walks the OSMD cursor
        // hidden behind the highway, so this proves the staff still drives the run.
        const key = await screen.findByLabelText("C 5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        expect(await screen.findByText("Run saved", undefined, { timeout: 30000 })).toBeTruthy();
    });

    it("draws each note as long as the engraving writes it", async () => {
        // The lengths reach the highway from a real OSMD read, and a fixture cannot tell
        // us they survive it: `writtenHoldMs` is derived per pitch while the score is
        // walked, so this is the only place the whole path — engraving to block height —
        // is exercised at once. A minim followed by quavers is the shape being read.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        const note = (step: string, value: "half" | "eighth") => ({
            pitch: { step, octave: 5, alter: 0 },
            value,
        });
        mount(
            buildScore({
                title: "Lengths",
                fifths: 0,
                beatsPerBar: 4,
                treble: [
                    note("C", "half"),
                    note("D", "eighth"),
                    note("E", "eighth"),
                    note("F", "eighth"),
                    note("G", "eighth"),
                ],
            }),
        );
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);

        const panel = await screen.findByLabelText(m.highway_label());
        const heights = Array.from(panel.querySelectorAll<HTMLElement>("span[style*='left']")).map(
            (block) => Number.parseFloat(block.style.height),
        );
        expect(heights.length).toBeGreaterThan(1);
        // A minim is four quavers. Anything that flattened the lengths — a row per
        // position, or reading the position's own length instead of each key's —
        // draws these the same.
        expect(heights[0]).toBeGreaterThan(heights[1]! * 3);
    });
});
