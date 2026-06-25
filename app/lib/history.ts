// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { todayKey } from "./daily";

const KEY = "plinky:history";

// Notes practiced per day, keyed by local calendar date (YYYY-MM-DD), matching todayKey.
export type History = Record<string, number>;

export type PracticeSummary = {
    totalNotes: number;
    daysPracticed: number;
    currentStreak: number;
    recent: { date: string; notes: number }[];
};

export function loadHistory(): History {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        // An array also satisfies `typeof === "object"`, but assigning date keys
        // onto one and re-serialising drops them, silently losing practice.
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as History)
            : {};
    } catch {
        return {};
    }
}

export function recordPractice(notes: number, now: Date = new Date()): void {
    if (notes <= 0) {
        return;
    }
    try {
        const history = loadHistory();
        const key = todayKey(now);
        history[key] = (history[key] ?? 0) + notes;
        localStorage.setItem(KEY, JSON.stringify(history));
    } catch {
        // Practice history is a convenience; a failed write is not surfaced.
    }
}

function shiftDay(dateKey: string, delta: number): string {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
}

export function summarizePractice(history: History, now: Date = new Date()): PracticeSummary {
    const totalNotes = Object.values(history).reduce((sum, notes) => sum + notes, 0);
    const daysPracticed = Object.values(history).filter((notes) => notes > 0).length;

    const today = todayKey(now);
    // Today may still be in progress, so a streak stays alive from yesterday until
    // a full day passes with no practice.
    let cursor = (history[today] ?? 0) > 0 ? today : shiftDay(today, -1);
    let currentStreak = 0;
    while ((history[cursor] ?? 0) > 0) {
        currentStreak++;
        cursor = shiftDay(cursor, -1);
    }

    const recent: { date: string; notes: number }[] = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
        const date = shiftDay(today, -daysAgo);
        recent.push({ date, notes: history[date] ?? 0 });
    }

    return { totalNotes, daysPracticed, currentStreak, recent };
}
