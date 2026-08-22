// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOMINAL_BPM } from "../../core/elapsed";
import { NO_SCORE_MARKS, type ScoreMarks } from "../../core/musicxmlMarks";
import type { Take } from "../../core/takes";
import { collectListenSteps, useListenPlayback } from "./useListenPlayback";

// The colour helpers walk real OSMD graphics; stub them so the fake score
// below only has to model the cursor walk itself.
vi.mock("../lib/scoreColor", () => ({
    highlightCursorNotes: vi.fn(() => []),
    restoreNotes: vi.fn(),
    trailNotes: vi.fn(),
}));
vi.mock("../lib/scoreCursor", () => ({
    seekToBar: vi.fn(),
    seekToWhole: vi.fn(),
}));

// A score whose cursor ends after `steps` voice entries, each holding one
// sounding quarter note (halfTone 48 ≈ C4 after the +12 octave shift). Extra note
// fields (articulations, ties, slurs) can be injected to drive the expressive reader, and
// `volume` writes a dynamic onto the sheet the way OSMD parses one — on the measure, at
// the top of the piece, standing over every position.
function fakeOsmd(steps: number, noteOver: Record<string, unknown> = {}, volume?: number) {
    let position = 0;
    const cursor = {
        reset: vi.fn(() => {
            position = 0;
        }),
        show: vi.fn(),
        hide: vi.fn(),
        next: vi.fn(() => {
            position++;
        }),
        iterator: {
            get EndReached() {
                return position >= steps;
            },
            get CurrentMeasureIndex() {
                return position;
            },
            // Each position is one quarter — a quarter of a whole — so onsets advance the
            // way a real walk's do. A fake that reported the same onset everywhere would
            // let a caller reading the position pass while reading it wrongly.
            get currentTimeStamp() {
                return { RealValue: position * 0.25 };
            },
        },
        NotesUnderCursor: () => [
            {
                Length: { RealValue: 0.25 },
                isRest: () => false,
                halfTone: 48,
                ...noteOver,
            },
        ],
    };
    const sheet = {
        SourceMeasures:
            volume === undefined
                ? []
                : [
                      {
                          AbsoluteTimestamp: { RealValue: 0 },
                          staffLinkedExpressions: [
                              [
                                  {
                                      timestamp: { RealValue: 0 },
                                      instantaneousDynamic: { MidiVolume: volume },
                                  },
                              ],
                          ],
                      },
                  ],
    };
    return { cursor, sheet } as unknown as OpenSheetMusicDisplay;
}

const playNote = vi.fn();
const onLap = vi.fn();
let loopState: { on: boolean; from: number; to: number };

const onPosition = vi.fn();

