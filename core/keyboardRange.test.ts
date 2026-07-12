// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DEFAULT_KEY_RANGE, songKeyRange } from "./keyboardRange";

const isWhite = (note: number) => [0, 2, 4, 5, 7, 9, 11].includes(((note % 12) + 12) % 12);

describe("songKeyRange", () => {
    it("falls back to two octaves for a piece with no notes", () => {
        expect(songKeyRange([])).toEqual(DEFAULT_KEY_RANGE);
    });

    it("frames a narrow tune far tighter than the two-octave default", () => {
        // Twinkle, Twinkle's melody: C4 up to A4, a major sixth.
        const range = songKeyRange([60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60]);
        // Much shorter than the 60–84 default…
        expect(range.to - range.from).toBeLessThan(24);
        // …while still containing every note played, with a little room.
        expect(range.from).toBeLessThanOrEqual(60);
        expect(range.to).toBeGreaterThanOrEqual(69);
    });

    it("starts and ends on white keys, so the keybed never looks cut", () => {
        // A range whose padded edges would land on black keys.
        const range = songKeyRange([61, 66]); // C#4 .. F#4
        expect(isWhite(range.from)).toBe(true);
        expect(isWhite(range.to)).toBe(true);
    });

    it("keeps at least an octave for a tiny drill", () => {
        const range = songKeyRange([60, 62]); // just C4 and D4
        expect(range.to - range.from).toBeGreaterThanOrEqual(12);
        expect(range.from).toBeLessThanOrEqual(60);
        expect(range.to).toBeGreaterThanOrEqual(62);
    });

    it("spans a wide piece across its whole reach", () => {
        const range = songKeyRange([36, 96]); // C2 .. C7
        expect(range.from).toBeLessThanOrEqual(36);
        expect(range.to).toBeGreaterThanOrEqual(96);
    });

    it("clamps to the 88-key piano at the extremes", () => {
        const range = songKeyRange([21, 108]); // A0 .. C8
        expect(range.from).toBeGreaterThanOrEqual(21);
        expect(range.to).toBeLessThanOrEqual(108);
    });
});
