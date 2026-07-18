// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { beginHold, holdFraction, holdFractionsByNote, pruneHolds } from "./holds";

describe("beginHold", () => {
    it("adds a hold ending one duration after the strike", () => {
        const holds = beginHold([], 60, 1000, 500);
        expect(holds).toEqual([{ note: 60, startMs: 1000, endMs: 1500 }]);
    });

    it("replaces a note's running hold rather than stacking a second", () => {
        const holds = beginHold(beginHold([], 60, 1000, 500), 60, 1200, 800);
        expect(holds).toEqual([{ note: 60, startMs: 1200, endMs: 2000 }]);
    });

    it("keeps holds for other notes when one re-arms", () => {
        const holds = beginHold(beginHold([], 60, 0, 500), 64, 100, 500);
        expect(holds.map((hold) => hold.note).sort()).toEqual([60, 64]);
    });

    it("treats a non-positive duration as an already-elapsed hold", () => {
        const holds = beginHold([], 60, 1000, 0);
        expect(holds[0]!.endMs).toBe(1000);
        expect(pruneHolds(holds, 1000)).toEqual([]);
    });
});

describe("pruneHolds", () => {
    it("drops holds whose release time has passed", () => {
        const holds = [
            { note: 60, startMs: 0, endMs: 500 },
            { note: 64, startMs: 0, endMs: 1500 },
        ];
        expect(pruneHolds(holds, 1000)).toEqual([{ note: 64, startMs: 0, endMs: 1500 }]);
    });
});

describe("holdFraction", () => {
    it("runs from 1 at the strike to 0 at the release", () => {
        const hold = { note: 60, startMs: 1000, endMs: 2000 };
        expect(holdFraction(hold, 1000)).toBe(1);
        expect(holdFraction(hold, 1500)).toBeCloseTo(0.5);
        expect(holdFraction(hold, 2000)).toBe(0);
    });

    it("clamps a time outside the span rather than overshooting", () => {
        const hold = { note: 60, startMs: 1000, endMs: 2000 };
        expect(holdFraction(hold, 500)).toBe(1);
        expect(holdFraction(hold, 3000)).toBe(0);
    });

    it("is zero for a zero-length hold", () => {
        expect(holdFraction({ note: 60, startMs: 1000, endMs: 1000 }, 1000)).toBe(0);
    });
});

describe("holdFractionsByNote", () => {
    it("maps each live note to its remaining fraction and omits emptied ones", () => {
        const holds = [
            { note: 60, startMs: 0, endMs: 1000 },
            { note: 64, startMs: 0, endMs: 500 },
        ];
        const fractions = holdFractionsByNote(holds, 500);
        expect(fractions.get(60)).toBeCloseTo(0.5);
        expect(fractions.has(64)).toBe(false);
    });

    it("keeps the fresher hold when a note re-armed", () => {
        const holds = [
            { note: 60, startMs: 0, endMs: 1000 },
            { note: 60, startMs: 900, endMs: 1900 },
        ];
        expect(holdFractionsByNote(holds, 1000).get(60)).toBeCloseTo(0.9);
    });
});
