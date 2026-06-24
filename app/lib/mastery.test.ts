// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { applyRun, isDue, letterMin, markLearned, type Mastery, setBacklog } from "./mastery";

const NOW = 1_000_000_000_000;
const DAY = 86_400_000;

describe("letterMin", () => {
    it("maps a letter to the lowest score that earns it", () => {
        expect(letterMin("S")).toBe(95);
        expect(letterMin("A")).toBe(85);
        expect(letterMin("D")).toBe(0);
    });
});

describe("applyRun", () => {
    it("learns and schedules a first review when a fresh score clears the threshold", () => {
        const next = applyRun(null, 90, 85, NOW);
        expect(next.learned).toBe(true);
        expect(next.intervalDays).toBe(1);
        expect(next.reviewAt).toBe(NOW + DAY);
        expect(next.bestScore).toBe(90);
    });

    it("does not learn a score below the threshold but still tracks the best", () => {
        const next = applyRun(null, 70, 85, NOW);
        expect(next.learned).toBe(false);
        expect(next.reviewAt).toBe(0);
        expect(next.bestScore).toBe(70);
    });

    it("grows the interval on a passing review", () => {
        const learned: Mastery = {
            bestScore: 90,
            learned: true,
            backlog: false,
            intervalDays: 1,
            reviewAt: NOW,
            updatedAt: NOW,
        };
        const next = applyRun(learned, 90, 85, NOW + DAY);
        expect(next.intervalDays).toBeGreaterThan(1);
        expect(next.reviewAt).toBe(NOW + DAY + next.intervalDays * DAY);
    });

    it("resets the interval on a failing review", () => {
        const learned: Mastery = {
            bestScore: 95,
            learned: true,
            backlog: false,
            intervalDays: 30,
            reviewAt: NOW,
            updatedAt: NOW,
        };
        const next = applyRun(learned, 60, 85, NOW + DAY);
        expect(next.intervalDays).toBe(1);
        expect(next.bestScore).toBe(95);
    });
});

describe("isDue", () => {
    const learned: Mastery = {
        bestScore: 90,
        learned: true,
        backlog: false,
        intervalDays: 1,
        reviewAt: NOW,
        updatedAt: NOW,
    };

    it("is due once the review time has passed", () => {
        expect(isDue(learned, NOW + 1)).toBe(true);
        expect(isDue(learned, NOW - 1)).toBe(false);
    });

    it("is never due while shelved to the backlog", () => {
        expect(isDue(setBacklog(learned, true, NOW), NOW + DAY)).toBe(false);
    });

    it("is never due for an unlearned score", () => {
        expect(isDue(applyRun(null, 50, 85, NOW), NOW + DAY)).toBe(false);
    });
});

describe("markLearned", () => {
    it("marks an unlearned score learned and schedules it", () => {
        const next = markLearned(null, NOW);
        expect(next.learned).toBe(true);
        expect(next.reviewAt).toBe(NOW + DAY);
    });
});
