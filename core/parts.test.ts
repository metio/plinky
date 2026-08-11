// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { GRAND_STAFF, isPlayedStaff, partsOf } from "./parts";

describe("partsOf", () => {
    it("reads a plain grand staff as staves 0 and 1", () => {
        expect(partsOf([2])).toEqual({ right: 0, left: 1, other: [] });
    });

    it("finds the piano under a vocal line", () => {
        // Voice on one staff then piano on two — 89% of the catalogue's multi-part
        // scores. The engraver numbers staves across the whole sheet, so the piano's
        // right hand is staff 1 here, not staff 0.
        expect(partsOf([1, 2])).toEqual({ right: 1, left: 2, other: [0] });
    });

    it("finds it under several other lines", () => {
        expect(partsOf([1, 1, 2])).toEqual({ right: 2, left: 3, other: [0, 1] });
        expect(partsOf([1, 1, 1, 1, 2])).toEqual({ right: 4, left: 5, other: [0, 1, 2, 3] });
    });

    it("takes the last two-staff part when there are several", () => {
        // A duet for two pianos: the second is as good a choice as the first, and being
        // predictable matters more than being clever.
        expect(partsOf([2, 2])).toEqual({ right: 2, left: 3, other: [0, 1] });
    });

    it("falls back to the last part when nothing has two staves", () => {
        expect(partsOf([1, 1])).toEqual({ right: 1, left: 2, other: [0] });
    });

    it("reads a single-staff score the way it always did", () => {
        // Everything is staff 0, and `left` names a staff that does not exist — so
        // hands-separate practice of the left hand finds nothing, which is honest.
        expect(partsOf([1])).toEqual({ right: 0, left: 1, other: [] });
    });

    it("survives a score that reports nothing usable", () => {
        expect(partsOf([])).toEqual(GRAND_STAFF);
        expect(partsOf([0, -1])).toEqual(GRAND_STAFF);
    });

    it("never puts a staff in two places at once", () => {
        for (const shape of [[2], [1, 2], [1, 1, 2], [2, 2], [1], [3, 2], [1, 1, 1, 1, 2]]) {
            const parts = partsOf(shape);
            expect(parts.other).not.toContain(parts.right);
            expect(parts.other).not.toContain(parts.left);
            expect(new Set(parts.other).size).toBe(parts.other.length);
        }
    });

    it("accounts for every staff the score has", () => {
        for (const shape of [[2], [1, 2], [1, 1, 2], [2, 2], [3, 2]]) {
            const total = shape.reduce((sum, count) => sum + count, 0);
            const parts = partsOf(shape);
            const named = new Set([parts.right, parts.left, ...parts.other]);
            for (let staff = 0; staff < total; staff++) {
                expect(named.has(staff)).toBe(true);
            }
        }
    });
});

describe("isPlayedStaff", () => {
    it("owns the practised instrument's staves and nothing else", () => {
        const parts = partsOf([1, 2]);
        expect(isPlayedStaff(1, parts)).toBe(true);
        expect(isPlayedStaff(2, parts)).toBe(true);
        // The singer's line is the score's, not the player's.
        expect(isPlayedStaff(0, parts)).toBe(false);
        expect(isPlayedStaff(undefined, parts)).toBe(false);
    });
});
