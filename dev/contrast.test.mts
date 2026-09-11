// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { contrast, luminance, over, parseColour } from "./contrast.mts";

const WHITE = parseColour("#ffffff");
const BLACK = parseColour("#000");

describe("parseColour", () => {
    it("reads short and long hex alike", () => {
        expect(parseColour("#fff")).toEqual(WHITE);
        expect(parseColour("#000000")).toEqual(BLACK);
    });

    it("reads Tailwind's oklch palette, white and black at the ends", () => {
        const white = parseColour("oklch(100% 0 0)");
        const black = parseColour("oklch(0% 0 0)");
        for (let i = 0; i < 3; i++) {
            expect(white[i]).toBeCloseTo(1, 4);
            expect(black[i]).toBeCloseTo(0, 4);
        }
    });

    it("refuses a colour it cannot measure rather than guessing one", () => {
        expect(() => parseColour("rebeccapurple")).toThrow(/cannot measure/);
        expect(() => parseColour("rgb(0 0 0)")).toThrow(/cannot measure/);
    });
});

describe("contrast", () => {
    it("spans 21:1 from black to white and 1:1 from a colour to itself", () => {
        expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 6);
        expect(contrast(WHITE, WHITE)).toBe(1);
    });

    it("matches the WCAG figure for a known pair", () => {
        // #767676 on white is the textbook grey that just clears AA, at 4.54:1.
        expect(contrast(parseColour("#767676"), WHITE)).toBeCloseTo(4.54, 2);
    });

    it("measures Tailwind's gray-500 on white where the palette's hex would put it", () => {
        // gray-500 is #6a7282 in sRGB; the two readings agree to a rounding.
        const fromOklch = parseColour("oklch(55.1% 0.027 264.364)");
        expect(contrast(fromOklch, WHITE)).toBeCloseTo(contrast(parseColour("#6a7282"), WHITE), 1);
    });
});

describe("over", () => {
    it("shows the layer beneath through a transparent top and hides it under an opaque one", () => {
        const red = parseColour("#ff0000");
        expect(over(red, 0, WHITE)).toEqual(WHITE);
        const opaque = over(red, 1, WHITE);
        for (let i = 0; i < 3; i++) {
            expect(opaque[i]).toBeCloseTo(red[i]!, 9);
        }
    });

    it("blends in encoded sRGB, so half black over white is the mid grey a browser paints", () => {
        // #808080 is what `bg-black/50` over white renders as.
        expect(luminance(over(BLACK, 0.5, WHITE))).toBeCloseTo(
            luminance(parseColour("#808080")),
            2,
        );
    });
});
