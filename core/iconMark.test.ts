// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { whiteBands, wordBand, wordlessMark } from "./iconMark";

const W = 120;
const H = 200;

// A stand-in for the mark: an opaque violet tile with white content in given row ranges,
// each spanning enough of the width to count as a band. The real artwork's exact shape is
// not what these assert — what they assert is that the bands are FOUND and that the tile
// survives, which is what a redrawn mark would break.
function tile(bands: readonly [number, number][]): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const white = bands.some(([top, bottom]) => y >= top && y <= bottom) && x > 20 && x < 100;
            rgba[i] = white ? 255 : 60;
            rgba[i + 1] = white ? 255 : 20;
            rgba[i + 2] = white ? 255 : 200;
            rgba[i + 3] = 255;
        }
    }
    return rgba;
}

const pixel = (rgba: Uint8ClampedArray, x: number, y: number) => [
    rgba[(y * W + x) * 4],
    rgba[(y * W + x) * 4 + 1],
    rgba[(y * W + x) * 4 + 2],
    rgba[(y * W + x) * 4 + 3],
];
const isWhite = (rgba: Uint8ClampedArray, x: number, y: number) =>
    pixel(rgba, x, y)
        .slice(0, 3)
        .every((c) => (c as number) > 200);

describe("finding the bands of a lockup", () => {
    it("separates content that sits apart", () => {
        expect(whiteBands(tile([[20, 60], [120, 160]]), W, H)).toEqual([
            { top: 20, bottom: 60 },
            { top: 120, bottom: 160 },
        ]);
    });

    it("keeps content broken by a short gap as one band", () => {
        // The gaps inside a word's own letters are far shorter than the gap above it, which
        // is what lets one threshold tell a line of type from the picture over it.
        expect(whiteBands(tile([[20, 40], [45, 60]]), W, H)).toEqual([{ top: 20, bottom: 60 }]);
    });

    it("ignores a scattering too thin to be content", () => {
        const rgba = tile([]);
        for (let x = 0; x < 2; x++) {
            const i = (100 * W + x) * 4;
            rgba[i] = 255;
            rgba[i + 1] = 255;
            rgba[i + 2] = 255;
        }
        expect(whiteBands(rgba, W, H)).toEqual([]);
    });
});

describe("which band is the word", () => {
    it("is the last one, when something sits above it", () => {
        expect(wordBand([{ top: 10, bottom: 20 }, { top: 60, bottom: 80 }])).toEqual({
            top: 60,
            bottom: 80,
        });
    });

    it("is nothing at all when the artwork carries a single band", () => {
        // A mark that is only a picture has no name to take out, and treating its one band
        // as a wordmark would erase the artwork's only content.
        expect(wordBand([{ top: 10, bottom: 20 }])).toBeNull();
        expect(wordBand([])).toBeNull();
    });
});

describe("taking the name out of the mark", () => {
    const KEYS: [number, number] = [30, 90];
    const WORD: [number, number] = [130, 170];

    it("removes the word and leaves the picture", () => {
        const out = wordlessMark(tile([KEYS, WORD]), W, H);
        expect(whiteBands(out, W, H)).toHaveLength(1);
        expect(isWhite(out, 60, 150)).toBe(false);
    });

    it("centres what is left", () => {
        const out = wordlessMark(tile([KEYS, WORD]), W, H);
        const [band] = whiteBands(out, W, H);
        const middle = ((band?.top ?? 0) + (band?.bottom ?? 0)) / 2;
        // The picture sat high to leave the word room; with the word gone it belongs on the
        // tile's own centre line.
        expect(Math.abs(middle - H / 2)).toBeLessThanOrEqual(2);
    });

    it("keeps the artwork's own silhouette, pixel for pixel", () => {
        const rgba = tile([KEYS, WORD]);
        // A transparent corner, as the real tile's rounded edge gives it.
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                rgba[(y * W + x) * 4 + 3] = 0;
            }
        }
        const out = wordlessMark(rgba, W, H);
        for (let at = 3; at < rgba.length; at += 4) {
            expect(out[at]).toBe(rgba[at]);
        }
    });

    it("paints the tile's ground where the word was, not a hole", () => {
        const out = wordlessMark(tile([KEYS, WORD]), W, H);
        const [r, g, b, a] = pixel(out, 60, 150);
        expect([r, g, b]).toEqual([60, 20, 200]);
        expect(a).toBe(255);
    });

    it("refuses artwork that carries no word", () => {
        expect(() => wordlessMark(tile([KEYS]), W, H)).toThrow(/no wordmark/);
    });

    it("leaves the input untouched", () => {
        const rgba = tile([KEYS, WORD]);
        const before = Uint8ClampedArray.from(rgba);
        wordlessMark(rgba, W, H);
        expect(rgba).toEqual(before);
    });
});
