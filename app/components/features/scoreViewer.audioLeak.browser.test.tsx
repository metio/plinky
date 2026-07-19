// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildScore } from "../../../core/musicxmlBuild";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { ScoreViewer } from "./scoreViewer";

// A guard for the "one note rings forever after finishing a song" leak. The guide
// tone is pressed per cleared position but released per physical key-up, so a chord
// cleared with an earlier pitch already lifted would open a voice that never ends.
// A grand-staff score gives a single two-pitch position (a treble note over a bass
// note) that can be rolled — play one, release it, then play the other — so the
// position clears with one key already up. OSMD renders only in a real browser.

// One position: E4 over C4 — a close grand-staff interval, so both keys sit inside
// the on-screen keyboard's window at once. Half notes fill the two-beat bar.
const CHORD_SCORE = buildScore({
    title: "Chord",
    fifths: 0,
    beatsPerBar: 2,
    treble: [{ pitch: { step: "E", octave: 4, alter: 0 }, value: "half" }],
    bass: [{ pitch: { step: "C", octave: 4, alter: 0 }, value: "half" }],
});

function mount() {
    // Inject a fake MIDI seam (the browser grants real Web MIDI otherwise) and a
    // recording audio engine so the test can assert what would have sounded.
    const audio = fakeAudioEngine();
    const view = render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi(), audio }}>
                <MidiProvider>
                    <ScoreViewer id="chord" xml={CHORD_SCORE} title="Chord" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
    return { audio, unmount: view.unmount };
}

const startPractice = async () => {
    vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    // OSMD can be slow to make the score interactive under full-suite load; give the
    // readiness poll the same generous window as the findBy above.
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
        .toBe(false);
    fireEvent.click(practice);
};

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("play-surface audio cleanup", () => {
    it("leaves no guide voice ringing when a chord is rolled to completion", async () => {
        const { audio } = mount();
        await startPractice();
        // Roll the E4+C4 position: play the treble note and RELEASE it, then play the
        // bass — the position clears on the bass with the treble key already lifted.
        const e4 = await screen.findByLabelText("E 4");
        const c4 = await screen.findByLabelText("C 4");
        fireEvent.pointerDown(e4);
        fireEvent.pointerUp(e4);
        fireEvent.pointerDown(c4);
        fireEvent.pointerUp(c4);
        // Every guide voice that was pressed must have received a matching release — no
        // pitch left sounding. Before the fix, clearing the chord pressed a voice for the
        // already-lifted E4 that no key-up would ever release.
        // Replay the press/release stream as the engine would: a press opens a voice, a
        // release closes it. No voice may be left open at the end — that open voice is the
        // note that rings forever. (Order matters: before the fix, clearing the chord
        // pressed E4 *after* its key-up had already passed, so its voice never closed.)
        await waitFor(() => {
            const live = new Set<number>();
            for (const event of audio.voices) {
                if (event.kind === "press") {
                    live.add(event.note);
                } else {
                    live.delete(event.note);
                }
            }
            expect([...live]).toEqual([]);
        });
    });

    it("silences the synth when the play surface unmounts", async () => {
        const { audio, unmount } = mount();
        await startPractice();
        fireEvent.pointerDown(await screen.findByLabelText("E 4"));
        unmount();
        // The engine's voices are a process-lifetime singleton, so unmount must panic
        // them — nothing can outlive the surface, whatever state it was left in.
        expect(audio.silenced).toBeGreaterThan(0);
    });
});
