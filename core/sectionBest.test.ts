// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    bestTotal,
    improvedSections,
    mergeBest,
    normalizeBest,
    SECTIONS,
    sectionScores,
} from "./sectionBest";
import type { RunNote } from "./shareCard";

// A run of notes played exactly on time, so the sections score high and the shape of
// the maths is what is under test rather than the timing model.
const clean = (count: number): RunNote[] =>
    Array.from({ length: count }, (_, index) => ({
        targetMs: index * 500,
        playedMs: index * 500,
        wrongBefore: 0,
        staves: [0],
    }));

describe("sectionScores", () => {
    it("scores one number per section", () => {
        expect(sectionScores(clean(24))).toHaveLength(SECTIONS);
    });

    it("scores a clean reading high throughout", () => {
        for (const score of sectionScores(clean(24))) {
            expect(score).toBeGreaterThan(50);
        }
    });

    it("scores an unplayed section zero rather than leaving a hole", () => {
        // Fewer notes than sections: the sections nobody reached must read as zero,
        // so a later run can beat them.
        const scores = sectionScores(clean(2));

        expect(scores).toHaveLength(SECTIONS);
        expect(scores[SECTIONS - 1]).toBe(0);
    });
});

describe("mergeBest", () => {
    it("takes the better reading of each section", () => {
        const previous = [90, 40, 70, 0, 0, 0];
        const run = [50, 80, 70, 60, 0, 0];

        expect(mergeBest(previous, run)).toEqual([90, 80, 70, 60, 0, 0]);
    });

    it("makes a first run the record outright", () => {
        expect(mergeBest(null, [10, 20, 30, 40, 50, 60])).toEqual([10, 20, 30, 40, 50, 60]);
    });

    it("never shrinks — a worse run leaves the record alone", () => {
        const previous = [90, 90, 90, 90, 90, 90];

        expect(mergeBest(previous, [10, 10, 10, 10, 10, 10])).toEqual(previous);
    });

    it("keeps the record's shape whatever length the run is", () => {
        expect(mergeBest(null, [50])).toHaveLength(SECTIONS);
        expect(mergeBest(null, [1, 2, 3, 4, 5, 6, 7, 8, 9])).toHaveLength(SECTIONS);
    });
});

describe("bestTotal", () => {
    it("averages the sections", () => {
        expect(bestTotal([60, 60, 60, 60, 60, 60])).toBe(60);
        expect(bestTotal([100, 100, 100, 0, 0, 0])).toBe(50);
    });

    it("can only go up as runs accumulate", () => {
        let best: number[] | null = null;
        let last = 0;
        for (const run of [
            [50, 10, 0, 0, 0, 0],
            [10, 90, 0, 0, 0, 0],
            [20, 20, 80, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ]) {
            best = mergeBest(best, run);
            const total = bestTotal(best);
            expect(total).toBeGreaterThanOrEqual(last);
            last = total;
        }
        // Each section's best survived, including from the run that was worse overall.
        expect(best).toEqual([50, 90, 80, 0, 0, 0]);
    });

    it("reports nothing for an empty record without dividing by zero", () => {
        expect(bestTotal([])).toBe(0);
    });
});

describe("improvedSections", () => {
    it("names the sections this run beat", () => {
        expect(improvedSections([50, 50, 50, 0, 0, 0], [40, 60, 50, 10, 0, 0])).toEqual([1, 3]);
    });

    it("counts everything on a first run", () => {
        expect(improvedSections(null, [10, 0, 5, 0, 0, 0])).toEqual([0, 2]);
    });

    it("says nothing when a run beat none of them", () => {
        expect(improvedSections([90, 90, 90, 90, 90, 90], [10, 20, 30, 40, 50, 60])).toEqual([]);
    });
});

describe("normalizeBest", () => {
    it("keeps a stored record", () => {
        expect(normalizeBest([10, 20, 30, 40, 50, 60])).toEqual([10, 20, 30, 40, 50, 60]);
    });

    it("rebuilds a record of the wrong length rather than trusting it", () => {
        // A shorter record would otherwise drop sections; a longer one invent them.
        expect(normalizeBest([10, 20])).toEqual([10, 20, 0, 0, 0, 0]);
        expect(normalizeBest([1, 2, 3, 4, 5, 6, 7, 8])).toHaveLength(SECTIONS);
    });

    it("pulls impossible scores back into range", () => {
        expect(normalizeBest([-5, 500, Number.NaN, 50, 0, 0])).toEqual([0, 100, 0, 50, 0, 0]);
    });

    it("reads nothing-yet as nothing rather than a real zero", () => {
        expect(normalizeBest(null)).toBeNull();
        expect(normalizeBest("nope")).toBeNull();
        expect(normalizeBest([0, 0, 0, 0, 0, 0])).toBeNull();
    });
});
