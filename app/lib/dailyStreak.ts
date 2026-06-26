// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A Wordle-style streak of consecutive days the daily challenge was completed.
// Daily numbers are one-per-day and run sequentially, so consecutive numbers are
// consecutive days and a gap means a missed day. This is distinct from the
// practice-day streak in history.ts (which counts any practice) — it counts only
// the daily, the thing players share.

const KEY = "plinky:daily-streak";

export type DailyStreak = { last: number; streak: number; best: number };

const EMPTY: DailyStreak = { last: 0, streak: 0, best: 0 };

function clean(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function load(): DailyStreak {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        return { last: clean(value.last), streak: clean(value.streak), best: clean(value.best) };
    } catch {
        return { ...EMPTY };
    }
}

function save(state: DailyStreak): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // Streak persistence is best-effort.
    }
}

// Record completing daily #number: the day right after the last extends the
// streak, a larger gap restarts it at one, and a number already counted is a
// no-op — replaying the same day can't inflate the streak.
export function recordDailyDone(number: number): DailyStreak {
    const prev = load();
    if (number <= prev.last) {
        return prev;
    }
    const streak = number === prev.last + 1 ? prev.streak + 1 : 1;
    const next: DailyStreak = { last: number, streak, best: Math.max(prev.best, streak) };
    save(next);
    return next;
}

// The streak still alive at today's daily number: it counts while the last
// completed daily is today's or yesterday's (today not yet played, but no full day
// missed); once a whole day lapses it reads as zero.
export function currentDailyStreak(todayNumber: number): number {
    const { last, streak } = load();
    return last === todayNumber || last === todayNumber - 1 ? streak : 0;
}

export function loadDailyStreak(): DailyStreak {
    return load();
}
