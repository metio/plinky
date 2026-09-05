// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOMINAL_BPM } from "../../core/elapsed";
import { NO_SCORE_MARKS, type ScoreMarks } from "../../core/musicxmlMarks";
import type { Take } from "../../core/takes";
import { collectListenSteps } from "../lib/listenSteps";
import { useListenPlayback } from "./useListenPlayback";

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

// A walk whose pitch changes from position to position, for the shaping that depends on the
// notes rather than on the clock. Each position is one quarter, as in fakeOsmd.
function lineOsmd(
    halfTones: readonly (number | number[])[],
    noteOver: Record<string, unknown> = {},
) {
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
                return position >= halfTones.length;
            },
            get CurrentMeasureIndex() {
                return position;
            },
            get currentTimeStamp() {
                return { RealValue: position * 0.25 };
            },
        },
        NotesUnderCursor: () => {
            const here = halfTones[position] ?? 60;
            return (Array.isArray(here) ? here : [here]).map((halfTone) => ({
                Length: { RealValue: 0.25 },
                isRest: () => false,
                halfTone,
                ...noteOver,
            }));
        },
    };
    return { cursor, Sheet: { SourceMeasures: [] } } as unknown as OpenSheetMusicDisplay;
}

// `onsets` overrides the printed position of each step, which is the only way to fake a
// written repeat: the walk goes forward but the ONSETS rewind, because the barline sends
// the reader back over bars already played. Left out, onsets march with the walk.
function fakeOsmd(
    steps: number,
    noteOver: Record<string, unknown> = {},
    volume?: number,
    onsets?: number[],
) {
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
                return { RealValue: onsets?.[position] ?? position * 0.25 };
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
            contour: 1,
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
            tremolos: [{ from: 0, to: 0.5, beams: 2, pitches: [], pair: null }],
        });
        expect(steps.length).toBeGreaterThan(2);
        expect(
            steps.every((step) =>
                step.notes.every((note) => note.pitch === steps[0]?.notes[0]?.pitch),
            ),
        ).toBe(true);
    });

    it("keeps the other hand in time under a tremolo, and the shake going under it", () => {
        // A left-hand minim tremolo under four right-hand quavers. The bar is still two
        // beats long, each quaver sounds once where it is written, and the shake carries on
        // beneath every one of them rather than stopping after the first.
        let position = 0;
        const onsets = [0, 0.125, 0.25, 0.375];
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
                    return position >= onsets.length;
                },
                get CurrentMeasureIndex() {
                    return 0;
                },
                get currentTimeStamp() {
                    return { RealValue: onsets[position] ?? 0 };
                },
            },
            NotesUnderCursor: () => [
                ...(position === 0
                    ? [{ Length: { RealValue: 0.5 }, isRest: () => false, halfTone: 24 }]
                    : []),
                { Length: { RealValue: 0.125 }, isRest: () => false, halfTone: 64 },
            ],
        };
        const osmd = { cursor, Sheet: { SourceMeasures: [] } } as unknown as OpenSheetMusicDisplay;
        const steps = collectListenSteps(osmd, {
            ...NO_SCORE_MARKS,
            tremolos: [{ from: 0, to: 0.5, beams: 3, pitches: [36], pair: null }],
        });
        const advance = steps.reduce((sum, step) => sum + Math.min(...step.lengths), 0);
        expect(advance).toBeCloseTo(2);
        const tunes = steps.flatMap((step) => step.notes.filter((note) => note.pitch === 76));
        expect(tunes).toHaveLength(4);
        const shakes = steps.filter((step) => step.notes.some((note) => note.pitch === 36));
        expect(shakes.length).toBeGreaterThan(4);
        // The shake goes on after the second quaver has been struck.
        const secondQuaver = steps.findIndex(
            (step, index) => index > 0 && step.notes.some((note) => note.pitch === 76),
        );
        expect(
            steps.slice(secondQuaver + 1).some((step) => step.notes.some((n) => n.pitch === 36)),
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
                    pitches: [36],
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

    it("leans into the top of a rising line", () => {
        // The four-bar arch knows nothing about the notes, so it plays every group of four
        // bars identically. This is the half of the shaping that follows the actual line.
        const steps = collectListenSteps(lineOsmd([48, 52, 55, 60, 64, 67, 72]));
        const weights = steps.map((step) => step.contour);
        expect(weights.at(-1)).toBeGreaterThan(weights[0] as number);
        // Never above what the page asked for.
        expect(Math.max(...weights)).toBeLessThanOrEqual(1);
    });

    it("leaves a line that goes nowhere unshaped", () => {
        const steps = collectListenSteps(lineOsmd([60, 60, 60, 60]));
        expect(steps.every((step) => step.contour === 1)).toBe(true);
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
        // 0.5 s written, less the small lift an unmarked note is played with.
        expect(playNote).toHaveBeenCalledWith(60, {
            duration: 0.5 * 0.94,
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

    it("brings the tune out of the chord under it", () => {
        // A chord is not one sound: the top of the texture is the tune and the notes under
        // it are accompaniment. Struck at one level a four-part texture is a block with the
        // melody buried in the middle of it.
        const { result } = mount(lineOsmd([[48, 60, 64, 72]]));
        act(() => result.current.start(0));
        const struck = new Map(
            playNote.mock.calls.map(([pitch, options]) => [
                pitch as number,
                options?.velocity ?? 0,
            ]),
        );
        act(() => result.current.stop());

        // The walk reports half-tones and the sounding pitch is twelve above them.
        const top = struck.get(84) as number;
        expect(struck.get(76)).toBeLessThan(top);
        expect(struck.get(72)).toBeLessThan(top);
        // The bass holds the harmony up, so it sits under the tune but above the inner
        // voices rather than being buried with them.
        expect(struck.get(60)).toBeGreaterThan(struck.get(72) as number);
        expect(struck.get(60)).toBeLessThan(top);
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
            duration: 0.5 * 0.94,
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
        // Milliseconds, and the same small lift the sounded note gets.
        expect(echoed[0]).toEqual([60, 90, 470]);
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

// The whole listening performance, as a sequence: when each note is struck, at what pitch,
// how loud, how long, and whether the pedal is down under it. Every expressive reading the
// transport makes lands in exactly one of those five numbers, so pinning the sequence pins
// the performance — the ornament figures, the roll of a chord, the tempo the clock counts
// at, the voicing of a chord and the weight the phrase puts on it, all at once.
//
// The scores below are fakes, but the sound model they drive is the shipped one. The real
// engravings go through the same walk in the browser suites.
function heard(osmd: OpenSheetMusicDisplay, marks: ScoreMarks = NO_SCORE_MARKS) {
    const struck: Array<[number, number, number, number, boolean]> = [];
    const started = Date.now();
    const { result } = renderHook(() =>
        useListenPlayback({
            getOsmd: () => osmd,
            synth: {
                playNote: (pitch, options) => {
                    struck.push([
                        Date.now() - started,
                        pitch,
                        options?.velocity ?? 0,
                        Math.round((options?.duration ?? 0) * 1000),
                        options?.pedalled ?? false,
                    ]);
                },
            },
            tempo: () => 120,
            loop: () => loopState,
            onLap,
            centerCursor: () => {},
            marks,
            markPainted: () => {},
            isPracticing: () => false,
        }),
    );
    act(() => result.current.start(0));
    act(() => void vi.advanceTimersByTime(30_000));
    act(() => result.current.stop());
    return struck;
}

describe("the listening performance", () => {
    it("plays a marked line exactly as pinned", () => {
        expect(
            heard(lineOsmd([48, 52, 55, [60, 64, 67]]), {
                ...NO_SCORE_MARKS,
                dynamics: [{ whole: 0, volume: 70, ramp: false }],
                pedals: [{ from: 0.25, to: 0.75 }],
                softs: [{ from: 0.5, to: 1 }],
            }),
        ).toEqual([
            [0, 60, 64, 470, false],
            [500, 64, 65, 940, true],
            [1000, 67, 48, 470, true],
            [1500, 72, 48, 470, false],
            [1500, 76, 45, 470, false],
            [1500, 79, 50, 470, false],
        ]);
    });

    it("shakes and sweeps at the score's own tempo exactly as pinned", () => {
        expect(
            heard(fakeOsmd(3), {
                ...NO_SCORE_MARKS,
                tremolos: [{ from: 0, to: 0.25, beams: 2, pitches: [], pair: null }],
                glissandos: [{ from: 0.25, to: 0.5, arrivesAt: 72 }],
                tempi: [{ whole: 0, bpm: 90 }],
            }),
        ).toEqual([
            [0, 60, 82, 118, false],
            [125, 60, 82, 118, false],
            [250, 60, 82, 118, false],
            [375, 60, 82, 118, false],
            [500, 60, 82, 67, false],
            [571, 62, 83, 67, false],
            [642, 64, 85, 67, false],
            [713, 65, 86, 67, false],
            [784, 67, 87, 67, false],
            [855, 69, 89, 67, false],
            [926, 71, 90, 67, false],
            [997, 60, 82, 470, false],
        ]);
    });

    it("trills exactly as pinned", () => {
        expect(
            heard(fakeOsmd(2, { ParentVoiceEntry: { OrnamentContainer: { ornament: 0 } } })),
        ).toEqual([
            [0, 60, 82, 59, false],
            [62, 62, 90, 59, false],
            [124, 60, 82, 59, false],
            [186, 62, 90, 59, false],
            [248, 60, 82, 59, false],
            [310, 62, 90, 59, false],
            [372, 60, 82, 59, false],
            [434, 62, 90, 59, false],
            [496, 60, 82, 59, false],
            [558, 62, 90, 59, false],
            [620, 60, 82, 59, false],
            [682, 62, 90, 59, false],
            [744, 60, 82, 59, false],
            [806, 62, 90, 59, false],
            [868, 60, 82, 59, false],
            [930, 62, 90, 59, false],
        ]);
    });

    it("rolls a chord exactly as pinned", () => {
        expect(heard(lineOsmd([[48, 52, 55]], { ParentVoiceEntry: { Arpeggio: {} } }))).toEqual([
            [0, 60, 82, 470, false],
            [40, 64, 87, 470, false],
            [80, 67, 90, 470, false],
        ]);
    });
});

describe("Listen over a written repeat", () => {
    // The trail Listen leaves is what says how far the music has reached. A repeat sends
    // playback back over bars it has already coloured, so unless the surface is told to
    // wipe them the trail means nothing from the barline onward — the same fault the
    // graded run had, on the surface nobody had checked.
    //
    // The walk goes forward through five steps; their PRINTED onsets are 0, ¼, 0, ¼, ½.
    const REPEATED_ONSETS = [0, 0.25, 0, 0.25, 0.5];

    it("says when the barline has sent it back, once per pass", () => {
        const onRewind = vi.fn();
        const osmd = fakeOsmd(5, {}, undefined, REPEATED_ONSETS);
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () => osmd,
                synth: { playNote },
                tempo: () => 120,
                loop: () => loopState,
                onLap,
                onRewind,
                centerCursor: () => {},
                markPainted: () => {},
                isPracticing: () => false,
            }),
        );
        act(() => result.current.start(0));
        // Walk the whole piece: five quarters at 120 BPM.
        for (let i = 0; i < 5; i++) {
            act(() => void vi.advanceTimersByTime(500));
        }
        // Exactly once — at the third step, the only place an onset is earlier than the
        // one before it. The last two steps move forward again and must not re-fire.
        expect(onRewind).toHaveBeenCalledTimes(1);
    });

    it("stays quiet on a score that never repeats", () => {
        const onRewind = vi.fn();
        const osmd = fakeOsmd(4);
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () => osmd,
                synth: { playNote },
                tempo: () => 120,
                loop: () => loopState,
                onLap,
                onRewind,
                centerCursor: () => {},
                markPainted: () => {},
                isPracticing: () => false,
            }),
        );
        act(() => result.current.start(0));
        for (let i = 0; i < 4; i++) {
            act(() => void vi.advanceTimersByTime(500));
        }
        expect(onRewind).not.toHaveBeenCalled();
    });

    it("hands back the same object across a render that changes nothing", () => {
        const options = {
            getOsmd: () => fakeOsmd(2),
            synth: { playNote: () => {} },
            tempo: () => 120,
            loop: () => loopState,
            onLap,
            centerCursor: () => {},
            marks: NO_SCORE_MARKS,
            markPainted: () => {},
            isPracticing: () => false,
        };
        const { result, rerender } = renderHook(() => useListenPlayback(options));
        const before = result.current;
        rerender();
        expect(result.current).toBe(before);
    });
});
