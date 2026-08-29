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
import { PlaySessionProvider, usePlaySetup } from "./playSession";
import { PlaySurface } from "./playSurface";

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

// The session's own transpose control, so a test can put the piece in another key the way
// the player does rather than by rebuilding the score.
let transposeTo: (semitones: number) => void = () => {};
function Probe() {
    const session = usePlaySetup();
    transposeTo = session.setTranspose;
    return null;
}

async function mount(samples: ReturnType<typeof fakeSampleSource>) {
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi(), audio: fakeAudioEngine(), samples }}>
                <MidiProvider>
                    <PlaySessionProvider id="prefetch" xml={SCORE} title="Prefetch">
                        <PlaySurface />
                        <Probe />
                    </PlaySessionProvider>
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

    // Its own timeout, longer than the poll inside it. A poll may not outlast the test
    // holding it: the projects cap a test at 60s (vitest.config.ts), so raising the poll to
    // 90s inside a 60s test made the extra thirty seconds unreachable and turned a clear
    // failure — "the transposed prefetch had not happened yet" — into a bare test timeout
    // that says nothing about the thing under test.
    it("asks again for the notes it sounds once the piece moves to another key", async () => {
        // A transposed passage needs the recordings of the notes it now plays. Nothing else
        // asks for them: the piece was prefetched in its written key and the re-engraving
        // carries no request of its own.
        //
        // The guard is against a reload finishing inside a single commit, which leaves the
        // effect's dependencies looking untouched — Firefox does that, and every transposed
        // note there fell back to the synthesised voice while Chromium sounded recorded.
        const samples = fakeSampleSource(null);
        await samples.enable();
        await mount(samples);
        await expect.poll(() => samples.prepared.length, { timeout: 30000 }).toBeGreaterThan(0);

        transposeTo(12);
        // C3, E4 and G4 an octave up.
        await expect
            .poll(
                () =>
                    [...new Set(samples.prepared.flat().map((note) => note.pitch))].sort(
                        (a, b) => a - b,
                    ),
                // Longer than the poll above it, and deliberately so. That one waits for a
                // prefetch on a page that is already engraved; this one waits for the score
                // to be transposed, re-engraved and read again, which is the whole reload
                // chain. On a loaded CI runner — where this file's imports alone have taken
                // twenty minutes and a single browser test twenty seconds — thirty seconds
                // is not a claim that nothing happened, only that it had not happened yet.
                { timeout: 90_000 },
            )
            .toEqual([48, 60, 64, 67, 76, 79]);
    }, 150_000);

    it("asks for nothing while the player is on the synthesised piano", async () => {
        // The default. Nothing is fetched, so a player who never turns it on never pays
        // for it — not a byte, not a request.
        const samples = fakeSampleSource(null);
        await samples.forget();
        await mount(samples);
        expect(samples.prepared).toEqual([]);
    });
});
