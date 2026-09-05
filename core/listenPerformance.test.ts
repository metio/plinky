// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_VELOCITY } from "./expression";
import {
    fitGraces,
    type ListenNote,
    listenPerformanceOf,
    type ListenStep,
    openingGlissando,
    performListenNote,
    rollChord,
    shapedByContour,
    spellOutGlissando,
    spellOutOrnament,
    spellOutTremolo,
    tremoloAt,
} from "./listenPerformance";
import { SOFT_SCALE } from "./pedal";

const note = (pitch: number, over: Partial<ListenNote> = {}): ListenNote => ({
    pitch,
    soundQuarters: 1,
    pedalled: false,
    articulation: "none",
    accent: false,
    marcato: false,
    slurred: false,
    hand: "right",
    ...over,
});

const step = (pitches: number[], over: Partial<ListenStep> = {}): ListenStep => ({
    notes: pitches.map((pitch) => note(pitch)),
    dynamicVolume: null,
    lengths: [1],
    whole: 0,
    measureIndex: 0,
    bpm: 120,
    stretch: 1,
    soft: false,
    contour: 1,
    advancesCursor: true,
    interpretation: 1,
    ...over,
});

describe("shapedByContour", () => {
    it("leans into the top of a rising line and never above what the page asked for", () => {
        const shaped = shapedByContour([48, 52, 55, 60, 64].map((pitch) => step([pitch])));
        const weights = shaped.map((one) => one.contour);
        expect(weights.at(-1)).toBeGreaterThan(weights[0] as number);
        expect(Math.max(...weights)).toBeLessThanOrEqual(1);
    });

    it("reads the top note of each position, leaving a rest as a hole", () => {
        const shaped = shapedByContour([step([48, 72]), step([]), step([50, 74])]);
        expect(shaped).toHaveLength(3);
        expect(shaped[1]?.contour).toBe(1);
    });

    it("leaves a line that goes nowhere unshaped", () => {
        expect(
            shapedByContour([60, 60, 60].map((pitch) => step([pitch]))).every(
                (one) => one.contour === 1,
            ),
        ).toBe(true);
    });
});

describe("spellOutOrnament", () => {
    it("fills exactly the written length with the figure", () => {
        const figure = spellOutOrnament(step([60], { lengths: [2] }), "trill", 0);
        expect(figure.length).toBeGreaterThan(1);
        expect(figure.reduce((total, one) => total + (one.lengths[0] ?? 0), 0)).toBeCloseTo(2);
    });

    it("moves the cursor only on the last note of the figure", () => {
        const figure = spellOutOrnament(step([60], { lengths: [2] }), "trill", 0);
        expect(figure.map((one) => one.advancesCursor)).toEqual([
            ...figure.slice(0, -1).map(() => false),
            true,
        ]);
    });

    it("leaves a position with nothing to decorate alone", () => {
        const silent = step([]);
        expect(spellOutOrnament(silent, "trill", 0)).toEqual([silent]);
    });
});

const SINGLE = { from: 0, to: 0.5, beams: 2, pitches: [60], pair: null };

