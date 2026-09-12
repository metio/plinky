// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOMINAL_BPM } from "../../core/elapsed";
import { NO_SCORE_MARKS, type ScoreMarks } from "../../core/musicxmlMarks";
import type { Take } from "../../core/takes";
import { listenPerformanceOf } from "../../core/listenPerformance";
import { seekToOrdinal } from "../lib/scoreCursor";
import { collectListenSteps } from "../lib/listenSteps";
import { highlightCursorNotes, trailNotes } from "../lib/scoreColor";
import { useListenPlayback } from "./useListenPlayback";

// The colour helpers walk real OSMD graphics; stub them so the fake score
// below only has to model the cursor walk itself.
vi.mock("../lib/scoreColor", async (importOriginal) => ({
    highlightCursorNotes: vi.fn(() => []),
    restoreNotes: vi.fn(),
    trailNotes: vi.fn(),
    // Pure bookkeeping over the notes it is handed, so the real one.
    retargetPainted: (await importOriginal<typeof import("../lib/scoreColor")>()).retargetPainted,
}));
vi.mock("../lib/scoreCursor", () => ({
    seekToBar: vi.fn(),
    seekToOrdinal: vi.fn(),
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
const silenceStrikes = vi.fn();
const onLap = vi.fn();
let loopState: { on: boolean; from: number; to: number };

const onPosition = vi.fn();

// The score's markings. They no longer come off the engraver, so a test that wants a
// dynamic in force says what the score writes rather than mimicking an object shape.
function mount(osmd: OpenSheetMusicDisplay | null, marks: ScoreMarks = NO_SCORE_MARKS) {
    return renderHook(() =>
        useListenPlayback({
            getOsmd: () => osmd,
            synth: { playNote, silenceStrikes },
            tempo: () => 120,
            loop: () => loopState,
            onLap,
            centerCursor: () => {},
            onPosition,
            marks,
            markPainted: () => {},
            isPracticing: () => false,
            // On the grid: the touch is the subject of its own test.
            shaped: () => false,
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
            position: 0,
            soft: false,
            contour: 1,
            bpm: NOMINAL_BPM,
            stretch: 1,
            advancesCursor: true,
            interpretation: 1,
            phrase: 0,
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

    it("dwells a position until the next onset, not until its own shortest note ends", () => {
        // Crotchets at every position, but the third arrives a quaver after the second —
        // the other voice's note under a held one. The second position lasts a quaver;
        // read off its own note it would overstay by a quaver, and every bar with such a
        // figure came out longer than written.
        const steps = collectListenSteps(fakeOsmd(3, {}, undefined, [0, 0.25, 0.375]));
        expect(steps.map((step) => Math.min(...step.lengths))).toEqual([1, 0.5, 1]);
        const played = listenPerformanceOf(steps, { startBpm: NOMINAL_BPM, shaped: false });
        expect(played.map((note) => note.startMs)).toEqual([0, 1000, 1500]);
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

    it("fits a grace note into the beat it decorates, so the bar keeps its length", () => {
        // A written-eighth grace before a quarter: the position still advances one quarter
        // in all. Dwelling the grace for its written length and then the beat for its own
        // put every later beat late and Listen drifted from the graded run's clock.
        let position = 0;
        const grace = {
            Length: { RealValue: 0.125 },
            isRest: () => false,
            halfTone: 50,
            IsGraceNote: true,
            ParentVoiceEntry: { Articulations: [] },
        };
        const beat = { Length: { RealValue: 0.25 }, isRest: () => false, halfTone: 48 };
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
                    return position >= 2;
                },
                get CurrentMeasureIndex() {
                    return 0;
                },
                get currentTimeStamp() {
                    return { RealValue: position * 0.25 };
                },
            },
            NotesUnderCursor: () => (position === 0 ? [grace, beat] : [beat]),
        };
        const osmd = { cursor, Sheet: { SourceMeasures: [] } } as unknown as OpenSheetMusicDisplay;
        const steps = collectListenSteps(osmd);
        const advance = (step: (typeof steps)[number]) => Math.min(...step.lengths);
        expect(steps.map((step) => step.notes[0]?.pitch)).toEqual([62, 60, 60]);
        expect(advance(steps[0]!) + advance(steps[1]!)).toBeCloseTo(1);
        expect(advance(steps[2]!)).toBeCloseTo(1);
    });

    it("spells a trill out over the other hand's note, which sounds once", () => {
        const osmd = lineOsmd([[48, 72]], {});
        const trilled = { ParentVoiceEntry: { OrnamentContainer: { ornament: 0 } } };
        const raw = osmd.cursor.NotesUnderCursor;
        (osmd.cursor as unknown as { NotesUnderCursor: () => unknown[] }).NotesUnderCursor = () =>
            raw().map((note: { halfTone: number }) =>
                note.halfTone === 72
                    ? { ...note, ...trilled, ParentStaff: { idInMusicSheet: 0 } }
                    : { ...note, ParentStaff: { idInMusicSheet: 1 } },
            );
        const steps = collectListenSteps(osmd);
        expect(steps.length).toBeGreaterThan(2);
        expect(
            steps.flatMap((step) => step.notes.filter((note) => note.pitch === 60)),
        ).toHaveLength(1);
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
            delay: 0,
            owner: expect.any(Symbol),
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

    it("resumes on the pass it stopped on, not the first pass of the same bar", () => {
        // Bars 1–2 repeated, then bar 3: the walk is C D C D E and the onsets rewind. A stop
        // on the second D stands at position 3; an onset alone would name the first D.
        const osmd = fakeOsmd(5, {}, undefined, [0, 0.25, 0, 0.25, 0.5]);
        const { result } = mount(osmd);

        act(() => result.current.start(0.25, 3));
        expect(seekToOrdinal).toHaveBeenCalledWith(osmd.cursor, 3);
        expect(onPosition).toHaveBeenNthCalledWith(1, 0.25);
        act(() => void vi.advanceTimersByTime(500));
        // The next position is bar 3, not the first pass again.
        expect(onPosition).toHaveBeenNthCalledWith(2, 0.5);
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
        expect(playNote).toHaveBeenCalledWith(60, {
            velocity: 80,
            duration: 0.4,
            owner: expect.any(Symbol),
        });

        // The second event fires at its recorded offset, then the tail closes.
        act(() => void vi.advanceTimersByTime(300));
        expect(playNote).toHaveBeenCalledWith(64, {
            velocity: 90,
            duration: 0.4,
            owner: expect.any(Symbol),
        });
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
            delay: 0,
            owner: expect.any(Symbol),
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
            delay: 0,
            owner: expect.any(Symbol),
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
                synth: { playNote, silenceStrikes },
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
                silenceStrikes,
            },
            tempo: () => 120,
            loop: () => loopState,
            onLap,
            centerCursor: () => {},
            marks,
            markPainted: () => {},
            isPracticing: () => false,
            // On the grid: the touch is the subject of its own test.
            shaped: () => false,
        }),
    );
    act(() => result.current.start(0));
    act(() => void vi.advanceTimersByTime(30_000));
    act(() => result.current.stop());
    return struck;
}

describe("the human touch", () => {
    it("hands the synth the accompaniment a hair after the tune, and holds the last bar", () => {
        const delays: Array<[number, number]> = [];
        const ticks: number[] = [];
        const started = Date.now();
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () =>
                    lineOsmd([
                        [48, 72],
                        [50, 74],
                    ]),
                synth: {
                    playNote: (pitch, options) => {
                        delays.push([pitch, Math.round((options?.delay ?? 0) * 1000)]);
                        ticks.push(Date.now() - started);
                    },
                    silenceStrikes,
                },
                tempo: () => 120,
                loop: () => loopState,
                onLap,
                centerCursor: () => {},
                markPainted: () => {},
                isPracticing: () => false,
            }),
        );
        act(() => result.current.start(0));
        act(() => void vi.advanceTimersByTime(30_000));
        act(() => result.current.stop());
        const delayOf = (pitch: number) => delays.find(([one]) => one === pitch)?.[1] ?? -1;
        expect(delayOf(84)).toBeLessThan(5);
        expect(delayOf(60)).toBeGreaterThan(15);
        expect(delayOf(60)).toBeLessThan(25);
        // The first position is a bar before the last, so it holds its written length and
        // the second position arrives on the beat.
        expect(ticks[0]).toBe(0);
        expect(ticks[2]).toBe(500);
    });
});

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
                synth: { playNote, silenceStrikes },
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
        // Named by the span it sends the music back over, so only those bars are wiped.
        const [span] = onRewind.mock.calls[0] as [{ from: number; to: number }];
        expect(span.from).toBeLessThan(span.to);
    });

    it("lays the trail on the note it leaves before the rewind wipes the section", () => {
        // The tick that sends playback back leaves the section's last note. Its trail
        // must be laid first and wiped with the rest; laid afterwards, that one note
        // would stay blue on every pass.
        const onRewind = vi.fn();
        const osmd = fakeOsmd(5, {}, undefined, REPEATED_ONSETS);
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () => osmd,
                synth: { playNote, silenceStrikes },
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
        act(() => void vi.advanceTimersByTime(500));
        act(() => void vi.advanceTimersByTime(500));
        expect(onRewind).toHaveBeenCalledTimes(1);
        const rewoundAt = onRewind.mock.invocationCallOrder[0]!;
        const trails = vi.mocked(trailNotes).mock.invocationCallOrder;
        // The trail for the second step (the section's last) is the last trail laid
        // before the rewind, and none is laid between the rewind and the next tick.
        expect(trails.some((at) => at < rewoundAt)).toBe(true);
        expect(trails.filter((at) => at > rewoundAt)).toHaveLength(0);
    });

    it("trails the fresh notehead after an in-place redraw, not the discarded one", () => {
        const SVG_NS = "http://www.w3.org/2000/svg";
        const drawn = document.createElementNS(SVG_NS, "g");
        const redrawn = document.createElementNS(SVG_NS, "g");
        vi.mocked(highlightCursorNotes).mockReturnValueOnce([{ element: drawn, prior: null }]);
        const osmd = fakeOsmd(4);
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () => osmd,
                synth: { playNote, silenceStrikes },
                tempo: () => 120,
                loop: () => loopState,
                onLap,
                centerCursor: () => {},
                markPainted: () => {},
                isPracticing: () => false,
            }),
        );
        act(() => result.current.start(0));
        act(() => result.current.retarget((element) => (element === drawn ? redrawn : undefined)));
        vi.mocked(trailNotes).mockClear();
        act(() => result.current.stop());
        expect(trailNotes).toHaveBeenCalledWith(
            [{ element: redrawn, prior: null }],
            expect.any(String),
        );
    });

    it("stays quiet on a score that never repeats", () => {
        const onRewind = vi.fn();
        const osmd = fakeOsmd(4);
        const { result } = renderHook(() =>
            useListenPlayback({
                getOsmd: () => osmd,
                synth: { playNote, silenceStrikes },
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
            synth: { playNote: () => {}, silenceStrikes: () => {} },
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

describe("stopping", () => {
    const REPLAYED: Take = {
        id: "take",
        composition: {
            tempo: 120,
            beatsPerBar: 4,
            notes: [
                { pitch: 60, startMs: 0, durationMs: 4000, velocity: 80 },
                { pitch: 64, startMs: 500, durationMs: 4000, velocity: 80 },
            ],
        },
    } as unknown as Take;

    const ownersStruck = () =>
        new Set(playNote.mock.calls.map(([, options]) => (options as { owner?: symbol }).owner));

    it("takes back the notes Listen struck, under the owner it struck them with", () => {
        // A strike is scheduled whole: a pedalled note stretched to the pedal lift keeps
        // sounding after the cursor has stopped unless the stop reaches the engine.
        const { result } = mount(fakeOsmd(4));
        act(() => result.current.start(0));
        const owners = ownersStruck();
        expect(owners.size).toBe(1);
        const [owner] = owners;
        expect(typeof owner).toBe("symbol");
        act(() => result.current.stop());
        expect(silenceStrikes).toHaveBeenCalledWith(owner);
    });

    it("lets the last notes ring when Listen plays to the end", () => {
        // The end of the piece is not a request for silence: the final chord rings for the
        // length the score gives it.
        const { result } = mount(fakeOsmd(2));
        act(() => result.current.start(0));
        act(() => void vi.advanceTimersByTime(5_000));
        expect(result.current.playing).toBe(false);
        expect(onLap).toHaveBeenCalled();
        expect(silenceStrikes).not.toHaveBeenCalled();
    });

    it("takes back a replayed take's notes when the replay is stopped", () => {
        const { result } = mount(fakeOsmd(4));
        act(() => result.current.replay(REPLAYED));
        const [owner] = ownersStruck();
        act(() => result.current.stop());
        expect(silenceStrikes).toHaveBeenCalledWith(owner);
    });

    it("lets a replayed take's last note ring when the take plays out", () => {
        const { result } = mount(fakeOsmd(4));
        act(() => result.current.replay(REPLAYED));
        act(() => void vi.advanceTimersByTime(5_000));
        expect(result.current.playing).toBe(false);
        expect(silenceStrikes).not.toHaveBeenCalled();
    });

    it("silences the previous pass when a replay takes over from Listen", () => {
        const { result } = mount(fakeOsmd(4));
        act(() => result.current.start(0));
        act(() => result.current.replay(REPLAYED));
        expect(silenceStrikes).toHaveBeenCalledTimes(1);
        // One transport, one owner: the replay's notes can be taken back the same way.
        expect(ownersStruck().size).toBe(1);
    });

    it("gives each transport its own owner, so one's stop leaves the other's notes", () => {
        const first = mount(fakeOsmd(4));
        const second = mount(fakeOsmd(4));
        act(() => first.result.current.start(0));
        act(() => second.result.current.start(0));
        expect(ownersStruck().size).toBe(2);
        act(() => first.result.current.stop());
        const [firstOwner] = ownersStruck();
        expect(silenceStrikes.mock.calls).toEqual([[firstOwner]]);
        act(() => second.result.current.stop());
    });
});
