// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_VELOCITY } from "./expression";
import {
    type ListenNote,
    type ListenStep,
    listenPerformanceOf,
    openingGlissando,
    openingTremolo,
    performListenNote,
    rollChord,
    shapedByContour,
    spellOutGlissando,
    spellOutOrnament,
    spellOutTremolo,
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

describe("spellOutTremolo", () => {
    it("shakes one written note rather than holding it", () => {
        const figure = spellOutTremolo(step([60]), { from: 0, to: 0.5, beams: 2, pair: null }, []);
        expect(figure.length).toBeGreaterThan(1);
        expect(figure.every((one) => one.notes[0]?.pitch === 60)).toBe(true);
    });

    it("rocks between the two written chords of an alternating pair", () => {
        const figure = spellOutTremolo(
            step([60]),
            {
                from: 0,
                to: 0.5,
                beams: 2,
                pair: [
                    { at: 0, pitches: [36] },
                    { at: 0.5, pitches: [43] },
                ],
            },
            [],
        );
        const sounded = figure.slice(0, 4).map((one) => one.notes[0]?.pitch);
        expect(sounded[0]).toBe(48);
        expect(sounded[1]).toBe(55);
        expect(sounded[2]).toBe(48);
    });
});

describe("spellOutGlissando", () => {
    it("sweeps upward and stops short of the note it arrives on", () => {
        const figure = spellOutGlissando(
            step([60], { lengths: [4] }),
            { from: 0, to: 1, arrivesAt: 60 },
            0,
        );
        const swept = figure.map((one) => one.notes[0]?.pitch ?? 0);
        expect(swept.length).toBeGreaterThan(2);
        expect(swept).toEqual([...swept].sort((one, other) => one - other));
        expect(swept.at(-1)).toBeLessThan(72);
    });
});

describe("rollChord", () => {
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
        const tremolos = [{ from: 0.5, to: 1, beams: 2, pair: null }];
        expect(openingTremolo(tremolos, 0.5)).toBe(tremolos[0]);
        expect(openingTremolo(tremolos, 0.75)).toBeNull();
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
