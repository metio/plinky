// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { flattenedBackground, maskedShare, grownBy, insideEdgeOf, narrowedAbove } from "./matte";

// A tiny image builder: `draw(x, y)` returns the colour of each pixel.
const image = (width: number, height: number, draw: (x: number, y: number) => number[]) => {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = draw(x, y);
            const at = (y * width + x) * 4;
            rgba[at] = r as number;
            rgba[at + 1] = g as number;
            rgba[at + 2] = b as number;
            rgba[at + 3] = 255;
        }
    }
    return rgba;
};
const WHITE = [255, 255, 255];
const VIOLET = [73, 21, 210];
const at = (mask: Uint8Array, width: number, x: number, y: number) => mask[y * width + x];

describe("flattenedBackground", () => {
    it("takes the background a shape was flattened onto", () => {
        // A violet blob in the middle of a white field: the field goes, the blob stays.
        const inBlob = (x: number, y: number) => x >= 2 && x <= 5 && y >= 2 && y <= 5;
        const mask = flattenedBackground(
            image(8, 8, (x, y) => (inBlob(x, y) ? VIOLET : WHITE)),
            8,
            8,
        );
        expect(at(mask, 8, 0, 0)).toBe(1);
        expect(at(mask, 8, 7, 7)).toBe(1);
        expect(at(mask, 8, 3, 3)).toBe(0);
    });

    it("leaves a white region that the shape encloses", () => {
        // THE reason this floods rather than keying every white pixel. The mark's piano keys
        // and its wordmark are white; keying by colour alone would erase them and leave a
        // violet frame with holes in it.
        const ring = (x: number, y: number) => x >= 1 && x <= 6 && y >= 1 && y <= 6;
        const hole = (x: number, y: number) => x >= 3 && x <= 4 && y >= 3 && y <= 4;
        const mask = flattenedBackground(
            image(8, 8, (x, y) => (hole(x, y) ? WHITE : ring(x, y) ? VIOLET : WHITE)),
            8,
            8,
        );
        expect(at(mask, 8, 0, 0)).toBe(1); // outside, taken
        expect(at(mask, 8, 3, 3)).toBe(0); // enclosed, kept
        expect(at(mask, 8, 4, 4)).toBe(0);
    });

    it("swallows the antialiased edge, which is what the halo is made of", () => {
        // A shape's edge is blended against its old background, so those pixels are nearly
        // that background. Left behind they read as a bright fringe on any other ground.
        const mask = flattenedBackground(image(4, 1, (x) => (x < 2 ? WHITE : [238, 236, 246])), 4, 1);
        expect(at(mask, 4, 0, 0)).toBe(1);
        expect(at(mask, 4, 2, 0)).toBe(1);
    });

    it("takes nothing from artwork that already bleeds to every edge", () => {
        // A full-bleed image has no background to find, and inventing one would punch a hole
        // in the picture.
        const mask = flattenedBackground(image(6, 6, () => VIOLET), 6, 6);
        expect(maskedShare(mask)).toBe(0);
    });

    it("takes nothing from a shape that only touches one corner", () => {
        // Connectivity again: white reached from a corner goes, white cut off from every
        // corner stays, whatever it looks like.
        const mask = flattenedBackground(
            image(5, 5, (x, y) => (x === 4 && y === 4 ? WHITE : VIOLET)),
            5,
            5,
        );
        expect(at(mask, 5, 4, 4)).toBe(1);
        expect(maskedShare(mask)).toBeCloseTo(1 / 25);
    });

    it("floods a background that wraps around the shape", () => {
        // A million-pixel background is deeper than the call stack allows, so the walk keeps
        // its own. This is the shape of the case that would blow it.
        const mask = flattenedBackground(
            image(200, 200, (x, y) => (y === 100 && x > 0 && x < 199 ? VIOLET : WHITE)),
            200,
            200,
        );
        expect(at(mask, 200, 0, 0)).toBe(1);
        expect(at(mask, 200, 199, 199)).toBe(1);
        expect(at(mask, 200, 100, 100)).toBe(0);
        expect(maskedShare(mask)).toBeGreaterThan(0.9);
    });

    it("can be told where to start when the artwork bleeds off one edge", () => {
        const rgba = image(4, 2, (x, y) => (y === 0 ? VIOLET : WHITE));
        expect(maskedShare(flattenedBackground(rgba, 4, 2, { seeds: [4] }))).toBeCloseTo(0.5);
    });

    it("has an answer for an image with no pixels", () => {
        expect(flattenedBackground(new Uint8ClampedArray(0), 0, 0)).toEqual(new Uint8Array(0));
        expect(maskedShare(new Uint8Array(0))).toBe(0);
    });
});

