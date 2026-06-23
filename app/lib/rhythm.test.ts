// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { GOOD_MS, PERFECT_MS, makeHit, rate, summarize } from "./rhythm";

describe("rate", () => {
    it("is perfect at and within the perfect window", () => {
        expect(rate(0)).toBe("perfect");
        expect(rate(PERFECT_MS)).toBe("perfect");
    });

    it("is good between the windows", () => {
        expect(rate(PERFECT_MS + 1)).toBe("good");
        expect(rate(GOOD_MS)).toBe("good");
    });

    it("is off beyond the good window", () => {
        expect(rate(GOOD_MS + 1)).toBe("off");
    });
});

describe("makeHit", () => {
    it("rates on the absolute delta but keeps the sign", () => {
        expect(makeHit(3, -200)).toEqual({ index: 3, deltaMs: -200, rating: "off" });
        expect(makeHit(1, 30)).toEqual({ index: 1, deltaMs: 30, rating: "perfect" });
    });
});

describe("summarize", () => {
    it("counts ratings and averages the absolute deltas", () => {
        const summary = summarize([makeHit(1, 20), makeHit(2, -100), makeHit(3, 300)]);
        expect(summary).toEqual({
            perfect: 1,
            good: 1,
            off: 1,
            total: 3,
            averageAbsMs: (20 + 100 + 300) / 3,
        });
    });

    it("handles an empty run", () => {
        expect(summarize([])).toEqual({ perfect: 0, good: 0, off: 0, total: 0, averageAbsMs: 0 });
    });
});