describe("spellOutTremolo", () => {
    it("lets the other hand's note at the onset sound once while the chord shakes", () => {
        // A left-hand minim tremolo on C2 under a right-hand quaver on E5, struck together:
        // the E sounds with the first repetition and is not rocked eight times a beat.
        const figure = spellOutTremolo(step([36, 76], { lengths: [2, 0.5] }), {
            ...SINGLE,
            pitches: [36],
        });
        expect(figure[0]?.notes.map((note) => note.pitch)).toEqual([36, 76]);
        expect(figure.slice(1).every((one) => one.notes.every((note) => note.pitch === 36))).toBe(
            true,
        );
        // The tune's note keeps its own written length rather than the repetition's.
        expect(figure[0]?.notes[1]?.soundQuarters).toBe(step([76]).notes[0]?.soundQuarters);
        expect(figure[0]?.notes[0]?.soundQuarters).toBe(figure[0]?.lengths[0]);
    });

    it("fits the figure to the position's advance, not the whole span", () => {
        // The right hand moves again half a beat in; the bar must not wait for two beats
        // of shake before it may. That later position gets its own stretch of the rock.
        const figure = spellOutTremolo(step([36, 76], { lengths: [2, 0.5] }), {
            ...SINGLE,
            pitches: [36],
        });
        const total = figure.reduce((sum, one) => sum + (one.lengths[0] ?? 0), 0);
        expect(total).toBeCloseTo(0.5);
    });

    it("carries the shake on under a position inside the span", () => {
        // The right hand's quaver half a beat in: the C2 is not on the page there, so the
        // figure is modelled on the note that carries the mark, found at the opening.
        const carrier = step([36]).notes[0] ?? null;
        const inside = step([76], { lengths: [0.5], whole: 0.125 });
        const figure = spellOutTremolo(inside, { ...SINGLE, pitches: [36] }, carrier);
        expect(figure[0]?.notes.map((note) => note.pitch)).toEqual([36, 76]);
        expect(figure.length).toBeGreaterThan(1);
        expect(figure.slice(1).every((one) => one.notes[0]?.pitch === 36)).toBe(true);
    });

    it("resumes an alternating pair on the chord it had reached", () => {
        const span = {
            from: 0,
            to: 0.5,
            beams: 2,
            pitches: [36],
            pair: [
                { at: 0, pitches: [36] },
                { at: 0.5, pitches: [43] },
            ],
        };
        // A semiquaver rock, resumed after one semiquaver: the second chord is due.
        const inside = step([76], { lengths: [0.25], whole: 1 / 16 });
        const figure = spellOutTremolo(inside, span, step([36]).notes[0] ?? null);
        expect(figure[0]?.notes[0]?.pitch).toBe(43);
    });

    it("shakes one written note rather than holding it", () => {
        const figure = spellOutTremolo(step([60]), SINGLE);
        expect(figure.length).toBeGreaterThan(1);
        expect(figure.every((one) => one.notes[0]?.pitch === 60)).toBe(true);
    });

    it("rocks between the two written chords of an alternating pair", () => {
        const figure = spellOutTremolo(step([60]), {
            from: 0,
            to: 0.5,
            beams: 2,
            pitches: [36],
            pair: [
                { at: 0, pitches: [36] },
                { at: 0.5, pitches: [43] },
            ],
        });
        // The pair's pitches are MIDI numbers as read from the file, and sound as such.
        const sounded = figure.slice(0, 4).map((one) => one.notes[0]?.pitch);
        expect(sounded[0]).toBe(36);
        expect(sounded[1]).toBe(43);
        expect(sounded[2]).toBe(36);
    });
});

describe("spellOutGlissando", () => {
    it("sweeps upward and stops short of the note it arrives on", () => {
        const figure = spellOutGlissando(
            step([60], { lengths: [4] }),
            { from: 0, to: 1, arrivesAt: 72 },
            0,
        );
        // The sweep runs from the note it is written on toward the MIDI number it arrives
        // at, and stops short of it: the arrival is a note of its own.
        const swept = figure.map((one) => one.notes[0]?.pitch ?? 0);
        expect(swept.length).toBeGreaterThan(2);
        expect(swept).toEqual([...swept].sort((one, other) => one - other));
        expect(swept[0]).toBe(60);
        expect(swept.at(-1)).toBeLessThan(72);
    });
});

describe("spellOutGlissando with another hand under it", () => {
    it("keeps the other hand's chord on the first sub-step and sweeps inside the advance", () => {
        // A right-hand sweep opening on a beat where the left hand strikes a chord: the
        // chord sounds once, with the sweep's first note, and the sweep fits the shortest
        // length at the position rather than the gliding note's own.
        const figure = spellOutGlissando(
            step([60, 48], { lengths: [4, 1] }),
            { from: 0, to: 1, arrivesAt: 72 },
            0,
        );
        expect(figure[0]?.notes.map((one) => one.pitch)).toContain(48);
        expect(figure.slice(1).every((one) => !one.notes.some((n) => n.pitch === 48))).toBe(true);
        expect(figure.reduce((total, one) => total + (one.lengths[0] ?? 0), 0)).toBeCloseTo(1);
    });
});

describe("rollChord", () => {
    it("spreads the roll inside the position's own advance, the shortest length at it", () => {
        // A rolled minim over a quaver in the other hand: the clock moves on when the
        // quaver ends, so the roll must fit inside that half beat, not the minim.
        const rolled = rollChord(step([60, 64, 67], { lengths: [2, 2, 2, 0.5] }));
        expect(rolled.reduce((total, one) => total + (one.lengths[0] ?? 0), 0)).toBeCloseTo(0.5);
    });

    it("spreads the notes from the bottom up, keeping the position's total length", () => {
        const rolled = rollChord(step([67, 60, 64], { lengths: [1] }));
        expect(rolled.map((one) => one.notes[0]?.pitch)).toEqual([60, 64, 67]);
        expect(rolled.reduce((total, one) => total + (one.lengths[0] ?? 0), 0)).toBeCloseTo(1);
    });

    it("keeps a rolled semiquaver a chord rather than a run", () => {
        const rolled = rollChord(step([60, 64], { lengths: [0.05] }));
        expect(rolled.every((one) => (one.lengths[0] ?? 0) > 0)).toBe(true);
    });

    it("leaves a single note alone", () => {
        const single = step([60]);
        expect(rollChord(single)).toEqual([single]);
    });
});

