// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { elapsedWholes, type Position } from "./elapsed";

// A position lasting a whole bar of 4/4, at the given printed onset.
const bar = (whole: number): Position => ({ whole, advanceQuarters: 4 });
const beat = (whole: number): Position => ({ whole, advanceQuarters: 1 });

describe("elapsedWholes", () => {
    it("leaves a piece that plays straight through alone", () => {
        expect(elapsedWholes([bar(0), bar(1), bar(2)])).toEqual([0, 1, 2]);
    });

    it("keeps counting through a repeat instead of rewinding", () => {
        // Two bars, played twice: the printed onsets are 0, 1, 0, 1 and the third bar
        // follows. The second pass of bar 1 is due a whole note after the first.
        const walk = [bar(0), bar(1), bar(0), bar(1), bar(2)];
        expect(elapsedWholes(walk)).toEqual([0, 1, 2, 3, 4]);
    });

    it("counts a repeated bar once per pass, whatever its length", () => {
        const walk = [beat(0), beat(0.25), beat(0), beat(0.25)];
        expect(elapsedWholes(walk)).toEqual([0, 0.25, 0.5, 0.75]);
    });

    it("does not charge the player for an ending the music skips", () => {
        // A first ending at bar 2 is played, then skipped: the walk jumps from the end of
        // bar 1 straight to bar 3. Only the time actually performed is counted.
        const walk = [bar(0), bar(1), bar(0), bar(2)];
        expect(elapsedWholes(walk)).toEqual([0, 1, 2, 3]);
    });

    it("starts where the first position is printed", () => {
        // A run beginning mid-piece keeps reading as a place in the score; the capture
        // subtracts its own origin anyway.
        expect(elapsedWholes([bar(8), bar(9)])).toEqual([8, 9]);
    });

    it("holds up under a triplet's rounded onsets", () => {
        const third = 1 / 3;
        const walk: Position[] = [
            { whole: 0, advanceQuarters: 4 * third },
            { whole: third, advanceQuarters: 4 * third },
            { whole: 2 * third, advanceQuarters: 4 * third },
        ];
        const elapsed = elapsedWholes(walk);
        expect(elapsed[1]).toBeCloseTo(third, 9);
        expect(elapsed[2]).toBeCloseTo(2 * third, 9);
    });

    it("never goes backwards, whatever the walk", () => {
        const walk = [bar(0), bar(1), bar(0), bar(1), bar(0), bar(3), bar(4)];
        const elapsed = elapsedWholes(walk);
        for (const [index, at] of elapsed.entries()) {
            if (index > 0) {
                expect(at).toBeGreaterThan(elapsed[index - 1] as number);
            }
        }
    });

    it("handles an empty walk", () => {
        expect(elapsedWholes([])).toEqual([]);
    });

    it("still advances at a position the score gives no length", () => {
        // A zero-length glitch would otherwise stall time at a jump.
        const walk: Position[] = [
            { whole: 0, advanceQuarters: 0 },
            { whole: 0, advanceQuarters: 4 },
        ];
        expect(elapsedWholes(walk)).toEqual([0, 0]);
    });
});
