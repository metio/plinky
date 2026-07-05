// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { browserStore } from "../adapters/browserStore";
import { readJson, writeJson } from "../stores/jsonStore";
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
    writeJson(browserStore, KEY, { number, ...result });
}

// The stored result for the given daily number, or null when the store is empty,
// holds an earlier day, or is malformed.
export function loadDailyResult(number: number): DailyResult | null {
    const parsed = readJson(browserStore, KEY) as Record<string, unknown> | null;
    if (
        !parsed ||
        parsed.number !== number ||
        !parsed.grade ||
        typeof parsed.grade !== "object" ||
        !Array.isArray(parsed.grid) ||
        !Array.isArray(parsed.notes) ||
        !Number.isFinite(parsed.tolerance)
    ) {
        return null;
    }
    return {
        grade: parsed.grade as DailyResult["grade"],
        grid: parsed.grid as DailyResult["grid"],
        notes: parsed.notes as DailyResult["notes"],
        tolerance: parsed.tolerance as number,
    };
}
