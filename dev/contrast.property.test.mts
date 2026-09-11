// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contrast, luminance, over, type Rgb } from "./contrast.mts";

const channel = fc.double({ min: 0, max: 1, noNaN: true });
const rgb: fc.Arbitrary<Rgb> = fc.tuple(channel, channel, channel);
const alpha = fc.double({ min: 0, max: 1, noNaN: true });

describe("contrast properties", () => {
    it("is the same whichever colour is named first", () => {
        fc.assert(fc.property(rgb, rgb, (a, b) => contrast(a, b) === contrast(b, a)));
    });

    it("always lies between 1:1 and 21:1", () => {
        fc.assert(
            fc.property(rgb, rgb, (a, b) => {
                const ratio = contrast(a, b);
                return ratio >= 1 && ratio <= 21 + 1e-9;
            }),
        );
    });
});

describe("over properties", () => {
    it("lands between its two layers' luminance", () => {
        fc.assert(
            fc.property(rgb, alpha, rgb, (top, a, under) => {
                const mixed = luminance(over(top, a, under));
                const [lo, hi] = [luminance(top), luminance(under)].sort((x, y) => x - y);
                return mixed >= lo! - 1e-9 && mixed <= hi! + 1e-9;
            }),
        );
    });

    it("keeps every channel a colour", () => {
        fc.assert(
            fc.property(rgb, alpha, rgb, (top, a, under) =>
                over(top, a, under).every((c) => c >= 0 && c <= 1 + 1e-12),
            ),
        );
    });
});

describe("the hold bar", () => {
    it("never raises a label's contrast above what the bare fill gave a darker ink", () => {
        // A layer only pulls a fill toward itself, so an ink darker than both layers can
        // lose contrast under it but never gain more than the lighter layer allows.
        fc.assert(
            fc.property(rgb, alpha, rgb, (top, a, under) => {
                const black: Rgb = [0, 0, 0];
                const lighter = Math.max(luminance(top), luminance(under));
                const ceiling = (lighter + 0.05) / 0.05;
                expect(contrast(black, over(top, a, under))).toBeLessThanOrEqual(ceiling + 1e-9);
            }),
        );
    });
});
