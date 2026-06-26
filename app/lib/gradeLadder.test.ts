// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { recordPractice } from "./history";
import { markLearned, saveMastery } from "./mastery";
import {
    type LadderProgress,
    levelFor,
    MAX_LEVEL,
    measureProgress,
    nextLevel,
} from "./gradeLadder";

afterEach(() => localStorage.clear());

const progress = (over: Partial<LadderProgress> = {}): LadderProgress => ({
    scales: 0,
    arpeggios: 0,
    pieces: 0,
    days: 0,
    ...over,
});

describe("gradeLadder", () => {
    it("starts at grade 0 and reaches 1 on the first day", () => {
        expect(levelFor(progress())).toBe(0);
        expect(levelFor(progress({ days: 1 }))).toBe(1);
    });

    it("climbs as scales and arpeggios are learned", () => {
        expect(levelFor(progress({ days: 1, scales: 3 }))).toBe(3);
        expect(levelFor(progress({ days: 1, scales: 5, arpeggios: 1 }))).toBe(4);
    });

    it("caps at the first unmet requirement even with progress above it", () => {
        // Plenty of pieces but no scales: stuck at grade 1 (the scale foundation gates).
        expect(levelFor(progress({ days: 1, pieces: 10 }))).toBe(1);
    });

    it("reaches the top grade and then reports no next level", () => {
        const maxed = progress({ days: 1, scales: 15, arpeggios: 15, pieces: 3 });
        expect(levelFor(maxed)).toBe(MAX_LEVEL);
        expect(nextLevel(maxed)).toBeNull();
    });

    it("reports the next grade's requirement", () => {
        expect(nextLevel(progress({ days: 1 }))).toEqual({ level: 2, requirement: { scales: 1 } });
    });

    it("measures progress from learned mastery and practice history", () => {
        const now = Date.now();
        saveMastery("scale-c-major", markLearned(null, now));
        saveMastery("arpeggio-g-major", markLearned(null, now));
        saveMastery("ode-to-joy", markLearned(null, now));
        recordPractice(10);
        expect(measureProgress()).toEqual({ scales: 1, arpeggios: 1, pieces: 1, days: 1 });
    });
});
