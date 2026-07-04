// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Letter } from "./grade";

// Spaced-repetition state for one score: the best score so far, whether it is
// learned, whether it has been shelved to the backlog, and when it is next due
// for review. The interval expands on a passing review and resets on a failing
// one — the usual spaced-repetition shape.
export type Mastery = {
    bestScore: number;
    learned: boolean;
    backlog: boolean;
    intervalDays: number;
    reviewAt: number; // epoch ms; 0 when not scheduled
    updatedAt: number;
};

const DAY_MS = 86_400_000;
const FIRST_INTERVAL_DAYS = 1;
const GROWTH = 2.3;
const MAX_INTERVAL_DAYS = 180;

const EMPTY: Mastery = {
    bestScore: 0,
    learned: false,
    backlog: false,
    intervalDays: 0,
    reviewAt: 0,
    updatedAt: 0,
};

// Coerce a parsed (possibly legacy or corrupt) value into a complete Mastery.
// A missing or non-finite numeric field would otherwise flow into applyRun's
// interval growth as NaN, poisoning reviewAt and disabling the review schedule.
export function normalizeMastery(raw: unknown): Mastery {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const num = (field: unknown, fallback: number): number =>
        Number.isFinite(field) ? (field as number) : fallback;
    return {
        bestScore: num(value.bestScore, EMPTY.bestScore),
        learned: value.learned === true,
        backlog: value.backlog === true,
        intervalDays: num(value.intervalDays, EMPTY.intervalDays),
        reviewAt: num(value.reviewAt, EMPTY.reviewAt),
        updatedAt: num(value.updatedAt, EMPTY.updatedAt),
    };
}

// The lowest aggregate score that still earns the given letter (mirrors
// grade.letterFor), so a Settings letter threshold maps to a numeric cutoff.
export function letterMin(letter: Letter): number {
    switch (letter) {
        case "S":
            return 95;
        case "A":
            return 85;
        case "B":
            return 75;
        case "C":
            return 65;
        case "D":
            return 55;
        case "E":
            return 40;
        default:
            return 0;
    }
}

// Folds a finished run's score into the mastery state: always tracks the best
// score, marks a score learned the first time it clears the threshold, and on a
// later review grows the interval when it passes or resets it when it fails.
export function applyRun(
    current: Mastery | null,
    score: number,
    thresholdScore: number,
    now: number,
): Mastery {
    const base = current ?? EMPTY;
    const bestScore = Math.max(base.bestScore, score);
    const passed = score >= thresholdScore;

    if (!base.learned) {
        if (!passed) {
            return { ...base, bestScore, updatedAt: now };
        }
        return {
            ...base,
            bestScore,
            learned: true,
            intervalDays: FIRST_INTERVAL_DAYS,
            reviewAt: now + FIRST_INTERVAL_DAYS * DAY_MS,
            updatedAt: now,
        };
    }

    const intervalDays = passed
        ? Math.min(
              MAX_INTERVAL_DAYS,
              Math.max(FIRST_INTERVAL_DAYS, Math.round(base.intervalDays * GROWTH)),
          )
        : FIRST_INTERVAL_DAYS;
    return {
        ...base,
        bestScore,
        intervalDays,
        reviewAt: now + intervalDays * DAY_MS,
        updatedAt: now,
    };
}

// A learned, un-shelved score whose review time has arrived.
export function isDue(mastery: Mastery, now: number): boolean {
    return mastery.learned && !mastery.backlog && mastery.reviewAt > 0 && mastery.reviewAt <= now;
}

// One full review interval of slack past the due date before a neglected score is
// considered lapsed. The grace scales with maturity, so a long-known piece (wide
// interval) tolerates a long absence while a freshly-learned one lapses quickly.
const LAPSE_GRACE = 1;

// A learned score left unreviewed well past its due date — overdue by more than the
// grace above. Competitive grade-decay stops counting a lapsed score until it is
// refreshed; gentle decay ignores this. A lapsed score is always also `isDue`.
export function isLapsed(mastery: Mastery, now: number): boolean {
    return (
        mastery.learned &&
        !mastery.backlog &&
        mastery.reviewAt > 0 &&
        now > mastery.reviewAt + LAPSE_GRACE * mastery.intervalDays * DAY_MS
    );
}

export function markLearned(current: Mastery | null, now: number): Mastery {
    const base = current ?? EMPTY;
    return {
        ...base,
        learned: true,
        backlog: false,
        intervalDays: base.intervalDays || FIRST_INTERVAL_DAYS,
        reviewAt: base.reviewAt || now + FIRST_INTERVAL_DAYS * DAY_MS,
        updatedAt: now,
    };
}

export function setBacklog(current: Mastery | null, backlog: boolean, now: number): Mastery {
    const base = current ?? EMPTY;
    return { ...base, backlog, updatedAt: now };
}
