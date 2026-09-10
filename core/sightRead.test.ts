// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { levelAids } from "./readingLevel";
import {
    firstRead,
    normalizeSightRead,
    type SightReadRecord,
    sightReadAids,
    studyRemaining,
    reappearingSteps,
    vanishedSteps,
} from "./sightRead";

const read: SightReadRecord = { score: 78, letter: "B", atTempo: false, playedAt: 1_700_000_000 };

describe("sight-read aids", () => {
    it("reads without every aid the ladder can shed", () => {
        expect(sightReadAids()).toEqual(levelAids("sightReader"));
        expect(sightReadAids()).toEqual({
            noteLabels: "off",
            noteHints: "never",
            colorNotes: false,
            forgiving: false,
            highway: false,
            showFingerings: false,
        });
    });
});

describe("first read", () => {
    it("keeps the first read and ignores every later one", () => {
        const later: SightReadRecord = {
            score: 96,
            letter: "S",
            atTempo: true,
            playedAt: 1_800_000_000,
        };

        // A better second read is still a re-read of a piece already seen.
        expect(firstRead(read, later)).toBe(read);
        expect(firstRead(null, later)).toBe(later);
    });
});

describe("normalizeSightRead", () => {
    it("round-trips a stored record", () => {
        expect(normalizeSightRead(JSON.parse(JSON.stringify(read)))).toEqual(read);
    });

    it("reads a half-written or foreign value as nothing", () => {
        expect(normalizeSightRead(null)).toBeNull();
        expect(normalizeSightRead({ score: 70 })).toBeNull();
        expect(normalizeSightRead({ score: 70, letter: "B" })).toBeNull();
        expect(normalizeSightRead({ score: "70", letter: "B", playedAt: 1 })).toBeNull();
        expect(normalizeSightRead({ score: Number.NaN, letter: "B", playedAt: 1 })).toBeNull();
    });

    it("treats a missing tempo mark as self-paced rather than losing the record", () => {
        const parsed = normalizeSightRead({ score: 70, letter: "C", playedAt: 5 });

        expect(parsed).toEqual({ score: 70, letter: "C", atTempo: false, playedAt: 5 });
    });
});

describe("reappearingSteps", () => {
    // A | B C :| D with the repeat opening at B, two notes a bar: the run plays A B C B C D,
    // and both passes of B and C are steps over the same noteheads.
    const measures = [0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 3, 3];

    it("brings back every vanished bar from the one the repeat returns to", () => {
        // Reaching C hid A and B, B's second pass included, since it is the same
        // noteheads. The repeat then sends the run back to B (step 6).
        const gone = vanishedSteps(measures, 4);
        expect(gone).toEqual([0, 1, 2, 3, 6, 7]);
        // B comes back, both passes of it; A is still behind the run and stays gone.
        expect(reappearingSteps(measures, gone, 6)).toEqual([2, 3, 6, 7]);
    });

    it("brings back both passes of a bar that vanished once over", () => {
        // Deep into D, every earlier step is hidden, second-pass steps included.
        const gone = vanishedSteps(measures, 10);
        expect(reappearingSteps(measures, gone, 2)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("brings back the whole range when a loop over the opening laps", () => {
        const loop = [0, 0, 1, 1];
        expect(reappearingSteps(loop, vanishedSteps(loop, 2), 0)).toEqual([0, 1]);
    });

    it("brings back nothing when nothing had vanished, or the step is not there", () => {
        expect(reappearingSteps(measures, [], 2)).toEqual([]);
        expect(reappearingSteps(measures, [0, 1], 99)).toEqual([]);
    });
});

describe("vanishedSteps", () => {
    // Four bars of two notes each.
    const measures = [0, 0, 1, 1, 2, 2, 3, 3];

    it("keeps the bar being played and loses the ones behind it", () => {
        expect(vanishedSteps(measures, 0)).toEqual([]);
        expect(vanishedSteps(measures, 1)).toEqual([]);
        // First note of bar 1: bar 0 is behind us now.
        expect(vanishedSteps(measures, 2)).toEqual([0, 1]);
        expect(vanishedSteps(measures, 5)).toEqual([0, 1, 2, 3]);
        expect(vanishedSteps(measures, 7)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("vanishes a whole bar at once rather than note by note", () => {
        // Both notes of bar 1 go together when bar 2 starts — never one of them.
        expect(vanishedSteps(measures, 4)).toEqual([0, 1, 2, 3]);
    });

    it("hides nothing for a step that is not there", () => {
        expect(vanishedSteps(measures, 99)).toEqual([]);
        expect(vanishedSteps([], 0)).toEqual([]);
    });

    it("handles a piece whose steps do not start at bar zero", () => {
        // A run started partway through (a Listen takeover) begins mid-piece.
        expect(vanishedSteps([4, 4, 5], 2)).toEqual([0, 1]);
    });
});

describe("studyRemaining", () => {
    it("counts whole seconds down to zero and stops there", () => {
        expect(studyRemaining(0, 10)).toBe(10);
        expect(studyRemaining(1, 10)).toBe(10);
        expect(studyRemaining(1000, 10)).toBe(9);
        expect(studyRemaining(9500, 10)).toBe(1);
        expect(studyRemaining(10_000, 10)).toBe(0);
        expect(studyRemaining(99_000, 10)).toBe(0);
    });

    it("shows the full span for a clock that has not started or ran backwards", () => {
        expect(studyRemaining(-1, 5)).toBe(5);
        expect(studyRemaining(Number.NaN, 5)).toBe(5);
    });
});
