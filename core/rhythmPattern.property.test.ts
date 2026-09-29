// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type Cell,
    cellBeats,
    expectedOnsets,
    generateRhythm,
    patternMs,
    RHYTHM_LEVELS,
    type RhythmPattern,
} from "./rhythmPattern";

// The rhythm the player claps back. A pattern is generated, notated and graded from the
// same cells, so the three only agree while the cells fill the bars exactly: a figure
// that overran its bar would be drawn past the barline and expect a tap where the music
// has already moved on, and one that fell short would leave the last tap ungraded.
//
// Generation is random, which is the whole reason to state the laws over generated
// patterns rather than examples — the drill ships eleven levels and a player sees a
// different pattern every round.

// A deterministic stand-in for Math.random, so a failing case can be replayed from its
// seed alone.
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
const arbLevel = fc.integer({ min: 0, max: RHYTHM_LEVELS.length - 1 });
const arbPattern = fc
    .tuple(arbLevel, arbSeed)
    .map(([level, seed]) => generateRhythm(level, rngOf(seed)));
const totalBeats = (pattern: RhythmPattern) => pattern.bars * pattern.beatsPerBar;
const sumOf = (cells: Cell[]) => cells.reduce((sum, cell) => sum + cell.beats, 0);

describe("the rhythm a round asks for", () => {
    it("fills its bars exactly, and puts no figure across a barline", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                expect(sumOf(pattern.cells)).toBeCloseTo(totalBeats(pattern), 9);

                // Every barline falls where a cell begins: a figure straddling one
                // could be neither drawn nor counted.
                const starts = cellBeats(pattern);
                for (let bar = 0; bar < pattern.bars; bar += 1) {
                    const line = bar * pattern.beatsPerBar;
                    expect(starts.some((start) => Math.abs(start - line) < 1e-9)).toBe(true);
                }
            }),
        );
    });

    it("writes only cells that last some time", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                expect(pattern.cells.length).toBeGreaterThan(0);
                for (const cell of pattern.cells) {
                    expect(cell.beats).toBeGreaterThan(0);
                    expect(Number.isFinite(cell.beats)).toBe(true);
                    expect(typeof cell.rest).toBe("boolean");
                }
                // At least one tap, or there is nothing to clap.
                expect(pattern.cells.some((cell) => !cell.rest)).toBe(true);
            }),
        );
    });

    it("beams each group as one run of neighbours", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                const seen = new Map<number, number[]>();
                pattern.cells.forEach((cell, at) => {
                    if (cell.group === undefined) {
                        return;
                    }
                    seen.set(cell.group, [...(seen.get(cell.group) ?? []), at]);
                });

                for (const indices of seen.values()) {
                    // A beam is drawn across neighbours; a group whose members were
                    // scattered would draw one over the cells between them.
                    expect(indices[indices.length - 1]! - indices[0]!).toBe(indices.length - 1);
                }
            }),
        );
    });

    it("gives the same pattern for the same round", () => {
        fc.assert(
            fc.property(arbLevel, arbSeed, (level, seed) => {
                expect(generateRhythm(level, rngOf(seed))).toEqual(
                    generateRhythm(level, rngOf(seed)),
                );
            }),
        );
    });

    it("answers with a level it has, whatever it is asked for", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer({ min: -1000, max: 1000 }),
                    fc.double({ min: -50, max: 50, noNaN: true }),
                ),
                arbSeed,
                (asked, seed) => {
                    const pattern = generateRhythm(asked, rngOf(seed));

                    expect(pattern.level).toBeGreaterThanOrEqual(0);
                    expect(pattern.level).toBeLessThan(RHYTHM_LEVELS.length);
                    expect(Number.isInteger(pattern.level)).toBe(true);
                    expect(sumOf(pattern.cells)).toBeCloseTo(totalBeats(pattern), 9);
                },
            ),
        );
    });
});

describe("when the taps are expected", () => {
    const arbBpm = fc.integer({ min: 30, max: 240 });

    it("expects one tap per note and none for a rest", () => {
        fc.assert(
            fc.property(arbPattern, arbBpm, (pattern, bpm) => {
                const onsets = expectedOnsets(pattern, bpm);

                expect(onsets.length).toBe(pattern.cells.filter((cell) => !cell.rest).length);
                expect([...onsets].sort((a, b) => a - b)).toEqual(onsets);
                for (const onset of onsets) {
                    expect(onset).toBeGreaterThanOrEqual(0);
                    // A tap expected at or past the end could never be given.
                    expect(onset).toBeLessThan(patternMs(pattern, bpm));
                }
            }),
        );
    });

    it("runs twice as fast at twice the tempo", () => {
        fc.assert(
            fc.property(arbPattern, arbBpm, (pattern, bpm) => {
                const slow = expectedOnsets(pattern, bpm);
                const fast = expectedOnsets(pattern, bpm * 2);

                expect(fast.length).toBe(slow.length);
                fast.forEach((onset, at) => {
                    expect(onset).toBeCloseTo((slow[at] as number) / 2, 6);
                });
                expect(patternMs(pattern, bpm * 2)).toBeCloseTo(patternMs(pattern, bpm) / 2, 6);
            }),
        );
    });

    it("lasts as long as its bars say", () => {
        fc.assert(
            fc.property(arbPattern, arbBpm, (pattern, bpm) => {
                const starts = cellBeats(pattern);

                expect(starts[0]).toBe(0);
                expect([...starts].sort((a, b) => a - b)).toEqual(starts);
                expect(patternMs(pattern, bpm)).toBeGreaterThan(0);
            }),
        );
    });
});
