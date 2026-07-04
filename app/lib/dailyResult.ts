// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { browserStore } from "../adapters/browserStore";
import type { Grade } from "../../core/grade";
import type { Grid, RunNote } from "../../core/shareCard";

// The finished daily run, kept so re-opening the day's challenge shows the result
// rather than a blank slate — the home "see your results" link has somewhere to lead.
// Only the latest day is held (one key, tagged with its number): the daily is the same
// for everyone that day, so only today's result is ever worth showing, and a stored
// number from an earlier day is simply ignored.
export type DailyResult = {
    grade: Grade;
    grid: Grid;
    notes: RunNote[];
    tolerance: number;
};

const KEY = "plinky:daily-result";

export function saveDailyResult(number: number, result: DailyResult): void {
    try {
        browserStore.set(KEY, JSON.stringify({ number, ...result }));
    } catch {
        // Best-effort — a missing cached result just shows a fresh challenge.
    }
}

// The stored result for the given daily number, or null when the store is empty,
// holds an earlier day, or is malformed.
export function loadDailyResult(number: number): DailyResult | null {
    try {
        const raw = browserStore.get(KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (
            parsed?.number !== number ||
            !parsed.grade ||
            typeof parsed.grade !== "object" ||
            !Array.isArray(parsed.grid) ||
            !Array.isArray(parsed.notes) ||
            !Number.isFinite(parsed.tolerance)
        ) {
            return null;
        }
        return {
            grade: parsed.grade,
            grid: parsed.grid,
            notes: parsed.notes,
            tolerance: parsed.tolerance,
        };
    } catch {
        return null;
    }
}
