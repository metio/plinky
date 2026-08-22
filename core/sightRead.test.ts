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
