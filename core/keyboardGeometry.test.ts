// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isWhite, keyLane, whiteKeys } from "./keyboardGeometry";

describe("isWhite", () => {
    it("classifies the seven white pitch classes and the five black", () => {
        // C4..B4
        expect([60, 62, 64, 65, 67, 69, 71].every(isWhite)).toBe(true);
        expect([61, 63, 66, 68, 70].some(isWhite)).toBe(false);
    });
});

describe("whiteKeys", () => {
    it("lists the white keys in an octave in order", () => {
        expect(whiteKeys(60, 72)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    });
});

describe("keyLane", () => {
    it("tiles white keys in equal shares across the width", () => {
        // C4..B4 = 7 white keys, so each is 100/7% wide.
        const width = 100 / 7;
        expect(keyLane(60, 60, 71)).toEqual({ leftPct: 0, widthPct: width, white: true });
        expect(keyLane(62, 60, 71)).toEqual({ leftPct: width, widthPct: width, white: true });
        const b = keyLane(71, 60, 71)!;
        expect(b.leftPct).toBeCloseTo(6 * width);
        expect(b.widthPct).toBeCloseTo(width);
    });

    it("makes a black key 60% of a white and straddles the preceding gap", () => {
        const width = 100 / 7;
        // C#4 sits after one white (C4): left = 1*width - 0.3*width, width = 0.6*width.
        const lane = keyLane(61, 60, 71)!;
        expect(lane.white).toBe(false);
        expect(lane.widthPct).toBeCloseTo(width * 0.6);
        expect(lane.leftPct).toBeCloseTo(width - width * 0.3);
    });

    it("clamps a black key at the top edge into the keybed", () => {
        // A range ending on a black key must not hang it past 100%.
        const lane = keyLane(70, 60, 70)!;
        expect(lane.leftPct + lane.widthPct).toBeLessThanOrEqual(100 + 1e-9);
    });

    it("returns null outside the range", () => {
        expect(keyLane(59, 60, 71)).toBeNull();
        expect(keyLane(72, 60, 71)).toBeNull();
    });
});