describe("the opening span at a position", () => {
    it("finds the span that starts here and nothing else", () => {
        const tremolos = [{ from: 0.5, to: 1, beams: 2, pitches: [60], pair: null }];
        expect(tremoloAt(tremolos, 0.5)).toBe(tremolos[0]);
        // A position inside the span is under the same shake: the note carrying the mark
        // holds through it.
        expect(tremoloAt(tremolos, 0.75)).toBe(tremolos[0]);
        expect(tremoloAt(tremolos, 0.25)).toBeNull();
        expect(tremoloAt(tremolos, 1)).toBeNull();
        const glissandos = [{ from: 0.25, to: 0.5, arrivesAt: 72 }];
        expect(openingGlissando(glissandos, 0.25)).toBe(glissandos[0]);
        expect(openingGlissando(glissandos, 0)).toBeNull();
    });
});

describe("performListenNote", () => {
    it("hands the synth a quieter touch than the page asked for, never a louder one", () => {
        const chord = step([60, 64, 72], { soft: true, contour: 0.8 });
        for (const one of chord.notes) {
            const { velocity, voiced } = performListenNote(chord, one, 120);
            expect(voiced).toBeLessThanOrEqual(velocity);
            expect(voiced).toBeGreaterThanOrEqual(1);
        }
    });

    it("takes the soft pedal off the top of everything else", () => {
        const plain = step([60]);
        const softly = step([60], { soft: true });
        expect(performListenNote(softly, softly.notes[0]!, 120).voiced).toBe(
            Math.max(
                1,
                Math.round(performListenNote(plain, plain.notes[0]!, 120).voiced * SOFT_SCALE),
            ),
        );
    });

    it("brings the tune out of the chord under it", () => {
        const chord = step([48, 60, 64, 72]);
        const voiced = chord.notes.map((one) => performListenNote(chord, one, 120).voiced);
        expect(Math.max(...voiced)).toBe(voiced.at(-1));
    });

    it("scales the sounding length with the tempo", () => {
        const one = step([60]);
        const slow = performListenNote(one, one.notes[0]!, 60).durationSeconds;
        const fast = performListenNote(one, one.notes[0]!, 120).durationSeconds;
        expect(slow).toBeCloseTo(fast * 2);
    });
});

describe("listenPerformanceOf", () => {
    const line = (count: number) =>
        Array.from({ length: count }, (_, index) =>
            step([60 + index], { whole: index * 0.25, measureIndex: index }),
        );

    it("counts a clip's window from the first note, not from an opening rest", () => {
        // A two-beat rest, then three notes a beat apart at 120: a one-second window holds
        // the first two notes. Counted from the first step, the rest alone used it up.
        const steps = [
            step([], { lengths: [2], whole: 0, measureIndex: 0 }),
            ...line(3).map((one) => ({ ...one, whole: 0.5 + one.whole, measureIndex: 1 })),
        ];
        const played = listenPerformanceOf(steps, { startBpm: 120, withinMs: 1000 });
        expect(played.map((one) => one.startMs)).toEqual([0, 500]);
    });

    it("lays the positions out on one clock at the score's own tempo", () => {
        const played = listenPerformanceOf(line(3), { startBpm: 120 });
        expect(played.map((one) => one.startMs)).toEqual([0, 500, 1000]);
        expect(played.map((one) => one.pitch)).toEqual([60, 61, 62]);
    });

    it("follows a tempo change the way the transport counts it", () => {
        const steps = line(3);
        steps[1]!.bpm = 60;
        steps[2]!.bpm = 60;
        const played = listenPerformanceOf(steps, { startBpm: 120 });
        expect(played.map((one) => one.startMs)).toEqual([0, 500, 1500]);
    });

    it("holds a position at a fermata", () => {
        const steps = line(2);
        steps[0]!.stretch = 2;
        expect(listenPerformanceOf(steps, { startBpm: 120 })[1]?.startMs).toBe(1000);
    });

    it("plays the whole piece faster without changing what it plays", () => {
        const written = listenPerformanceOf(line(3), { startBpm: 120 });
        const quick = listenPerformanceOf(line(3), { startBpm: 120, speed: 2 });
        expect(quick.map((one) => one.pitch)).toEqual(written.map((one) => one.pitch));
        expect(quick.map((one) => one.startMs)).toEqual([0, 250, 500]);
        expect(quick[0]?.durationMs).toBeCloseTo((written[0]?.durationMs ?? 0) / 2);
    });

    it("cuts a clip on a position boundary, never halfway into a chord", () => {
        const steps = line(4);
        steps[2]!.notes = [note(72), note(76)];
        const clip = listenPerformanceOf(steps, { startBpm: 120, withinMs: 1200 });
        expect(clip.map((one) => one.startMs)).toEqual([0, 500, 1000, 1000]);
    });

    it("anchors the clock on the first note, so an opening rest is not silence", () => {
        const steps = line(3);
        steps[0]!.notes = [];
        expect(listenPerformanceOf(steps, { startBpm: 120 })[0]?.startMs).toBe(0);
    });

    it("fingers every note, so a clip coloured by finger has one to read", () => {
        const steps = line(4);
        steps[1]!.notes = [note(48, { hand: "left" })];
        const played = listenPerformanceOf(steps, { startBpm: 120 });
        expect(played.every((one) => one.finger !== undefined)).toBe(true);
        expect(played.every((one) => (one.finger ?? 0) >= 1 && (one.finger ?? 0) <= 5)).toBe(true);
        expect(played[1]?.hand).toBe("left");
    });

    it("gives a chord's members different fingers of the same hand", () => {
        const played = listenPerformanceOf([step([60, 64, 67])], { startBpm: 120 });
        expect(new Set(played.map((one) => one.finger)).size).toBe(3);
    });

    it("carries the page's own dynamic through", () => {
        const marked = listenPerformanceOf([step([60], { dynamicVolume: 40 })], { startBpm: 120 });
        const unmarked = listenPerformanceOf([step([60])], { startBpm: 120 });
        expect(marked[0]?.velocity).toBe(40);
        expect(unmarked[0]?.velocity).toBe(DEFAULT_VELOCITY);
    });

    it("plays nothing from nothing", () => {
        expect(listenPerformanceOf([], { startBpm: 120 })).toEqual([]);
    });
});

