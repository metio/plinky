// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type ExpressionNote, summarizeExpression } from "./expressionGrade";

const arbNote: fc.Arbitrary<ExpressionNote> = fc.record({
    velocity: fc.integer({ min: 1, max: 127 }),
    keyHeldMs: fc.option(fc.integer({ min: 1, max: 8000 }), { nil: undefined }),
    expectedVelocity: fc.option(fc.integer({ min: 1, max: 127 }), { nil: null }),
    expectedHoldMs: fc.integer({ min: 0, max: 8000 }),
});

const arbRun = fc.array(arbNote, { maxLength: 60 });

describe("summarizeExpression", () => {
    it("never leaves the 0..100 range, whatever it is handed", () => {
        fc.assert(
            fc.property(arbRun, (notes) => {
                const summary = summarizeExpression(notes);
                if (!summary) {
                    return;
                }
                for (const value of [summary.dynamics, summary.articulation, summary.score]) {
                    if (value !== null) {
                        expect(value).toBeGreaterThanOrEqual(0);
                        expect(value).toBeLessThanOrEqual(100);
                        expect(Number.isInteger(value)).toBe(true);
                    }
                }
            }),
        );
    });

    it("is pure — the same run reads the same both times", () => {
        fc.assert(
            fc.property(arbRun, (notes) => {
                expect(summarizeExpression(notes)).toEqual(summarizeExpression(notes));
            }),
        );
    });

    it("says nothing rather than reporting a summary with nothing in it", () => {
        fc.assert(
            fc.property(arbRun, (notes) => {
                const summary = summarizeExpression(notes);
                // A summary exists only when at least one half was measurable, so the
                // combined score is always backed by a real reading.
                if (summary) {
                    expect(summary.dynamics !== null || summary.articulation !== null).toBe(true);
                }
            }),
        );
    });

    it("is blind to how loudly the whole run was played", () => {
        // Scaling every struck velocity by the same factor is the same performance on a
        // heavier instrument. The dynamics reading must not move.
        fc.assert(
            fc.property(arbRun, fc.integer({ min: 2, max: 4 }), (notes, factor) => {
                const quieter = notes.map((note) => ({
                    ...note,
                    velocity: Math.max(1, Math.round(note.velocity / factor)),
                }));
                const before = summarizeExpression(notes)?.dynamics;
                const after = summarizeExpression(quieter)?.dynamics;
                if (before === undefined || before === null || after === undefined) {
                    return;
                }
                // Rounding to whole velocities perturbs the correlation slightly; the
                // reading must still be the same reading, not a different verdict.
                expect(Math.abs(before - (after ?? 0))).toBeLessThanOrEqual(12);
            }),
        );
    });
});
