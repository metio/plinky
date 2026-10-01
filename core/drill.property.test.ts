// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    DEFAULT_DRILL,
    DRILL_RHYTHMS,
    type DrillOptions,
    generateDrill,
    HIGHEST_MIDI,
    LOWEST_MIDI,
    MAX_FIFTHS,
    MIN_FIFTHS,
    pitchPool,
} from "./drill";
import { readTimeline } from "./musicxmlTimeline";
import { pitchClassOf, SEMITONES_PER_OCTAVE } from "./theory";

// The sight-reading drill: music generated to be read once. Nobody checks it before a
// player sees it, so whatever it writes is what they get — and the settings are promises
// about what they will be asked to read. A drill that strays outside its range, leaps
// further than it said, or leaves a bar short is asking for something the player did not
// agree to practise.

const rngOf = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const arbSeed = fc.integer({ min: 0, max: 2 ** 31 - 1 });

const arbOptions: fc.Arbitrary<DrillOptions> = fc
    .record({
        bars: fc.integer({ min: 1, max: 8 }),
        beatsPerBar: fc.constantFrom(2, 3, 4, 6),
        hands: fc.constantFrom(1 as const, 2 as const),
        fifths: fc.integer({ min: MIN_FIFTHS, max: MAX_FIFTHS }),
        chromatic: fc.boolean(),
        low: fc.integer({ min: 36, max: 60 }),
        span: fc.integer({ min: 12, max: 36 }),
        notesPerColumn: fc.integer({ min: 1, max: 3 }),
        maxLeap: fc.constantFrom(0, 5, 12),
        rhythm: fc.constantFrom(...DRILL_RHYTHMS),
        smoothness: fc.integer({ min: 0, max: 4 }),
    })
    .map(({ span, low, ...rest }) => ({ ...rest, low, high: low + span }));

// The columns of one hand, in order. Grouped per part on purpose: a two-handed drill is
// a grand staff, so the distance between a left-hand note and a right-hand note sounding
// together is the width of the chord, not a leap anybody has to make. Each hand leaps
// only within itself.
const columnsPerHand = (
    notes: readonly { whole: number; midi: number | null; part: string; staff: number }[],
) => {
    const byHand = new Map<string, Map<number, number[]>>();
    for (const note of notes) {
        if (note.midi === null) {
            continue;
        }
        // A grand staff is ONE part with two staves, so the staff is what identifies a
        // hand; grouping by part alone merges them and reads the width of a chord
        // between the hands as a leap.
        const hand = `${note.part}:${note.staff}`;
        const columns = byHand.get(hand) ?? new Map<number, number[]>();
        columns.set(note.whole, [...(columns.get(note.whole) ?? []), note.midi]);
        byHand.set(hand, columns);
    }
    return [...byHand.values()].map((columns) =>
        [...columns.entries()].sort((a, b) => a[0] - b[0]).map(([, midis]) => midis),
    );
};

const parse = (xml: string) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    return readTimeline(doc);
};

describe("the notes a drill may draw from", () => {
    it("offers notes inside the range, each once, rising", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                const pool = pitchPool(options);

                expect(new Set(pool).size).toBe(pool.length);
                expect([...pool].sort((a, b) => a - b)).toEqual(pool);
                for (const note of pool) {
                    expect(note).toBeGreaterThanOrEqual(options.low);
                    expect(note).toBeLessThanOrEqual(options.high);
                    expect(note).toBeGreaterThanOrEqual(LOWEST_MIDI);
                    expect(note).toBeLessThanOrEqual(HIGHEST_MIDI);
                }
            }),
        );
    });

    it("offers a key's seven notes, or all twelve when chromatic", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                // The span is at least an octave, so every pitch class the setting
                // allows is reachable and the count is the whole claim.
                const classes = new Set(pitchPool(options).map(pitchClassOf));

                expect(classes.size).toBe(options.chromatic ? SEMITONES_PER_OCTAVE : 7);
            }),
        );
    });

    it("offers nothing for a range that runs backwards", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                expect(pitchPool({ ...options, low: options.high + 1 })).toEqual([]);
            }),
        );
    });
});

describe("the drill it writes", () => {
    it("writes the same drill for the same settings", () => {
        fc.assert(
            fc.property(arbOptions, arbSeed, (options, seed) => {
                expect(generateDrill(options, rngOf(seed))).toBe(
                    generateDrill(options, rngOf(seed)),
                );
            }),
        );
    });

    it("asks only for notes it said it would", () => {
        fc.assert(
            fc.property(arbOptions, arbSeed, (options, seed) => {
                const allowed = new Set(pitchPool(options));
                fc.pre(allowed.size > 0);

                const { notes } = parse(generateDrill(options, rngOf(seed)));

                expect(notes.length).toBeGreaterThan(0);
                for (const note of notes) {
                    if (note.midi === null) {
                        continue;
                    }
                    // The range and the key are the promise the settings make.
                    expect(allowed.has(note.midi)).toBe(true);
                }
            }),
        );
    });

    it("fills every bar it writes", () => {
        fc.assert(
            fc.property(arbOptions, arbSeed, (options, seed) => {
                fc.pre(pitchPool(options).length > 0);

                const { end } = parse(generateDrill(options, rngOf(seed)));

                // A bar left short would be read as a change of metre, and a bar
                // overfull cannot be drawn at all.
                expect(end).toBeCloseTo((options.bars * options.beatsPerBar) / 4, 6);
            }),
        );
    });

    it("never leaps further than it was told to", () => {
        fc.assert(
            fc.property(arbOptions, arbSeed, (options, seed) => {
                fc.pre(options.maxLeap > 0);
                fc.pre(pitchPool(options).length > 0);

                const hands = columnsPerHand(parse(generateDrill(options, rngOf(seed))).notes);

                for (const columns of hands) {
                    columns.forEach((column, at) => {
                        const previous = columns[at - 1];
                        if (!previous) {
                            return;
                        }
                        // Measured between the nearest notes of consecutive columns of
                        // one hand: a leap wider than the setting is a jump the reader
                        // was promised they would not have to make.
                        const nearest = Math.min(
                            ...column.flatMap((note) =>
                                previous.map((before) => Math.abs(note - before)),
                            ),
                        );
                        expect(nearest).toBeLessThanOrEqual(options.maxLeap);
                    });
                }
            }),
        );
    });

    it("titles the drill when it is given a title", () => {
        fc.assert(
            fc.property(
                arbOptions,
                arbSeed,
                fc.stringMatching(/^[A-Za-z0-9 #]{1,20}$/),
                (options, seed, title) => {
                    fc.pre(pitchPool(options).length > 0);

                    const xml = generateDrill({ ...options, title }, rngOf(seed));

                    expect(xml).toContain(title);
                },
            ),
        );
    });

    it("writes a drill the shipped defaults can read", () => {
        const { notes, end } = parse(generateDrill(DEFAULT_DRILL, rngOf(1)));

        expect(notes.length).toBeGreaterThan(0);
        expect(end).toBeCloseTo((DEFAULT_DRILL.bars * DEFAULT_DRILL.beatsPerBar) / 4, 6);
    });
});
