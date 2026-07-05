// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    applyRun,
    isDue,
    isLapsed,
    letterMin,
    markLearned,
    type Mastery,
    normalizeMastery,
    setBacklog,
    unmarkLearned,
} from "./mastery";

const NOW = 1_000_000_000_000;
const DAY = 86_400_000;

const learned = (overrides: Partial<Mastery> = {}): Mastery => ({
    bestScore: 80,
    learned: true,
    backlog: false,
    intervalDays: 10,
    reviewAt: NOW - DAY,
    updatedAt: NOW,
    ...overrides,
});

describe("isLapsed", () => {
    it("is true once overdue by more than one review interval", () => {
        // Interval 10 days, due 20 days ago: overdue 20 > grace 10.
        expect(isLapsed(learned({ intervalDays: 10, reviewAt: NOW - 20 * DAY }), NOW)).toBe(true);
    });

    it("is false within the grace, even when already due", () => {
        const recentlyDue = learned({ intervalDays: 10, reviewAt: NOW - 2 * DAY });
        expect(isDue(recentlyDue, NOW)).toBe(true);
        expect(isLapsed(recentlyDue, NOW)).toBe(false);
    });

    it("grants more slack to a long-known piece than a fresh one", () => {
        // Same 6-day absence: lapses a 1-day-interval piece, spares a 30-day one.
        const sixDaysOverdue = (intervalDays: number) =>
            isLapsed(learned({ intervalDays, reviewAt: NOW - 6 * DAY }), NOW);
        expect(sixDaysOverdue(1)).toBe(true);
        expect(sixDaysOverdue(30)).toBe(false);
    });

    it("is false for an unlearned or shelved piece", () => {
        expect(isLapsed(learned({ learned: false, reviewAt: NOW - 99 * DAY }), NOW)).toBe(false);
        expect(isLapsed(learned({ backlog: true, reviewAt: NOW - 99 * DAY }), NOW)).toBe(false);
    });
});

describe("letterMin", () => {
    it("maps a letter to the lowest score that earns it", () => {
        expect(letterMin("S")).toBe(95);
        expect(letterMin("A")).toBe(85);
        expect(letterMin("D")).toBe(55);
        expect(letterMin("F")).toBe(0);
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

describe("normalizeMastery", () => {
    it("repairs a legacy entry missing intervalDays so reviews stay finite", () => {
        // A learned entry from an older schema without intervalDays would drive
        // applyRun's interval growth to NaN, poisoning reviewAt.
        const loaded = normalizeMastery({
            bestScore: 90,
            learned: true,
            backlog: false,
            reviewAt: NOW,
        });
        expect(loaded.intervalDays).toBe(0);
        const next = applyRun(loaded, 90, 85, NOW + DAY);
        expect(Number.isFinite(next.intervalDays)).toBe(true);
        expect(Number.isFinite(next.reviewAt)).toBe(true);
        expect(next.intervalDays).toBeGreaterThanOrEqual(1);
    });
});

describe("markLearned", () => {
    it("marks an unlearned score learned and schedules it", () => {
        const next = markLearned(null, NOW);
        expect(next.learned).toBe(true);
        expect(next.reviewAt).toBe(NOW + DAY);
    });
});

describe("unmarkLearned", () => {
    it("clears the learned flag and its review schedule but keeps the best score", () => {
        const before = learned({ bestScore: 88, intervalDays: 12, reviewAt: NOW + 12 * DAY });
        const next = unmarkLearned(before, NOW);
        expect(next.learned).toBe(false);
        expect(next.reviewAt).toBe(0);
        expect(next.intervalDays).toBe(0);
        expect(next.bestScore).toBe(88);
        expect(isDue(next, NOW + 100 * DAY)).toBe(false);
    });

    it("is a safe no-op shape on a missing mastery", () => {
        const next = unmarkLearned(null, NOW);
        expect(next.learned).toBe(false);
        expect(next.updatedAt).toBe(NOW);
    });
});