// The score's markings. They no longer come off the engraver, so a test that wants a
// dynamic in force says what the score writes rather than mimicking an object shape.
function mount(osmd: OpenSheetMusicDisplay | null, marks: ScoreMarks = NO_SCORE_MARKS) {
    return renderHook(() =>
        useListenPlayback({
            getOsmd: () => osmd,
            synth: { playNote },
            tempo: () => 120,
            loop: () => loopState,
            onLap,
            centerCursor: () => {},
            onPosition,
            marks,
            markPainted: () => {},
            isPracticing: () => false,
        }),
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    loopState = { on: false, from: 1, to: 1 };
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe("collectListenSteps", () => {
    it("lifts each position: the striking notes, the dynamic, and the lengths", () => {
        const steps = collectListenSteps(fakeOsmd(2));
        expect(steps).toHaveLength(2);
        expect(steps[0]).toEqual({
            notes: [
                {
                    pitch: 60,
                    soundQuarters: 1,
                    articulation: "none",
                    accent: false,
                    marcato: false,
                    slurred: false,
                    pedalled: false,
                    hand: "right",
                },
            ],
            dynamicVolume: null,
            lengths: [1],
            whole: 0,
            measureIndex: 0,
            soft: false,
            bpm: NOMINAL_BPM,
            stretch: 1,
            advancesCursor: true,
            interpretation: 1,
        });
    });

    it("reports the pedal as well as ringing under it", () => {
        // Two separate facts about a pedalled note, and only one of them is its length.
        // `soundQuarters` rings to the end of the span, which is what the ear hears as
        // "held". `pedalled` is that the dampers are off the OTHER strings, which is the
        // rest of what a pedal does and which no amount of lengthening conveys — a recorded
        // piano has a resonance to play for it.
        const pedalled = collectListenSteps(fakeOsmd(2), {
            ...NO_SCORE_MARKS,
            pedals: [{ from: 0, to: 4 }],
        });
        expect(pedalled[0]?.notes[0]?.pedalled).toBe(true);
        expect(pedalled[0]?.notes[0]?.soundQuarters).toBeGreaterThan(1);

        const dry = collectListenSteps(fakeOsmd(2));
        expect(dry[0]?.notes[0]?.pedalled).toBe(false);
    });

    it("shakes a tremolo instead of holding one long note", () => {
        // The mark is shorthand for a repetition. Printed but not played, the page shows a
        // shimmer and the ear hears a plain long note — and a reader learning to recognise
        // the sign hears nothing happen where it is written.
        const steps = collectListenSteps(fakeOsmd(2), {
            ...NO_SCORE_MARKS,
            tremolos: [{ from: 0, to: 0.5, beams: 2, pair: null }],
        });
        expect(steps.length).toBeGreaterThan(2);
        expect(
            steps.every((step) =>
                step.notes.every((note) => note.pitch === steps[0]?.notes[0]?.pitch),
            ),
        ).toBe(true);
    });

    it("rocks an alternating tremolo between the two written chords", () => {
        const steps = collectListenSteps(fakeOsmd(2), {
            ...NO_SCORE_MARKS,
            tremolos: [
                {
                    from: 0,
                    to: 0.5,
                    beams: 2,
                    pair: [
                        { at: 0, pitches: [36] },
                        { at: 0.5, pitches: [43] },
                    ],
                },
            ],
        });
        const sounded = steps.slice(0, 4).map((step) => step.notes[0]?.pitch);
        expect(sounded[0]).not.toBe(sounded[1]);
        expect(sounded[0]).toBe(sounded[2]);
        expect(sounded[1]).toBe(sounded[3]);
    });

    it("sweeps a glissando across the keys between its two notes", () => {
        const steps = collectListenSteps(fakeOsmd(2), {
            ...NO_SCORE_MARKS,
            glissandos: [{ from: 0, to: 0.5, arrivesAt: 72 }],
        });
        const swept = steps.map((step) => step.notes[0]?.pitch ?? 0);
        expect(swept.length).toBeGreaterThan(2);
        // Rising, and stopping short of the arrival — the note it lands on is a position of
        // its own and sounds by itself, so sweeping onto it would strike it twice.
        expect(swept.slice(0, 3)).toEqual([...swept.slice(0, 3)].sort((a, b) => a - b));
    });

    it("gentles a passage under the soft pedal", () => {
        const softly = collectListenSteps(fakeOsmd(1), {
            ...NO_SCORE_MARKS,
            softs: [{ from: 0, to: 4 }],
        });
        expect(softly[0]?.soft).toBe(true);
        expect(collectListenSteps(fakeOsmd(1))[0]?.soft).toBe(false);
    });

    it("drops a rest from the sounding notes but keeps its length for the beat", () => {
        const steps = collectListenSteps(
            fakeOsmd(1, { isRest: () => true, halfTone: 0, Length: { RealValue: 0.5 } }),
        );
        expect(steps[0]?.notes).toEqual([]);
        expect(steps[0]?.lengths).toEqual([2]);
    });
});

describe("useListenPlayback", () => {
    it("walks the score, sounding each entry at the tempo, and stops at the end", () => {
        const osmd = fakeOsmd(2);
        const { result } = mount(osmd);

        act(() => result.current.start(0));
        expect(result.current.playing).toBe(true);
        // The first entry sounds immediately, sustained per the 120 BPM tempo, at the
        // default velocity since the score marks no dynamic.
        expect(playNote).toHaveBeenCalledWith(60, {
            duration: 0.5,
            velocity: 90,
            pedalled: false,
        });

        // Each quarter at 120 BPM is 500ms; after both entries the walk ends.
        act(() => void vi.advanceTimersByTime(500));
        expect(playNote).toHaveBeenCalledTimes(2);
        act(() => void vi.advanceTimersByTime(500));
        expect(result.current.playing).toBe(false);
        expect(onLap).toHaveBeenCalledTimes(1);
        expect(osmd.cursor.hide).toHaveBeenCalled();
    });

    it("reports where the music has reached, before the position sounds", () => {
        // The notes highway reads this to draw what is coming. Reporting after the notes
        // sound would leave the highway one position behind the ear for the whole piece;
        // not reporting at all is what made Listen drop the highway and show the staff.
        const osmd = fakeOsmd(3);
        const { result } = mount(osmd);

        act(() => result.current.start(0));
        expect(onPosition).toHaveBeenNthCalledWith(1, 0);
        act(() => void vi.advanceTimersByTime(500));
        expect(onPosition).toHaveBeenNthCalledWith(2, 0.25);
        act(() => void vi.advanceTimersByTime(500));
        expect(onPosition).toHaveBeenNthCalledWith(3, 0.5);
    });

    it("ignores a second start while one walk owns the cursor", () => {
        const osmd = fakeOsmd(4);
        const { result } = mount(osmd);
        act(() => result.current.start(0));
        const heard = playNote.mock.calls.length;
        act(() => result.current.start(0));
        expect(playNote).toHaveBeenCalledTimes(heard);
    });

    it("laps back to the loop's start bar instead of stopping", () => {
        const osmd = fakeOsmd(1);
        loopState = { on: true, from: 1, to: 1 };
        const { result } = mount(osmd);

        act(() => result.current.start(0));
        // Reaching the end while looping counts a lap and keeps playing.
        act(() => void vi.advanceTimersByTime(500));
        expect(onLap).toHaveBeenCalled();
        expect(result.current.playing).toBe(true);
        act(() => result.current.stop());
    });

    it("replays a take on its own recorded clock and marks it active", () => {
        const osmd = fakeOsmd(10);
        const { result } = mount(osmd);
        const take: Take = {
            id: "t1",
            createdAt: 0,
            letter: "A",
            complete: true,
            metrics: null,
            composition: {
                notes: [
                    { pitch: 60, startMs: 0, durationMs: 400, velocity: 80 },
                    { pitch: 64, startMs: 300, durationMs: 400, velocity: 90 },
                ],
                tempo: 120,
                beatsPerBar: 4,
            },
        };

        act(() => result.current.replay(take));
        expect(result.current.activeReplayId).toBe("t1");
        expect(playNote).toHaveBeenCalledWith(60, { velocity: 80, duration: 0.4 });

        // The second event fires at its recorded offset, then the tail closes.
        act(() => void vi.advanceTimersByTime(300));
        expect(playNote).toHaveBeenCalledWith(64, { velocity: 90, duration: 0.4 });
        act(() => void vi.advanceTimersByTime(500));
        expect(result.current.playing).toBe(false);
        expect(result.current.activeReplayId).toBeNull();
    });

    it("plays the score's expression — staccato clips, accent strikes harder, dynamics set loudness", () => {
        // A staccato note (articulationEnum 6) clips to half its length.
        const staccato = mount(
            fakeOsmd(1, { ParentVoiceEntry: { Articulations: [{ articulationEnum: 6 }] } }),
        );
        act(() => staccato.result.current.start(0));
        expect(playNote).toHaveBeenCalledWith(60, {
            duration: 0.25,
            velocity: 90,
            pedalled: false,
        });
        act(() => staccato.result.current.stop());
        playNote.mockClear();

        // An accent (articulationEnum 0) strikes harder than the default velocity.
        const accent = mount(
            fakeOsmd(1, { ParentVoiceEntry: { Articulations: [{ articulationEnum: 0 }] } }),
        );
        act(() => accent.result.current.start(0));
        const [, accentOpts] = playNote.mock.calls[0]!;
        expect(accentOpts.velocity).toBeGreaterThan(90);
        act(() => accent.result.current.stop());
        playNote.mockClear();

        // A marked dynamic sets the loudness outright.
        const soft = mount(fakeOsmd(1), {
            ...NO_SCORE_MARKS,
            dynamics: [{ whole: 0, volume: 40, ramp: false }],
        });
        act(() => soft.result.current.start(0));
        expect(playNote).toHaveBeenCalledWith(60, {
            duration: 0.5,
            velocity: 40,
            pedalled: false,
        });
        act(() => soft.result.current.stop());
    });

    it("does not re-strike a tie's continuation note", () => {
        // A note tied FROM an earlier one (its tie starts on a different note) is held,
        // not struck again — nothing sounds while the walk still advances.
        const tied = mount(fakeOsmd(1, { NoteTie: { StartNote: {}, Notes: [{}] } }));
        act(() => tied.result.current.start(0));
        expect(playNote).not.toHaveBeenCalled();
        act(() => tied.result.current.stop());
    });

    it("does nothing without a rendered score", () => {
        const { result } = mount(null);
        act(() => result.current.start(0));
        expect(result.current.playing).toBe(false);
        expect(playNote).not.toHaveBeenCalled();
    });

    it("echoes each note it sounds to a connected instrument", () => {
        // Playback lights an instrument's keys through the callback it is given —
        // the same notes, the same lengths, so the keyboard shows what is heard.
        const echoed: Array<[number, number, number]> = [];
        const osmd = fakeOsmd(2);
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () => osmd,
                synth: { playNote },
                tempo: () => 120,
                loop: () => loopState,
                onLap,
                centerCursor: () => {},
                markPainted: () => {},
                isPracticing: () => false,
                echoNote: (note, velocity, durationMs) => {
                    echoed.push([note, velocity, durationMs]);
                },
            }),
        );

        act(() => result.current.start(0));

        // The first note sounds for half a second at 120 BPM; the echo says the same
        // in milliseconds.
        expect(echoed[0]).toEqual([60, 90, 500]);
    });

    it("plays perfectly well with no echo wired at all", () => {
        // A caller outside a MIDI provider passes none; playback must not care.
        const osmd = fakeOsmd(2);
        const { result } = mount(osmd);

        act(() => result.current.start(0));

        expect(result.current.playing).toBe(true);
        expect(playNote).toHaveBeenCalledTimes(1);
    });

    it("says which notes are sounding, and in which hand", async () => {
        // What the on-screen keyboard lights while Listen demonstrates a piece. "Now" is a
        // fact only this clock knows — not the position the cursor is drawn on (an ornament
        // leaves it where it is) and not the one the matcher last saw before standing down.
        const osmd = fakeOsmd(2);
        const { result } = mount(osmd);

        expect(result.current.sounding.size).toBe(0);
        act(() => result.current.start(0));
        expect([...result.current.sounding]).toEqual([[60, "right"]]);

        act(() => void vi.advanceTimersByTime(500));
        expect(result.current.sounding.size).toBe(1);

        // Stopping puts the keys out; leaving the last chord lit for ever is worse than
        // never having lit it.
        act(() => result.current.stop());
        expect(result.current.sounding.size).toBe(0);
    });
});
