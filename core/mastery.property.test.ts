// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyRun, type Mastery } from "./mastery";

const DAY = 86_400_000;
const NOW = 1_000_000_000_000;
const THRESHOLD = 85;

const passing = fc.integer({ min: THRESHOLD, max: 100 });

// A learned piece somewhere in its schedule: any interval the growth can produce, due
// anywhere from well past to well ahead of now.
const learnedPiece: fc.Arbitrary<Mastery> = fc.record({
    bestScore: fc.integer({ min: THRESHOLD, max: 100 }),
    learned: fc.constant(true),
    backlog: fc.boolean(),
    intervalDays: fc.integer({ min: 1, max: 180 }),
    reviewAt: fc.integer({ min: NOW - 400 * DAY, max: NOW + 400 * DAY }),
    updatedAt: fc.constant(NOW - 400 * DAY),
    deadline: fc.constant(""),
});

describe("applyRun (properties)", () => {
    // Passes landing within 21.6 hours of the first, in order.
    const sitting = fc
        .array(fc.tuple(fc.integer({ min: 0, max: 0.9 * DAY - 1 }), passing), { maxLength: 12 })
        .map((repeats) => [...repeats].sort((a, b) => a[0] - b[0]));

    it("repeat passes after a pass that counted leave the schedule where it put it", () => {
        // Within the 21.6 hours after a counted pass, however many further passes land, the
        // schedule does not move: the earliest review is a day out, and an early pass
        // counts only inside the last tenth of its interval. A first pass that was itself
        // too early moved nothing, so the window it left can open during the sitting —
        // the property below covers that case.
        fc.assert(
            fc.property(
                fc.option(learnedPiece, { nil: null }),
                passing,
                sitting,
                (start, first, repeats) => {
                    const once = applyRun(start, first, THRESHOLD, NOW);
                    fc.pre(once.reviewAt === NOW + once.intervalDays * DAY);
                    let state = once;
                    for (const [offset, score] of repeats) {
                        state = applyRun(state, score, THRESHOLD, NOW + offset);
                    }
                    expect(state.reviewAt).toBe(once.reviewAt);
                    expect(state.intervalDays).toBe(once.intervalDays);
                },
            ),
        );
    });

    it("passes within 21.6 hours of each other move the schedule at most once", () => {
        fc.assert(
            fc.property(
                fc.option(learnedPiece, { nil: null }),
                passing,
                sitting,
                (start, first, repeats) => {
                    let state = start;
                    let moves = 0;
                    for (const [offset, score] of [[0, first] as const, ...repeats]) {
                        const next = applyRun(state, score, THRESHOLD, NOW + offset);
                        if (
                            next.reviewAt !== state?.reviewAt ||
                            next.intervalDays !== state.intervalDays
                        ) {
                            moves += 1;
                        }
                        state = next;
                    }
                    expect(moves).toBeLessThanOrEqual(1);
                },
            ),
        );
    });

    it("a pass never shrinks the interval or pulls the review closer", () => {
        fc.assert(
            fc.property(
                learnedPiece,
                passing,
                fc.integer({ min: -400 * DAY, max: 400 * DAY }),
                (before, score, offset) => {
                    const now = NOW + offset;
                    const next = applyRun(before, score, THRESHOLD, now);
                    expect(next.intervalDays).toBeGreaterThanOrEqual(before.intervalDays);
                    expect(next.reviewAt).toBeGreaterThanOrEqual(before.reviewAt);
                    expect(next.bestScore).toBe(Math.max(before.bestScore, score));
                    expect(next.updatedAt).toBe(now);
                },
            ),
        );
    });

    it("a pass once the review is due grows the interval from now, as it always has", () => {
        fc.assert(
            fc.property(
                learnedPiece,
                passing,
                fc.integer({ min: 0, max: 400 * DAY }),
                (before, score, lateBy) => {
                    const now = before.reviewAt + lateBy;
                    const next = applyRun(before, score, THRESHOLD, now);
                    const grown = Math.min(180, Math.max(1, Math.round(before.intervalDays * 2.3)));
                    expect(next.intervalDays).toBe(grown);
                    expect(next.reviewAt).toBe(now + grown * DAY);
                },
            ),
        );
    });

    it("a failing run resets the interval whenever it lands", () => {
        fc.assert(
            fc.property(
                learnedPiece,
                fc.integer({ min: 0, max: THRESHOLD - 1 }),
                fc.integer({ min: -400 * DAY, max: 400 * DAY }),
                (before, score, offset) => {
                    const now = NOW + offset;
                    const next = applyRun(before, score, THRESHOLD, now);
                    expect(next.intervalDays).toBe(1);
                    expect(next.reviewAt).toBe(now + DAY);
                },
            ),
        );
    });
});