describe("the seeds a caller supplies", () => {
    it("survive the flood, so the same seeds can be used twice", () => {
        // The flood pops its stack empty as it runs. Taking the caller's array as that
        // stack hands it back drained, and the second use of the same seeds silently floods
        // nothing — which reads as "there was no background there" rather than as a fault.
        const width = 4;
        const height = 4;
        const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
        const seeds = [0];
        const first = flattenedBackground(rgba, width, height, { seeds });
        expect(seeds).toEqual([0]);
        const second = flattenedBackground(rgba, width, height, { seeds });
        expect(second).toEqual(first);
    });
});

describe("the ring where two grounds meet", () => {
    const width = 7;
    const height = 7;
    // A mask holding the outer frame only, as a corner flood over a bordered picture gives.
    const frame = () => {
        const mask = new Uint8Array(width * height);
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++)
                if (x === 0 || y === 0 || x === width - 1 || y === height - 1)
                    mask[y * width + x] = 1;
        return mask;
    };

    it("names the pixels just inside the mask, which is where a second pass must start", () => {
        const seeds = insideEdgeOf(frame(), width, height);
        // The ring one step in — and never a pixel the mask already holds, which would
        // fail the new rule and stop the flood dead.
        expect(seeds.length).toBeGreaterThan(0);
        expect(seeds.every((pixel) => frame()[pixel] === 0)).toBe(true);
        const xs = seeds.map((pixel) => pixel % width);
        const ys = seeds.map((pixel) => (pixel / width) | 0);
        expect(Math.min(...xs)).toBe(1);
        expect(Math.max(...xs)).toBe(width - 2);
        expect(Math.min(...ys)).toBe(1);
        expect(Math.max(...ys)).toBe(height - 2);
    });

    it("grows a mask by whole pixels, and leaves it alone when asked for none", () => {
        const before = frame();
        expect(grownBy(before, width, height, 0)).toEqual(before);
        const grown = grownBy(before, width, height, 1);
        // The frame swallows the next ring in; the very centre is still untouched.
        expect(grown[1 * width + 1]).toBe(1);
        expect(grown[3 * width + 3]).toBe(0);
    });

    it("does not touch the mask it was given", () => {
        const before = frame();
        const copy = Uint8Array.from(before);
        grownBy(before, width, height, 2);
        expect(before).toEqual(copy);
    });
});

describe("a glow with nothing left to glow against", () => {
    const width = 21;
    const height = 10;
    const KEYS_TOP = 6;
    // A violet halo filling the top, with a white dot in it and a narrow line down the
    // middle — the falling note as the artwork draws it, once its ground has gone.
    const rgba = image(width, height, (x, y) =>
        y < KEYS_TOP
            ? x === 10 && y === 1
                ? [255, 255, 255]
                : [90, 40, 200]
            : [255, 255, 255],
    );

    it("keeps the line and the note, and takes the halo around them", () => {
        const trimmed = narrowedAbove(new Uint8Array(width * height), rgba, width, height, {
            above: KEYS_TOP,
            centreX: 10,
            half: 1,
        });
        const kept = (x: number, y: number) => trimmed[y * width + x] === 0;
        expect(kept(10, 3)).toBe(true);
        expect(kept(9, 3)).toBe(true);
        expect(kept(10, 1)).toBe(true);
        // …and the halo either side of it is gone.
        expect(kept(4, 3)).toBe(false);
        expect(kept(17, 3)).toBe(false);
    });

    it("leaves everything below the given row alone", () => {
        const trimmed = narrowedAbove(new Uint8Array(width * height), rgba, width, height, {
            above: KEYS_TOP,
            centreX: 10,
            half: 1,
        });
        for (let x = 0; x < width; x++) {
            expect(trimmed[(height - 1) * width + x]).toBe(0);
        }
    });
});
