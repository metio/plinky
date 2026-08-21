// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { octaveShiftAt } from "./octaveShift";

const SPANS = [{ from: 1, to: 2, semitones: 12 }];

describe("where the score prints an octave line", () => {
    it("shifts from where the line opens up to where it closes", () => {
        // The closing bracket is written after the last note under the line, so a note at
        // that moment is the first one outside it — the same rule the pedal follows.
        expect(octaveShiftAt(SPANS, 1)).toBe(12);
        expect(octaveShiftAt(SPANS, 1.5)).toBe(12);
        expect(octaveShiftAt(SPANS, 1.999)).toBe(12);
        expect(octaveShiftAt(SPANS, 2)).toBe(0);
    });

    it("leaves everything outside the line where it is written", () => {
        expect(octaveShiftAt(SPANS, 0.9)).toBe(0);
        expect(octaveShiftAt(SPANS, 2.1)).toBe(0);
        expect(octaveShiftAt([], 1)).toBe(0);
    });

    it("carries whatever distance the line asks for", () => {
        expect(octaveShiftAt([{ from: 0, to: 1, semitones: -12 }], 0.5)).toBe(-12);
        expect(octaveShiftAt([{ from: 0, to: 1, semitones: 24 }], 0.5)).toBe(24);
    });

    it("tolerates an onset that rounding moved by a hair", () => {
        expect(octaveShiftAt(SPANS, 1 - 1e-9)).toBe(12);
        expect(octaveShiftAt(SPANS, 2 - 1e-9)).toBe(0);
    });

    it("takes the first line covering a position when two overlap", () => {
        // Overlapping octave lines are not music anybody writes, but an engraving can hold
        // them; answering with one of them beats answering with their sum.
        const overlapping = [
            { from: 0, to: 4, semitones: 12 },
            { from: 1, to: 2, semitones: 24 },
        ];
        expect(octaveShiftAt(overlapping, 1.5)).toBe(12);
    });
});
