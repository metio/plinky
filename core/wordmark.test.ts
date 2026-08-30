// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    ASCENT,
    DESCENT,
    tittleCircle,
    tittleFromBoxBottom,
    tittleFromBoxTop,
    TITTLE,
    wordmarkText,
} from "./wordmark";

describe("wordmarkText", () => {
    it("spells the name with a dotless stem, so the mark can draw its own dot", () => {
        expect(wordmarkText(false)).toBe("Plınky");
        expect(wordmarkText(true)).toBe("Plınky.fun");
        // A plain "i" would show the face's own tittle under the drawn one.
        expect(wordmarkText(true)).not.toContain("i");
    });
});

describe("the tittle, from whichever edge a surface measures", () => {
    it("agrees with itself whichever end it is anchored to", () => {
        // The two CSS offsets are the same dot described from opposite edges, so they must
        // add up to the box's full height with the dot's own size taken out. This is the
        // check the three hand-written copies never had, and they had drifted by 0.02em.
        const boxHeight = ASCENT + DESCENT;
        expect(tittleFromBoxTop() + TITTLE.size + tittleFromBoxBottom()).toBeCloseTo(boxHeight, 10);
    });

    it("places the circle's underside where the CSS offsets say", () => {
        const size = 100;
        const { cy, r } = tittleCircle(50, 200, size);
        // Underside 0.55em above the baseline at 200.
        expect(cy + r).toBeCloseTo(200 - size * TITTLE.baseAbove, 10);
        expect(r * 2).toBeCloseTo(size * TITTLE.size, 10);
    });

    it("centres on the stem it is given", () => {
        expect(tittleCircle(42, 0, 10).cx).toBe(42);
    });

    it("scales with the type", () => {
        const small = tittleCircle(0, 0, 10);
        const large = tittleCircle(0, 0, 20);
        expect(large.r).toBeCloseTo(small.r * 2, 10);
    });
});
