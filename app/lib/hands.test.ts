// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { groupByHand, type StaffOnset, totalSteps } from "./hands";

function onset(
    staff: number,
    timeMs: number,
    pitches: number[],
    elements: HTMLElement[] = [],
): StaffOnset {
    return { staff, timeMs, pitches, elements };
}

describe("groupByHand", () => {
    it("sequences per-staff onsets into one stream per hand", () => {
        const hands = groupByHand([
            onset(0, 0, [72]),
            onset(1, 0, [60]),
            onset(0, 500, [74]),
            onset(1, 1000, [64]),
        ]);
        expect(hands.map((hand) => hand.staff)).toEqual([0, 1]);
        expect(hands.map((hand) => hand.label)).toEqual(["Right", "Left"]);
        expect(hands[0].steps.map((step) => step.pitches)).toEqual([[72], [74]]);
        expect(hands[0].steps.map((step) => step.timeMs)).toEqual([0, 500]);
        expect(hands[1].steps.map((step) => step.pitches)).toEqual([[60], [64]]);
    });

    it("keeps a multi-note onset together as a chord step", () => {
        expect(groupByHand([onset(0, 0, [72, 76])])[0].steps[0].pitches).toEqual([72, 76]);
    });

    it("skips onsets with no pitches", () => {
        expect(groupByHand([onset(0, 0, [72]), onset(0, 500, [])])[0].steps).toHaveLength(1);
    });

    it("orders hands by staff regardless of onset order", () => {
        const hands = groupByHand([onset(1, 0, [60]), onset(0, 0, [72])]);
        expect(hands.map((hand) => hand.staff)).toEqual([0, 1]);
    });

    it("carries each step's score elements", () => {
        const element = { style: { fill: "" } } as unknown as HTMLElement;
        expect(groupByHand([onset(0, 0, [72], [element])])[0].steps[0].elements).toEqual([element]);
    });
});

describe("totalSteps", () => {
    it("sums the steps across every hand", () => {
        const hands = groupByHand([onset(0, 0, [72]), onset(0, 500, [74]), onset(1, 0, [60])]);
        expect(totalSteps(hands)).toBe(3);
    });
});
