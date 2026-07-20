// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { todayKey } from "./daily";

// Notes practiced per day, keyed by local calendar date (YYYY-MM-DD), matching todayKey.
// Every practice day is retained: totalNotes and daysPracticed are lifetime aggregates
// over the whole map, so an old day can't be pruned without corrupting them. One small
// number per calendar day keeps the map well within the storage budget for a lifetime of
// practice, so unlike the fixed-window lifetime fingerprint this map is not capped.
export type History = Record<string, number>;

export type PracticeSummary = {
    totalNotes: number;
    daysPracticed: number;
    recent: { date: string; notes: number }[];
};

// Turns a raw stored string (or null for nothing stored) into a valid History.
// An array also satisfies `typeof === "object"`, but assigning date keys onto one
// and re-serialising drops them, silently losing practice — so it reads as empty.
// Only finite-number values are kept: a corrupt entry whose value is a string would
// otherwise turn `count + notes` into string concatenation and every total to gibberish.
export function parseHistory(raw: string | null): History {
    try {
        const parsed = JSON.parse(raw ?? "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const history: History = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "number" && Number.isFinite(value)) {
                history[key] = value;
            }
        }
        return history;
    } catch {
        return {};
    }
}

// Folds a finished run's note count onto today's tally. Zero or negative counts
// leave the history untouched — an aborted run records nothing.
export function foldPractice(history: History, notes: number, now: Date): History {
    if (notes <= 0) {
        return history;
    }
    const key = todayKey(now);
    return { ...history, [key]: (history[key] ?? 0) + notes };
}

function shiftDay(dateKey: string, delta: number): string {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
}

export function summarizePractice(history: History, now: Date): PracticeSummary {
    const totalNotes = Object.values(history).reduce((sum, notes) => sum + notes, 0);
    const daysPracticed = Object.values(history).filter((notes) => notes > 0).length;
    const today = todayKey(now);

    const recent: { date: string; notes: number }[] = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
        const date = shiftDay(today, -daysAgo);
        recent.push({ date, notes: history[date] ?? 0 });
    }

    return { totalNotes, daysPracticed, recent };
}

// The "YYYY-MM" month a date falls in — the prefix shared by that month's day keys.
export function monthKey(now: Date): string {
    return todayKey(now).slice(0, 7);
}

// A month's practice rolled up for the shareable recap card: how many notes were played,
// on how many days, and the biggest single day. A month with no practice reads as zeros
// and no best day, so the card can decline to appear rather than boast about nothing.
export type MonthlyRecap = {
    month: string;
    totalNotes: number;
    daysPracticed: number;
    bestDay: { date: string; notes: number } | null;
};

export function monthlyRecap(history: History, month: string): MonthlyRecap {
    let totalNotes = 0;
    let daysPracticed = 0;
    let bestDay: { date: string; notes: number } | null = null;
    for (const [date, notes] of Object.entries(history)) {
        if (notes <= 0 || !date.startsWith(`${month}-`)) {
            continue;
        }
        totalNotes += notes;
        daysPracticed += 1;
        if (!bestDay || notes > bestDay.notes) {
            bestDay = { date, notes };
        }
    }
    return { month, totalNotes, daysPracticed, bestDay };
}
