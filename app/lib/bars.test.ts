// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { barIndex, buildRegion, regionSpanMs, totalBars } from "./bars";
import type { Hand } from "./hands";

// At 100 bpm, 4/4, a bar is 2400 ms and a beat 600 ms.
const beatsPerBar = 4;
const tempo = 100;

function step(timeMs: number) {
    return { pitches: [60], timeMs, elements: [] as HTMLElement[] };
}

const hands: Hand[] = [
    {
        staff: 0,
        label: "Right",
        steps: [step(0), step(600), step(1200), step(1800), step(2400), step(3000)],
    },
];

describe("barIndex", () => {
    it("places notes in the right bar, including the bar line", () => {
        expect(barIndex(0, beatsPerBar, tempo)).toBe(0);
        expect(barIndex(1800, beatsPerBar, tempo)).toBe(0);
        expect(barIndex(2400, beatsPerBar, tempo)).toBe(1);
        expect(barIndex(3000, beatsPerBar, tempo)).toBe(1);
    });
});

describe("totalBars", () => {
    it("counts the bars spanned by the notes", () => {
        expect(totalBars(hands, beatsPerBar, tempo)).toBe(2);
    });
});

describe("buildRegion", () => {
    it("keeps only the notes in the bar range", () => {
        const region = buildRegion(hands, 1, 1, beatsPerBar, tempo);
        expect(region[0].steps.map((s) => s.timeMs)).toEqual([2400, 3000]);
    });

    it("drops hands with no notes in the range", () => {
        const region = buildRegion(hands, 5, 5, beatsPerBar, tempo);
        expect(region).toEqual([]);
    });
});

describe("regionSpanMs", () => {
    it("measures first note to last", () => {
        expect(regionSpanMs(buildRegion(hands, 0, 0, beatsPerBar, tempo))).toBe(1800);
    });
});
