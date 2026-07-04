// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { todayKey } from "../../core/daily";

const KEY = "plinky:history";

// Fired when a run is recorded, so persistent UI (the home Today panel) can refresh
// without a reload — the practice happens deep in a route, the panel in the layout.
export const PRACTICE_EVENT = "plinky:practice";

// Notes practiced per day, keyed by local calendar date (YYYY-MM-DD), matching todayKey.
export type History = Record<string, number>;

export type PracticeSummary = {
    totalNotes: number;
    daysPracticed: number;
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
        // Let persistent UI (the home Today panel) refresh without a reload.
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PRACTICE_EVENT));
        }
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

    const recent: { date: string; notes: number }[] = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
        const date = shiftDay(today, -daysAgo);
        recent.push({ date, notes: history[date] ?? 0 });
    }

    return { totalNotes, daysPracticed, recent };
}
