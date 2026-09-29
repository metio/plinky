// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { foldRun, MAX_READ_MS, meanMs, type NoteStats, type StatNote } from "./noteStats";

// Which notes a player is slow to find, added up across every run they have played.
// The totals are what a player is shown, so what these pin is that folding cannot
// invent a play, lose one, or let a single interruption swamp a note's average.

const arbNote: fc.Arbitrary<StatNote> = fc
    .tuple(
        fc.uniqueArray(fc.integer({ min: 48, max: 72 }), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
    )
    .map(([pitches, wrongBefore, skipped]) => ({
        pitches,
        playedMs: 0,
        wrongBefore,
        ...(skipped ? { skipped: true } : {}),
    }));

// A run's notes land in order, so the gaps between them are the reading times. The
// gaps range either side of the cut-off, so both the counted and the discarded case
// turn up.
const arbRun = fc
    .array(fc.tuple(arbNote, fc.integer({ min: 0, max: 12_000 })), { maxLength: 12 })
    .map((steps) => {
        let at = 0;
        return steps.map(([note, gap]) => {
            at += gap;
            return { ...note, playedMs: at };
        });
    });

const total = (stats: NoteStats, of: (stat: NoteStats[string]) => number) =>
    Object.values(stats).reduce((sum, stat) => sum + of(stat), 0);

describe("noteStats, folding runs into what a player is shown", () => {
    it("counts one play per pitch of every note, and never loses a wrong key", () => {
        fc.assert(
            fc.property(arbRun, (run) => {
                const stats = foldRun({}, run);

                expect(total(stats, (stat) => stat.plays)).toBe(
                    run.reduce((sum, note) => sum + note.pitches.length, 0),
                );
                expect(total(stats, (stat) => stat.wrongs)).toBe(
                    run.reduce((sum, note) => sum + note.wrongBefore * note.pitches.length, 0),
                );
            }),
        );
    });

    it("leaves the totals it was given alone", () => {
        fc.assert(
            fc.property(arbRun, arbRun, (first, second) => {
                const once = foldRun({}, first);
                const snapshot = JSON.stringify(once);

                foldRun(once, second);

                expect(JSON.stringify(once)).toBe(snapshot);
            }),
        );
    });

    it("adds up to the same totals whichever run is folded first", () => {
        fc.assert(
            fc.property(arbRun, arbRun, (first, second) => {
                const thisWay = foldRun(foldRun({}, first), second);
                const thatWay = foldRun(foldRun({}, second), first);

                expect(thisWay).toEqual(thatWay);
            }),
        );
    });

    it("never counts an interruption as reading time", () => {
        fc.assert(
            fc.property(arbRun, (run) => {
                const stats = foldRun({}, run);

                for (const stat of Object.values(stats)) {
                    expect(stat.timed).toBeLessThanOrEqual(stat.plays);
                    expect(stat.totalMs).toBeLessThanOrEqual(stat.timed * MAX_READ_MS);
                    const mean = meanMs(stat);
                    if (mean !== null) {
                        expect(mean).toBeGreaterThanOrEqual(0);
                        expect(mean).toBeLessThanOrEqual(MAX_READ_MS);
                    }
                }
            }),
        );
    });

    it("times nothing in a run of one note, which has no gap before it", () => {
        fc.assert(
            fc.property(arbNote, (note) => {
                const stats = foldRun({}, [note]);

                for (const stat of Object.values(stats)) {
                    expect(stat.plays).toBe(1);
                    expect(stat.timed).toBe(0);
                    expect(stat.totalMs).toBe(0);
                    expect(meanMs(stat)).toBeNull();
                }
            }),
        );
    });
});
