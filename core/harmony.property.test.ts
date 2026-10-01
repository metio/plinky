// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type HarmonyBar, type HarmonyKey, type HarmonyNote, readHarmony } from "./harmony";
import { chordPitches, pitchClassOf, SEMITONES_PER_OCTAVE } from "./theory";

// Reading the chords out of a piece: what the analysis panel shows, what the chord
// drills are built from, and what a transposed edition is checked against. Nothing
// downstream can tell a wrong reading from a right one, so the laws are the structural
// ones — spans that tile the music in order, a bass that is really a chord tone of the
// chord it is under, and no two touching spans that should have been one.
//
// The music generated here is deliberately plain — a triad a bar, in one key — because
// the question is not whether the reading is musically apt but whether it is internally
// consistent. The second generator answers the other half: notes with no harmony in
// them at all must still produce spans that obey every one of those laws.

const EPSILON = 1e-6;
const QUARTER = 0.25;

type Timeline = {
    notes: HarmonyNote[];
    bars: HarmonyBar[];
    keys: HarmonyKey[];
    end: number;
};

// A triad a bar, held for the whole bar, in one key signature.
const arbProgression: fc.Arbitrary<Timeline> = fc
    .tuple(
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: -4, max: 4 }),
        fc.integer({ min: 48, max: 72 }),
    )
    .map(([degrees, fifths, low]) => {
        const STEPS = [0, 2, 4, 5, 7, 9, 11];
        const notes: HarmonyNote[] = [];
        const bars: HarmonyBar[] = [];
        degrees.forEach((degree, bar) => {
            const from = bar;
            bars.push({ from, beats: 4, beatType: 4 });
            const root = low + (STEPS[degree] as number);
            for (const pitch of [root, root + 4, root + 7]) {
                notes.push({ whole: from, wholes: 1, midi: pitch });
            }
        });
        return { notes, bars, keys: [{ whole: 0, fifths }], end: degrees.length };
    });

// Notes with no harmony in them: clusters, rests, a run of semitones.
const arbNoise: fc.Arbitrary<Timeline> = fc
    .array(
        fc.record({
            at: fc.integer({ min: 0, max: 7 }),
            midi: fc.oneof(fc.integer({ min: 36, max: 84 }), fc.constant(null)),
            length: fc.constantFrom(QUARTER, QUARTER * 2, 1),
        }),
        { maxLength: 24 },
    )
    .map((events) => {
        const notes: HarmonyNote[] = events.map((event) => ({
            whole: event.at * QUARTER,
            wholes: event.length,
            midi: event.midi,
        }));
        const end = 2;
        return {
            notes,
            bars: [
                { from: 0, beats: 4, beatType: 4 },
                { from: 1, beats: 4, beatType: 4 },
            ],
            keys: [{ whole: 0, fifths: 0 }],
            end,
        };
    });

const arbTimeline = fc.oneof(arbProgression, arbNoise);

describe("the chords read out of a piece", () => {
    it("lays the chords along the music in order, never overlapping", () => {
        fc.assert(
            fc.property(arbTimeline, (timeline) => {
                const spans = readHarmony(timeline);

                spans.forEach((span, at) => {
                    expect(span.to).toBeGreaterThan(span.from);
                    expect(span.from).toBeGreaterThanOrEqual(-EPSILON);
                    expect(span.to).toBeLessThanOrEqual(timeline.end + EPSILON);
                    const next = spans[at + 1];
                    if (next) {
                        // Two chords in force at once is not something a reader can mean.
                        expect(next.from).toBeGreaterThanOrEqual(span.to - EPSILON);
                    }
                });
            }),
        );
    });

    it("names a chord the ear could be told", () => {
        fc.assert(
            fc.property(arbTimeline, (timeline) => {
                for (const span of readHarmony(timeline)) {
                    expect(span.root).toBeGreaterThanOrEqual(0);
                    expect(span.root).toBeLessThan(SEMITONES_PER_OCTAVE);
                    expect(span.bass).toBeGreaterThanOrEqual(0);
                    expect(span.bass).toBeLessThan(SEMITONES_PER_OCTAVE);
                    expect(span.numeral.trim()).not.toBe("");
                    expect(span.confidence).toBeGreaterThanOrEqual(0);
                    expect(span.confidence).toBeLessThanOrEqual(1);
                    expect(span.key.tonic).toBeGreaterThanOrEqual(0);
                    expect(span.key.tonic).toBeLessThan(SEMITONES_PER_OCTAVE);
                    expect(["major", "minor"]).toContain(span.key.mode);
                }
            }),
        );
    });

    it("counts the inversion off the note that is really underneath", () => {
        fc.assert(
            fc.property(arbTimeline, (timeline) => {
                for (const span of readHarmony(timeline)) {
                    const tones = chordPitches(span.root, span.quality).map(pitchClassOf);

                    expect(span.inversion).toBeGreaterThanOrEqual(0);
                    expect(span.inversion).toBeLessThan(tones.length);
                    if (span.inversion > 0) {
                        // An inversion is named after the chord tone in the bass, so the
                        // one it names must be the note that is actually down there.
                        expect(tones[span.inversion]).toBe(span.bass);
                    } else if (tones.includes(span.bass)) {
                        expect(tones[0]).toBe(span.bass);
                    }
                }
            }),
        );
    });

    it("joins a chord that simply carries on", () => {
        fc.assert(
            fc.property(arbTimeline, (timeline) => {
                const spans = readHarmony(timeline);

                spans.forEach((span, at) => {
                    const next = spans[at + 1];
                    if (!next || Math.abs(next.from - span.to) > EPSILON) {
                        return;
                    }
                    // Touching spans of the same chord are one chord held, and showing
                    // them as two would read as a change the music never made.
                    expect(`${span.root}:${span.quality}`).not.toBe(`${next.root}:${next.quality}`);
                });
            }),
        );
    });

    it("hears the same chords an octave up", () => {
        fc.assert(
            fc.property(arbProgression, (timeline) => {
                const raised = {
                    ...timeline,
                    notes: timeline.notes.map((note) => ({
                        ...note,
                        midi: note.midi === null ? null : note.midi + SEMITONES_PER_OCTAVE,
                    })),
                };

                // A chord is its pitch classes, so playing the whole thing an octave
                // higher is the same harmony — only the bass note moves with it.
                expect(
                    readHarmony(raised).map((span) => [span.root, span.quality, span.from]),
                ).toEqual(
                    readHarmony(timeline).map((span) => [span.root, span.quality, span.from]),
                );
            }),
        );
    });

    it("reads the same piece the same way twice, and silence as nothing", () => {
        fc.assert(
            fc.property(arbTimeline, (timeline) => {
                expect(readHarmony(timeline)).toEqual(readHarmony(timeline));
            }),
        );
        expect(readHarmony({ notes: [], bars: [], keys: [], end: 0 })).toEqual([]);
    });
});
