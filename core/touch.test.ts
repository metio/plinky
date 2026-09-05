// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { MELODY_LEAD_MS, noteDelayMs, phraseProgress, rubatoStretch, touchVelocity } from "./touch";

const BARS = [{ from: 0, beats: 4, beatType: 4 }];

describe("phraseProgress", () => {
    it("reads how far into a written slur a position is", () => {
        const slurs = [{ from: 1, to: 3 }];
        expect(phraseProgress(BARS, slurs, 1)).toBe(0);
        expect(phraseProgress(BARS, slurs, 2)).toBe(0.5);
        expect(phraseProgress(BARS, slurs, 3)).toBe(1);
    });

    it("assumes a four-bar phrase where the page writes none", () => {
        expect(phraseProgress(BARS, [], 0)).toBe(0);
        expect(phraseProgress(BARS, [], 2)).toBeCloseTo(0.5);
        expect(phraseProgress(BARS, [], 3.75)).toBeCloseTo(15 / 16);
        // A score with no metre has no phrase to place a note in.
        expect(phraseProgress([], [], 2)).toBe(0);
    });
});

describe("rubatoStretch", () => {
    it("keeps time through most of a phrase and settles into its ending", () => {
        expect(rubatoStretch(0, null)).toBe(1);
        expect(rubatoStretch(0.7, null)).toBe(1);
        expect(rubatoStretch(0.9, null)).toBeGreaterThan(1);
        expect(rubatoStretch(1, null)).toBeCloseTo(1.06);
        expect(rubatoStretch(1, null)).toBeGreaterThan(rubatoStretch(0.9, null));
    });

    it("broadens the last bar of the piece towards its end", () => {
        expect(rubatoStretch(0, 0)).toBe(1);
        expect(rubatoStretch(0, 1)).toBeCloseTo(1.25);
        expect(rubatoStretch(0, 0.5)).toBeGreaterThan(rubatoStretch(0, 0.25));
    });
});

describe("noteDelayMs", () => {
    it("strikes the tune on the moment and the accompaniment a hair later", () => {
        const tune = noteDelayMs(3, 72, true);
        const under = noteDelayMs(3, 48, false);
        expect(tune).toBeLessThan(5);
        expect(under).toBeGreaterThan(MELODY_LEAD_MS - 5);
        expect(under).toBeLessThan(MELODY_LEAD_MS + 5);
    });

    it("plays the same piece the same way every time", () => {
        expect(noteDelayMs(7, 60, false)).toBe(noteDelayMs(7, 60, false));
        expect(noteDelayMs(7, 60, false)).not.toBe(noteDelayMs(8, 60, false));
    });
});

describe("touchVelocity", () => {
    it("varies a few percent either way, never more", () => {
        const scales = Array.from({ length: 200 }, (_, index) =>
            touchVelocity(index, 60 + (index % 12)),
        );
        expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.97);
        expect(Math.max(...scales)).toBeLessThanOrEqual(1.03);
        expect(new Set(scales.map((one) => one.toFixed(3))).size).toBeGreaterThan(20);
    });
});
