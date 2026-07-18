// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { beginHold, type Hold, holdFraction, holdFractionsByNote, pruneHolds } from "./holds";

// The hold indicator drives a per-frame fill, so its fraction feeds a CSS height
// directly: it must stay in [0, 1] for any clock the scheduler reports and only
// ever shrink as time moves forward — no input can push the fill past full or
// make it grow back.

const hold = fc.record({
    note: fc.integer({ min: 21, max: 108 }),
    startMs: fc.integer({ min: 0, max: 1_000_000 }),
    endMs: fc.integer({ min: 0, max: 1_000_000 }),
}) satisfies fc.Arbitrary<Hold>;

describe("holdFraction", () => {
    it("stays within [0, 1] for any clock", () => {
        fc.assert(
            fc.property(hold, fc.integer({ min: -10_000, max: 2_000_000 }), (h, now) => {
                const fraction = holdFraction(h, now);
                expect(fraction).toBeGreaterThanOrEqual(0);
                expect(fraction).toBeLessThanOrEqual(1);
            }),
        );
    });

    it("never grows as the clock advances", () => {
        fc.assert(
            fc.property(
                hold,
                fc.integer({ min: 0, max: 1_000_000 }),
                fc.integer({ min: 0, max: 1_000_000 }),
                (h, a, b) => {
                    const [earlier, later] = a <= b ? [a, b] : [b, a];
                    expect(holdFraction(h, later)).toBeLessThanOrEqual(holdFraction(h, earlier));
                },
            ),
        );
    });
});

describe("beginHold + pruneHolds", () => {
    it("keeps at most one hold per note", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        note: fc.integer({ min: 21, max: 108 }),
                        startMs: fc.integer({ min: 0, max: 100_000 }),
                        durationMs: fc.integer({ min: 0, max: 5_000 }),
                    }),
                    { maxLength: 40 },
                ),
                (strikes) => {
                    let holds: Hold[] = [];
                    for (const strike of strikes) {
                        holds = beginHold(holds, strike.note, strike.startMs, strike.durationMs);
                    }
                    const notes = holds.map((h) => h.note);
                    expect(new Set(notes).size).toBe(notes.length);
                },
            ),
        );
    });

    it("only reports notes that survived the prune, all with a positive fill", () => {
        fc.assert(
            fc.property(
                fc.array(hold, { maxLength: 30 }),
                fc.integer({ min: 0, max: 1_000_000 }),
                (holds, now) => {
                    const fractions = holdFractionsByNote(pruneHolds(holds, now), now);
                    for (const fraction of fractions.values()) {
                        expect(fraction).toBeGreaterThan(0);
                    }
                },
            ),
        );
    });
});
