// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Remembers the most recent daily challenge a player has completed — enough to show
// a ✓ on today's daily and to mark the onboarding step done. Deliberately NOT a
// streak: Plinky doesn't count consecutive days or punish a missed one, so there is
// no pressure to return every day to "keep" anything.

const KEY = "plinky:daily-done";

function clean(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return 0;
    }
    return Math.floor(value);
}

// The number of the last daily completed, or 0 if none.
export function lastDailyDone(): number {
    try {
        return clean(JSON.parse(localStorage.getItem(KEY) ?? "0"));
    } catch {
        return 0;
    }
}

// Record completing daily #number. Only ever moves forward, so replaying an older
// daily can't overwrite a newer completion.
export function recordDailyDone(number: number): void {
    if (number <= lastDailyDone()) {
        return;
    }
    try {
        localStorage.setItem(KEY, JSON.stringify(Math.floor(number)));
    } catch {
        // Best-effort: a blocked localStorage just means no ✓ persists.
    }
}
