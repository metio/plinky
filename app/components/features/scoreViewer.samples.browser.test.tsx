// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { buildScore } from "../../../core/musicxmlBuild";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { fakeSampleSource } from "../../adapters/fakeSampleSource";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { ScoreViewer } from "./scoreViewer";

// Whether opening a piece actually asks for its recordings.
//
// This is the test that was missing when the recorded piano shipped inert. Every unit
// around it passed: the adapter fetched and decoded, the lookup answered, the Settings
// switch worked. What none of them covered was the composition — a piece opening on a
// device where the choice is remembered but nothing is loaded yet, which is every page
// load — and there the prefetch waited for a manifest that only the prefetch would have
// fetched. The feature was dead in production behind a green suite.
//
// So the fixture is deliberately a COLD source: enabled, no manifest, nothing decoded. A
// warm one would pass either way, which is what made this hole easy to leave.
//
// It runs in a browser because the notes come from a real engraving: the point is that the
// piece names its own recordings, and only OSMD can say what a piece plays.

const SCORE = buildScore({
    title: "Prefetch",
    fifths: 0,
    beatsPerBar: 2,
    treble: [
        { pitch: { step: "E", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "G", octave: 4, alter: 0 }, value: "quarter" },
    ],
    bass: [{ pitch: { step: "C", octave: 3, alter: 0 }, value: "half" }],
});

afterEach(() => {
    cleanup();
    localStorage.clear();
});

async function mount(samples: ReturnType<typeof fakeSampleSource>) {
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi(), audio: fakeAudioEngine(), samples }}>
                <MidiProvider>
                    <ScoreViewer id="prefetch" xml={SCORE} title="Prefetch" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
    // The engraving is what the notes are read from, so nothing is asked for until it
    // exists. Practice becoming pressable is the app's own signal that it does.
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
        .toBe(false);
}

describe("a piece opening with the recorded piano on", () => {
    it("asks for its own recordings, on a device holding none yet", async () => {
        const samples = fakeSampleSource(null);
        // Enabled, with no manifest: the state after any reload, since the choice is
        // remembered on the device and the manifest only ever lives in memory.
        await samples.enable();
        await mount(samples);

        await expect.poll(() => samples.prepared.length, { timeout: 30000 }).toBeGreaterThan(0);
        const asked = samples.prepared.flat();
        // The notes the score writes, not a guess about the register: E4, G4 and the C3
        // underneath, each with the velocity the performance gives it.
        expect(asked.map((note) => note.pitch).sort((a, b) => a - b)).toEqual([48, 64, 67]);
        expect(asked.every((note) => note.velocity > 0)).toBe(true);
    });

    it("asks for nothing while the player is on the synthesised piano", async () => {
        // The default. Nothing is fetched, so a player who never turns it on never pays
        // for it — not a byte, not a request.
        const samples = fakeSampleSource(null);
        await samples.forget();
        await mount(samples);
        expect(samples.prepared).toEqual([]);
    });
});
