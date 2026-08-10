// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type ExpressionNote, summarizeExpression } from "./expressionGrade";

// A run of notes over a written crescendo, played however the test asks.
function crescendo(played: number[]): ExpressionNote[] {
    const written = [40, 60, 80, 100, 120];
    return played.map((velocity, index) => ({
        velocity,
        expectedVelocity: written[index] ?? 120,
        expectedHoldMs: 0,
    }));
}

function lengths(pairs: Array<{ heldMs: number; expectedHoldMs: number }>): ExpressionNote[] {
    return pairs.map((pair) => ({
        velocity: 80,
        heldMs: pair.heldMs,
        expectedVelocity: null,
        expectedHoldMs: pair.expectedHoldMs,
    }));
}

describe("dynamics", () => {
    it("rewards a run that follows the written shape", () => {
        const summary = summarizeExpression(crescendo([40, 55, 70, 85, 100]));
        expect(summary?.dynamics).toBe(100);
    });

    it("grades the shape, not the level — a quiet piano scores the same", () => {
        // Every velocity a third of the one above; the contour is identical.
        const loud = summarizeExpression(crescendo([40, 55, 70, 85, 100]));
        const quiet = summarizeExpression(crescendo([13, 18, 23, 28, 33]));
        expect(quiet?.dynamics).toBe(loud?.dynamics);
    });

    it("marks down a run that plays the crescendo backwards", () => {
        const summary = summarizeExpression(crescendo([100, 85, 70, 55, 40]));
        expect(summary?.dynamics).toBe(0);
    });

    it("puts a run that ignores the shape in the middle rather than at zero", () => {
        // Playing evenly through a crescendo is a missed instruction, not a wrong note.
        const summary = summarizeExpression(crescendo([80, 81, 80, 81, 80]));
        expect(summary?.dynamics).toBeGreaterThan(35);
        expect(summary?.dynamics).toBeLessThan(65);
    });

    it("says nothing when the score marks no dynamic changes", () => {
        const flat: ExpressionNote[] = [40, 55, 70, 85].map((velocity) => ({
            velocity,
            expectedVelocity: 90,
            expectedHoldMs: 0,
        }));
        expect(summarizeExpression(flat)).toBeNull();
    });

    it("says nothing when the input reports no real velocity", () => {
        // A computer keyboard reports one constant velocity for every key.
        expect(summarizeExpression(crescendo([80, 80, 80, 80, 80]))).toBeNull();
    });

    it("says nothing about too few notes to read a shape from", () => {
        expect(summarizeExpression(crescendo([40, 100]))).toBeNull();
    });
});

describe("articulation", () => {
    it("rewards note lengths that match what is written", () => {
        const summary = summarizeExpression(
            lengths([
                { heldMs: 250, expectedHoldMs: 250 },
                { heldMs: 500, expectedHoldMs: 500 },
                { heldMs: 250, expectedHoldMs: 250 },
                { heldMs: 500, expectedHoldMs: 500 },
            ]),
        );
        expect(summary?.articulation).toBe(100);
    });

    it("forgives a small difference — two pianists never agree to the millisecond", () => {
        const summary = summarizeExpression(
            lengths([
                { heldMs: 270, expectedHoldMs: 250 },
                { heldMs: 470, expectedHoldMs: 500 },
                { heldMs: 230, expectedHoldMs: 250 },
                { heldMs: 540, expectedHoldMs: 500 },
            ]),
        );
        expect(summary?.articulation).toBe(100);
    });

    it("marks down a page of staccato played legato", () => {
        const summary = summarizeExpression(
            lengths([
                { heldMs: 500, expectedHoldMs: 125 },
                { heldMs: 500, expectedHoldMs: 125 },
                { heldMs: 500, expectedHoldMs: 125 },
                { heldMs: 500, expectedHoldMs: 125 },
            ]),
        );
        expect(summary?.articulation).toBe(0);
    });

    it("judges the shaping, not the tempo — a slower run of the same shape scores alike", () => {
        const written = [125, 500, 125, 500];
        const atTempo = lengths(written.map((ms) => ({ heldMs: ms, expectedHoldMs: ms })));
        // Half speed: every held length doubles, and so does every written one.
        const slower = lengths(written.map((ms) => ({ heldMs: ms * 2, expectedHoldMs: ms * 2 })));
        expect(summarizeExpression(slower)?.articulation).toBe(
            summarizeExpression(atTempo)?.articulation,
        );
    });

    it("says nothing when the input reports no key releases", () => {
        const noHolds: ExpressionNote[] = crescendo([40, 55, 70, 85, 100]).map((note) => ({
            ...note,
            expectedHoldMs: 500,
        }));
        expect(summarizeExpression(noHolds)?.articulation).toBeNull();
    });
});

describe("summarizeExpression", () => {
    it("averages over whichever halves could be measured", () => {
        const notes = crescendo([40, 55, 70, 85, 100]).map((note) => ({
            ...note,
            heldMs: 500,
            expectedHoldMs: 500,
        }));
        const summary = summarizeExpression(notes);
        expect(summary).toEqual({ dynamics: 100, articulation: 100, score: 100 });
    });

    it("is null when neither half has anything to say", () => {
        // An unmarked score played on a computer keyboard: nothing written to follow,
        // nothing measured to compare. Saying so beats awarding full marks.
        expect(
            summarizeExpression([
                { velocity: 80, expectedVelocity: null, expectedHoldMs: 0 },
                { velocity: 80, expectedVelocity: null, expectedHoldMs: 0 },
                { velocity: 80, expectedVelocity: null, expectedHoldMs: 0 },
                { velocity: 80, expectedVelocity: null, expectedHoldMs: 0 },
            ]),
        ).toBeNull();
    });

    it("is empty for an empty run", () => {
        expect(summarizeExpression([])).toBeNull();
    });
});
