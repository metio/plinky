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

const PREFIX = "plinky:mastery:";
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

function storageKey(id: string): string {
    return `${PREFIX}${id}`;
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
            return 70;
        case "C":
            return 50;
        default:
            return 0;
    }
}

export function loadMastery(id: string): Mastery | null {
    if (typeof localStorage === "undefined") {
        return null;
    }
    try {
        const raw = localStorage.getItem(storageKey(id));
        return raw ? (JSON.parse(raw) as Mastery) : null;
    } catch {
        return null;
    }
}

export function saveMastery(id: string, mastery: Mastery): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(storageKey(id), JSON.stringify(mastery));
    } catch {
        // Ignore quota or serialization failures — mastery is best-effort.
    }
}

export function loadAllMastery(): Array<{ id: string; mastery: Mastery }> {
    if (typeof localStorage === "undefined") {
        return [];
    }
    const out: Array<{ id: string; mastery: Mastery }> = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(PREFIX)) {
            continue;
        }
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                out.push({ id: key.slice(PREFIX.length), mastery: JSON.parse(raw) as Mastery });
            }
        } catch {
            // Skip a corrupt entry rather than failing the whole list.
        }
    }
    return out;
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