describe("what a rendered performance carries", () => {
    it("keeps the pedal on every note struck under it", () => {
        // The pedal is not a loudness: it decides whether the rest of the instrument
        // answers the note, and whether a damper lands when it ends. A performance that
        // drops it plays a key-off knock on notes a real piano cannot knock on — which is
        // exactly what every exported video did, because RecordedNote had nowhere to put
        // this and the flag died on the way to the engine.
        // One position, two notes: one struck under the pedal and one not.
        const both = step([60, 64]);
        both.notes = [note(60, { pedalled: true }), note(64, { pedalled: false })];
        const [under, open] = listenPerformanceOf([both], { startBpm: 120 });
        expect(under?.pedalled).toBe(true);
        expect(open?.pedalled).toBe(false);
    });
});

describe("fitGraces", () => {
    it("takes the graces' time out of the beat they decorate", () => {
        // A written-eighth grace before a quarter: the beat keeps what the grace left.
        expect(fitGraces([0.5], 1)).toEqual({ graces: [0.5], beat: 0.5 });
    });

    it("squeezes a run of graces into half the beat at most", () => {
        const fitted = fitGraces([0.5, 0.5, 0.5], 1);
        expect(fitted.graces.reduce((sum, one) => sum + one, 0)).toBeCloseTo(0.5);
        expect(fitted.beat).toBeCloseTo(0.5);
    });

    it("gives a position with no graces its whole advance", () => {
        expect(fitGraces([], 1)).toEqual({ graces: [], beat: 1 });
    });
});

describe("a fermata", () => {
    it("holds the note as long as it holds the position", () => {
        const held = step([60], { stretch: 2 });
        const plain = step([60]);
        const long = performListenNote(held, held.notes[0]!, 120).durationSeconds;
        const short = performListenNote(plain, plain.notes[0]!, 120).durationSeconds;
        expect(long).toBeCloseTo(short * 2);
    });
});

describe("which note glides", () => {
    it("sweeps the note carrying the mark, whichever order the position lists it in", () => {
        // The left hand's C2 is listed first; the glissando is written on the C5 above it.
        const figure = spellOutGlissando(
            step([36, 72], { lengths: [4, 4] }),
            {
                from: 0,
                to: 1,
                arrivesAt: 84,
                pitch: 72,
            },
            0,
        );
        expect(figure[0]?.notes.map((note) => note.pitch)).toContain(36);
        expect(figure.slice(1).every((one) => one.notes.every((note) => note.pitch > 72))).toBe(
            true,
        );
        expect(figure.slice(1).some((one) => one.notes.some((note) => note.pitch === 36))).toBe(
            false,
        );
    });
});

describe("an ornament over the other hand's note", () => {
    it("spells the figure while the other hand's note sounds once beneath it", () => {
        const both = step([48, 72], { lengths: [2, 1] });
        const figure = spellOutOrnament(both, "trill", 0, { pitch: 72, written: 1 });
        expect(figure.length).toBeGreaterThan(2);
        expect(figure[0]?.notes.map((note) => note.pitch)).toEqual([72, 48]);
        expect(figure.slice(1).every((one) => one.notes.length === 1)).toBe(true);
        // The figure fills the trilled note's time and no more.
        expect(figure.reduce((sum, one) => sum + (one.lengths[0] ?? 0), 0)).toBeCloseTo(1);
    });
});
