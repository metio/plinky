// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { fingerPositions } from "./fingering";
import { reasonFor, scoreFingering } from "./fingeringScore";

// A line of single-note positions, plus one with a chord.
const LINE: number[][] = [[60], [62], [64], [65], [67], [69], [71], [72]];
const WITH_CHORD: number[][] = [[60, 64, 67], [65], [67], [60, 64, 67]];

describe("scoreFingering", () => {
    it("gives the chooser's own fingering full marks and nothing to reconsider", () => {
        const best = fingerPositions(LINE, "right");
        const result = scoreFingering(LINE, best, "right");
        expect(result.efficiency).toBe(1);
        expect(result.reconsider).toEqual([]);
        expect(result.suggested).toEqual(best);
    });

    it("marks an awkward fingering down and points to positions to reconsider", () => {
        // The same finger on every moving note is maximally awkward.
        const result = scoreFingering(
            LINE,
            LINE.map(() => [1]),
            "right",
        );
        expect(result.efficiency).toBeLessThan(1);
        expect(result.reconsider.length).toBeGreaterThan(0);
    });

    it("scores a chord line and accepts the chooser's chord fingering", () => {
        const best = fingerPositions(WITH_CHORD, "right");
        // Every chord gets one finger per note.
        expect(best.map((tuple) => tuple.length)).toEqual([3, 1, 1, 3]);
        const result = scoreFingering(WITH_CHORD, best, "right");
        expect(result.efficiency).toBe(1);
        expect(result.reconsider).toEqual([]);
    });

    it("flags a clumsy chord shape against a comfortable one", () => {
        // Fingering a C–E–G triad 1–2–3 is a cramped reach; the chooser spreads it.
        const result = scoreFingering([[60, 64, 67]], [[1, 2, 3]], "right");
        expect(result.suggested[0]).not.toEqual([1, 2, 3]);
        expect(result.efficiency).toBeLessThan(1);
    });
});

describe("reasonFor", () => {
    it("names a thumb on a black key", () => {
        // C#4 (61) is a black key.
        expect(reasonFor([[61]], [[1]], 0, "right")).toBe("thumbBlack");
    });

    it("names the same finger repeated across a leap", () => {
        expect(reasonFor([[60], [64]], [[3], [3]], 1, "right")).toBe("repeat");
    });

    it("falls back to a general reason otherwise", () => {
        expect(reasonFor([[60], [62]], [[1], [2]], 1, "right")).toBe("general");
    });
});
