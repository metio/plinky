// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildScore } from "../../../core/musicxmlBuild";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
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

// The Runs tab belongs to the route's mode bar; this stand-in button plays that part, so a
// kept take can be replayed the way the page replays it.
function Surface() {
    const [runsView, setRunsView] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setRunsView(true)}>
                Runs
            </button>
            <ScoreViewer
                id="chord"
                xml={CHORD_SCORE}
                title="Chord"
                runsView={runsView}
                onShowScore={() => setRunsView(false)}
            />
        </>
    );
}

function mount({ surface = true } = {}) {
    // Inject a fake MIDI seam (the browser grants real Web MIDI otherwise) and a
    // recording audio engine so the test can assert what would have sounded.
    const audio = fakeAudioEngine();
    const tree = (shown: boolean) => (
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi(), audio }}>
                <MidiProvider>{shown && <Surface />}</MidiProvider>
            </ServicesProvider>
        </MemoryRouter>
    );
    const view = render(tree(surface));
    return { audio, unmount: view.unmount, open: () => view.rerender(tree(true)) };
}

const listenButton = () => screen.getByRole("button", { name: m.action_listen() });
const listening = () => listenButton().getAttribute("aria-pressed");

// Practice is enabled once the score is interactive, so it is the readiness gate.
const awaitReady = async () => {
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    // OSMD can be slow to make the score interactive under full-suite load; give the
    // readiness poll the same generous window as the findBy above.
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
        .toBe(false);
    return practice;
};

const startPractice = async () => {
    vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
    fireEvent.click(await awaitReady());
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

    it("starts under a pedal the player was already holding as the surface opened", async () => {
        // The engine hears a pedal only when it moves on a sounding surface. Pressed while
        // nothing was listening, it has to be handed over as the surface arrives.
        const { audio, open } = mount({ surface: false });
        act(() => window.__plinky?.pedal("sustain", true));
        expect(audio.pedals).toEqual([]);
        open();
        await expect
            .poll(() => audio.pedals, { timeout: 30000 })
            .toContainEqual({ pedal: "sustain", down: true });
    });
});

describe("the instrument a run commits to", () => {
    it("keeps the next run's instrument when Practice takes over from Listen", async () => {
        // The two runs hand over in one handler, so "performing" never reads false between
        // them and nothing releases the commitment the new run has just made.
        const { audio } = mount();
        await startPractice();
        fireEvent.click(listenButton());
        await expect.poll(listening, { timeout: 30000 }).toBe("true");
        const before = audio.committed;
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        await expect.poll(() => audio.committed, { timeout: 30000 }).toBe(before + 1);
        expect(audio.holdingVoice).toBe(true);
    });

    it("lets it go when Listen is stopped", async () => {
        const { audio } = mount();
        await awaitReady();
        fireEvent.click(listenButton());
        await expect.poll(() => audio.holdingVoice, { timeout: 30000 }).toBe(true);
        fireEvent.click(listenButton());
        await expect.poll(() => audio.holdingVoice, { timeout: 30000 }).toBe(false);
    });

    it("lets it go when Listen plays to the end", async () => {
        const { audio } = mount();
        await awaitReady();
        fireEvent.click(listenButton());
        await expect.poll(() => audio.committed, { timeout: 30000 }).toBe(1);
        await expect.poll(listening, { timeout: 30000 }).toBe("false");
        // The release is an effect of the render that ends Listen, so it can land a frame after
        // the attribute does.
        await expect.poll(() => audio.holdingVoice, { timeout: 30000 }).toBe(false);
    });

    it("lets it go when a replayed take ends", async () => {
        const { audio } = mount();
        await startPractice();
        // One chord clears the one position and ends the run; letting go saves the take.
        const e4 = await screen.findByLabelText("E 4");
        const c4 = await screen.findByLabelText("C 4");
        fireEvent.pointerDown(e4);
        fireEvent.pointerDown(c4);
        fireEvent.pointerUp(e4);
        fireEvent.pointerUp(c4);
        expect(await screen.findByText("Run saved", undefined, { timeout: 30000 })).toBeTruthy();
        fireEvent.click(await screen.findByRole("button", { name: "Runs" }));
        const before = audio.committed;
        fireEvent.click(
            (await screen.findAllByRole("button", { name: m.takes_replay() }))[0] as HTMLElement,
        );
        await expect.poll(() => audio.committed, { timeout: 30000 }).toBe(before + 1);
        await expect.poll(() => audio.holdingVoice, { timeout: 30000 }).toBe(false);
    });

    it("lets it go when the page is left mid-run", async () => {
        const { audio, unmount } = mount();
        await startPractice();
        await expect.poll(() => audio.holdingVoice, { timeout: 30000 }).toBe(true);
        unmount();
        expect(audio.holdingVoice).toBe(false);
    });
});
