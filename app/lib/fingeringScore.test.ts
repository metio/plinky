// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { fingerLine } from "./fingering";
import { scoreFingering } from "./fingeringScore";

const LINE = [60, 62, 64, 65, 67, 69, 71, 72];

describe("scoreFingering", () => {
    it("gives the chooser's own fingering full marks and nothing to reconsider", () => {
        const best = fingerLine(LINE, "right");
        const result = scoreFingering(LINE, best, "right");
        expect(result.efficiency).toBe(1);
        expect(result.reconsider).toEqual([]);
        expect(result.suggested).toEqual(best);
    });

    it("marks an awkward fingering down and points to notes to reconsider", () => {
        // The same finger on every moving note is maximally awkward.
        const result = scoreFingering(LINE, [1, 1, 1, 1, 1, 1, 1, 1], "right");
        expect(result.efficiency).toBeLessThan(1);
        expect(result.reconsider.length).toBeGreaterThan(0);
    });

    it("leaves a different-but-comfortable choice unflagged", () => {
        // Shifting a clean ascending run to start on finger 2 instead of 1 is a
        // valid alternative; effort stays close, so it should not all be flagged.
        const best = fingerLine(LINE, "right");
        const shifted = best.map((finger) => Math.min(5, finger + 1));
        const result = scoreFingering(LINE, shifted, "right");
        expect(result.reconsider.length).toBeLessThan(LINE.length);
    });
});
