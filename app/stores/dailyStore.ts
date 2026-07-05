// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { DailyResult } from "../../core/daily";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore } from "./jsonStore";

// The daily challenge's per-device memory: the last daily completed (enough for a
// ✓ on today's tile and the onboarding step — deliberately NOT a streak; Plinky
// never counts consecutive days or punishes a missed one) and the finished run's
// result, so re-opening the day's challenge shows it instead of a blank slate.

const DONE_KEY = "plinky:daily-done";
const RESULT_KEY = "plinky:daily-result";

export type DailyStore = {
    // The number of the last daily completed, or 0 if none.
    lastDone(): number;
    // Record completing daily #number; only ever moves forward, so replaying an
    // older daily can't overwrite a newer completion. False when the write is
    // refused.
    recordDone(number: number): boolean;
    // The stored result for the given daily number, or null when the store is
    // empty, holds an earlier day, or is malformed.
    loadResult(number: number): DailyResult | null;
    saveResult(number: number, result: DailyResult): boolean;
    subscribe(onChange: () => void): () => void;
};

function cleanNumber(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return 0;
    }
    return Math.floor(value);
}

type StoredResult = (DailyResult & { number: number }) | null;

export function createDailyStore(kv: KeyValueStore): DailyStore {
    const done = createJsonStore<number>(kv, DONE_KEY, (raw) => {
        try {
            return cleanNumber(JSON.parse(raw ?? "0"));
        } catch {
            return 0;
        }
    });
    const result = createJsonStore<StoredResult>(kv, RESULT_KEY, (raw) => {
        if (raw === null) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown> | null;
            if (
                !parsed ||
                typeof parsed.number !== "number" ||
                !parsed.grade ||
                typeof parsed.grade !== "object" ||
                !Array.isArray(parsed.grid) ||
                !Array.isArray(parsed.notes) ||
                !Number.isFinite(parsed.tolerance)
            ) {
                return null;
            }
            return parsed as unknown as StoredResult;
        } catch {
            return null;
        }
    });

    return {
        lastDone: done.load,
        recordDone(number) {
            if (number <= done.load()) {
                return true;
            }
            return done.save(Math.floor(number));
        },
        loadResult(number) {
            const stored = result.load();
            if (!stored || stored.number !== number) {
                return null;
            }
            const { number: _tag, ...rest } = stored;
            return rest;
        },
        saveResult: (number, value) => result.save({ number, ...value }),
        subscribe(onChange) {
            const offDone = done.subscribe(onChange);
            const offResult = result.subscribe(onChange);
            return () => {
                offDone();
                offResult();
            };
        },
    };
}
