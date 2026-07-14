// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { DailyResult } from "../../core/daily";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, mergeSubscribe, parseJson } from "./jsonStore";

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
    const done = createJsonStore<number>(kv, DONE_KEY, (raw) => parseJson(raw, 0, cleanNumber));
    const result = createJsonStore<StoredResult>(kv, RESULT_KEY, (raw) =>
        parseJson(raw, null, (value) => {
            const parsed = value as Record<string, unknown> | null;
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
        }),
    );

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
        saveResult(number, value) {
            // Forward-only, mirroring recordDone: replaying an older daily must not
            // clobber a newer day's stored result, which would blank today's completed
            // view (loadResult keys strictly on the number).
            const stored = result.load();
            if (stored && number < stored.number) {
                return true;
            }
            return result.save({ number, ...value });
        },
        subscribe: mergeSubscribe(done.subscribe, result.subscribe),
    };
}
