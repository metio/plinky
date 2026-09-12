// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildScore } from "../../../core/musicxmlBuild";
import type { PlayOptions } from "../../../core/playOptions";
import { DEFAULT_PREFS, type Prefs } from "../../../core/prefs";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { createPrefsStore } from "../../stores/prefsStore";
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

// Eight bars of held minims: long enough that Listen is still sounding when the test stops
// it, however slowly the browser gets there.
const LONG_SCORE = buildScore({
    title: "Long",
    fifths: 0,
    beatsPerBar: 4,
    treble: Array.from({ length: 16 }, () => ({
        pitch: { step: "C" as const, octave: 4, alter: 0 },
        value: "half" as const,
    })),
});

// A grand staff for the duet: the right hand holds two minims while the left walks
// crotchets under them, so clearing the right hand's first note leaves the left hand's
// second crotchet waiting on a timer across the gap. All four pitches sit inside the
// keyboard's window.
const DUET_SCORE = buildScore({
    title: "Duet",
    fifths: 0,
    beatsPerBar: 4,
    treble: [
        { pitch: { step: "E", octave: 4, alter: 0 }, value: "half" },
        { pitch: { step: "F", octave: 4, alter: 0 }, value: "half" },
    ],
    bass: [
        { pitch: { step: "C", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "D", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "C", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "D", octave: 4, alter: 0 }, value: "quarter" },
    ],
});

// The same shape cut to one right-hand note, so clearing it ends the run with the left
// hand's second crotchet still to come.
const DUET_ENDING_SCORE = buildScore({
    title: "Duet ending",
    fifths: 0,
    beatsPerBar: 2,
    treble: [{ pitch: { step: "E", octave: 4, alter: 0 }, value: "half" }],
    bass: [
        { pitch: { step: "C", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "D", octave: 4, alter: 0 }, value: "quarter" },
    ],
});

// The Runs tab belongs to the route's mode bar; this stand-in button plays that part, so a
// kept take can be replayed the way the page replays it.
function Surface({ xml = CHORD_SCORE, options }: { xml?: string; options?: PlayOptions }) {
    const [runsView, setRunsView] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setRunsView(true)}>
                Runs
            </button>
            <ScoreViewer
                id="chord"
                xml={xml}
                title="Chord"
                runsView={runsView}
                onShowScore={() => setRunsView(false)}
                {...(options ? { options } : {})}
            />
        </>
    );
}

function mount({
    surface = true,
    xml = CHORD_SCORE,
    prefs = {},
    options,
}: {
    surface?: boolean;
    xml?: string;
    prefs?: Partial<Prefs>;
    options?: PlayOptions;
} = {}) {
    // Inject a fake MIDI seam (the browser grants real Web MIDI otherwise) and a
    // recording audio engine so the test can assert what would have sounded.
    const audio = fakeAudioEngine();
    const store = memoryStore();
    createPrefsStore(store).save({ ...DEFAULT_PREFS, ...prefs });
    const tree = (shown: boolean) => (
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi(), audio, store }}>
                <MidiProvider>
                    {shown && <Surface xml={xml} {...(options ? { options } : {})} />}
                </MidiProvider>
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

    it("takes back the notes Listen struck when the player stops it on the resting page", async () => {
        // A resting-page Listen never enters full screen, so nothing but the stop itself can
        // reach the engine — and each note is a strike scheduled whole on the audio clock.
        const { audio } = mount({ xml: LONG_SCORE });
        await awaitReady();
        fireEvent.click(listenButton());
        await expect.poll(() => audio.strikes.length, { timeout: 30000 }).toBeGreaterThan(0);
        const owner = audio.strikes[0]?.owner;
        expect(typeof owner).toBe("symbol");
        fireEvent.click(listenButton());
        await expect.poll(listening, { timeout: 30000 }).toBe("false");
        expect(audio.strikesSilenced).toContain(owner);
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

describe("the duet's other hand", () => {
    // A left-hand strike the duet made: a pitch the right hand never plays, under an owner.
    const duetStrikes = (audio: ReturnType<typeof fakeAudioEngine>) =>
        audio.strikes.filter((strike) => strike.note === 60 || strike.note === 62);
    const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it("stops sounding across the gap when the player stops the run", async () => {
        const { audio } = mount({
            xml: DUET_SCORE,
            prefs: { duet: true },
            options: { hands: "right" },
        });
        await startPractice();
        const e4 = await screen.findByLabelText("E 4");
        fireEvent.pointerDown(e4);
        fireEvent.pointerUp(e4);
        // The left hand's first crotchet sounds with the cleared note; its second waits on a
        // timer for a beat.
        await expect.poll(() => duetStrikes(audio).length, { timeout: 30000 }).toBe(1);
        // Starting the run already cleared the way for it; only what the stop does counts.
        const before = audio.strikesSilenced.length;
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        // Longer than the gap at any tempo the page opens on: nothing it scheduled arrives.
        await settle(3000);
        expect(duetStrikes(audio)).toHaveLength(1);
        // And the crotchet already sounding is taken back with it.
        const owner = duetStrikes(audio)[0]?.owner;
        expect(typeof owner).toBe("symbol");
        expect(audio.strikesSilenced.slice(before)).toContain(owner);
    });

    it("plays the other hand's ending out when the run reaches its end", async () => {
        const { audio } = mount({
            xml: DUET_ENDING_SCORE,
            prefs: { duet: true },
            options: { hands: "right" },
        });
        await startPractice();
        const e4 = await screen.findByLabelText("E 4");
        // The only right-hand note: clearing it finishes the run, and letting go closes the
        // stage with the left hand's last crotchet still a beat away.
        fireEvent.pointerDown(e4);
        await expect.poll(() => duetStrikes(audio).length, { timeout: 30000 }).toBe(1);
        // Starting the run already cleared the way for it; only what the ending does counts.
        const before = audio.strikesSilenced.length;
        fireEvent.pointerUp(e4);
        await expect.poll(() => duetStrikes(audio).length, { timeout: 30000 }).toBe(2);
        const [first] = duetStrikes(audio);
        expect(typeof first?.owner).toBe("symbol");
        expect(audio.strikesSilenced.slice(before)).not.toContain(first?.owner);
    });
});

describe("a play-along's notes", () => {
    it("are taken back when the player stops it on stage", async () => {
        // Keep up's Stop leaves the stage open, so nothing but the stop itself reaches the
        // engine — and each guide note is a strike scheduled whole on the audio clock.
        const { audio } = mount({ xml: LONG_SCORE, prefs: { keepUp: true, guideNotes: true } });
        await startPractice();
        await expect.poll(() => audio.strikes.length, { timeout: 30000 }).toBeGreaterThan(0);
        const owner = audio.strikes[0]?.owner;
        expect(typeof owner).toBe("symbol");
        const before = audio.strikesSilenced.length;
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        await expect
            .poll(() => audio.strikesSilenced.slice(before), { timeout: 30000 })
            .toContain(owner);
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
