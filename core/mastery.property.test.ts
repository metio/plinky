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
    it("repeat passes after one pass leave the schedule where that pass put it", () => {
        // Within the 21.6 hours after a pass, however many further passes land, the
        // schedule does not move: the earliest review is a day out, and an early pass
        // counts only inside the last tenth of its interval.
        fc.assert(
            fc.property(
                fc.option(learnedPiece, { nil: null }),
                passing,
                fc.array(fc.tuple(fc.integer({ min: 0, max: 0.9 * DAY - 1 }), passing), {
                    maxLength: 12,
                }),
                (start, first, repeats) => {
                    const once = applyRun(start, first, THRESHOLD, NOW);
                    let state = once;
                    for (const [offset, score] of [...repeats].sort((a, b) => a[0] - b[0])) {
                        state = applyRun(state, score, THRESHOLD, NOW + offset);
                    }
                    expect(state.reviewAt).toBe(once.reviewAt);
                    expect(state.intervalDays).toBe(once.intervalDays);
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
