// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { groupByHand } from "./hands";

// startChars 10/12 are on the top staff, 20/22 on the bottom.
const staffOf = new Map([
    [10, 0],
    [12, 0],
    [20, 1],
    [22, 1],
]);

function event(ms: number, pitches: [number, number][]) {
    return {
        milliseconds: ms,
        midiPitches: pitches.map(([pitch, startChar]) => ({ pitch, startChar })),
    };
}

describe("groupByHand", () => {
    it("splits a merged timeline into per-staff hands", () => {
        const hands = groupByHand(
            [
                event(0, [
                    [72, 10],
                    [60, 20],
                ]),
                event(500, [[74, 12]]),
                event(1000, [[64, 22]]),
            ],
            staffOf,
        );
        expect(hands.map((hand) => hand.staff)).toEqual([0, 1]);
        expect(hands.map((hand) => hand.label)).toEqual(["Right", "Left"]);
        expect(hands[0].steps).toEqual([
            { pitches: [72], timeMs: 0 },
            { pitches: [74], timeMs: 500 },
        ]);
        expect(hands[1].steps).toEqual([
            { pitches: [60], timeMs: 0 },
            { pitches: [64], timeMs: 1000 },
        ]);
    });

    it("keeps simultaneous same-staff notes together as a chord step", () => {
        const hands = groupByHand(
            [
                event(0, [
                    [72, 10],
                    [76, 12],
                ]),
            ],
            staffOf,
        );
        expect(hands).toHaveLength(1);
        expect(hands[0].steps[0].pitches).toEqual([72, 76]);
    });

    it("yields a single hand for a single-staff piece", () => {
        const hands = groupByHand([event(0, [[72, 10]]), event(500, [[74, 12]])], staffOf);
        expect(hands).toHaveLength(1);
        expect(hands[0].staff).toBe(0);
    });

    it("defaults an unknown startChar to the top staff", () => {
        const hands = groupByHand([event(0, [[72, 999]])], staffOf);
        expect(hands[0].staff).toBe(0);
    });
});
