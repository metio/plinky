// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    FERMATA_STRETCH,
    NOMINAL_BPM,
    type Position,
    quartersMs,
    writtenOnsetsMs,
} from "./elapsed";

// A position lasting a whole bar of 4/4 at the given printed onset. At 60 bpm a quarter
// note is a second, so a bar is 4000 ms.
const bar = (whole: number, over: Partial<Position> = {}): Position => ({
    whole,
    advanceQuarters: 4,
    bpm: NOMINAL_BPM,
    stretch: 1,
    ...over,
});

describe("writtenOnsetsMs", () => {
    it("spaces a piece that plays straight through by its written lengths", () => {
        expect(writtenOnsetsMs([bar(0), bar(1), bar(2)])).toEqual([0, 4000, 8000]);
    });

    it("keeps counting through a repeat instead of rewinding", () => {
        // Two bars, played twice: the printed onsets are 0, 1, 0, 1 and the third bar
        // follows. The second pass of bar 1 is due a bar after the first.
        const walk = [bar(0), bar(1), bar(0), bar(1), bar(2)];
        expect(writtenOnsetsMs(walk)).toEqual([0, 4000, 8000, 12_000, 16_000]);
    });

    it("does not charge the player for an ending the music skips", () => {
        // A first ending at bar 2 is played, then skipped: the walk jumps from the end of
        // bar 1 straight to bar 3. Only the time actually performed is counted.
        const walk = [bar(0), bar(1), bar(0), bar(2)];
        expect(writtenOnsetsMs(walk)).toEqual([0, 4000, 8000, 12_000]);
    });

    it("follows a tempo change instead of averaging over it", () => {
        // Two bars at 120, then the rest at 60: the fast bars are worth half as much
        // time as the slow ones, and a player who obeys the mark is on the beat.
        const walk = [
            bar(0, { bpm: 120 }),
            bar(1, { bpm: 120 }),
            bar(2, { bpm: 60 }),
            bar(3, { bpm: 60 }),
        ];
        expect(writtenOnsetsMs(walk)).toEqual([0, 2000, 4000, 8000]);
    });

    it("waits at a fermata, and only after it", () => {
        // The fermata is on bar 1: bar 2 arrives late by the extra hold, and bar 1 itself
        // is not moved — the wait belongs to the note, not to what came before it.
        const walk = [bar(0), bar(1, { stretch: FERMATA_STRETCH }), bar(2)];
        expect(writtenOnsetsMs(walk)).toEqual([0, 4000, 12_000]);
    });

    it("starts every performance at zero", () => {
        // A run beginning mid-piece is still the start of that performance; the capture
        // subtracts its own origin anyway.
        expect(writtenOnsetsMs([bar(8), bar(9)])).toEqual([0, 4000]);
    });

    it("holds up under a triplet's rounded onsets", () => {
        const third = 1 / 3;
        const walk = [
            bar(0, { advanceQuarters: 4 * third }),
            bar(third, { advanceQuarters: 4 * third }),
            bar(2 * third, { advanceQuarters: 4 * third }),
        ];
        const onsets = writtenOnsetsMs(walk);
        expect(onsets[1]).toBeCloseTo(4000 * third, 6);
        expect(onsets[2]).toBeCloseTo(8000 * third, 6);
    });

    it("never goes backwards, whatever the walk", () => {
        const walk = [bar(0), bar(1), bar(0), bar(1), bar(0), bar(3), bar(4)];
        const onsets = writtenOnsetsMs(walk);
        for (const [index, at] of onsets.entries()) {
            if (index > 0) {
                expect(at).toBeGreaterThan(onsets[index - 1] as number);
            }
        }
    });

    it("handles an empty walk", () => {
        expect(writtenOnsetsMs([])).toEqual([]);
    });

    it("still reports an onset where the score gives no length", () => {
        // A zero-length glitch stalls time rather than rewinding it.
        const walk = [bar(0, { advanceQuarters: 0 }), bar(0)];
        expect(writtenOnsetsMs(walk)).toEqual([0, 0]);
    });
});

describe("quartersMs", () => {
    it("counts a quarter note as a second at 60", () => {
        expect(quartersMs(1, 60)).toBe(1000);
        expect(quartersMs(4, 120)).toBe(2000);
    });

    it("refuses to divide by a stopped clock", () => {
        expect(Number.isFinite(quartersMs(1, 0))).toBe(true);
    });
});
