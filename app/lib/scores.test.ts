// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    ERROR_PENALTY_MS,
    isBetterRhythm,
    loadBest,
    loadBestRhythm,
    saveBest,
    saveBestRhythm,
    scoreFor,
    type RhythmBest,
    type TrialResult,
} from "./scores";
import type { RhythmSummary } from "./rhythm";

function summary(averageAbsMs: number, perfect: number): RhythmSummary {
    return { perfect, good: 0, off: 0, total: perfect, averageAbsMs };
}

function installLocalStorage(): void {
    const store = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, String(value)),
        removeItem: (key) => void store.delete(key),
        clear: () => store.clear(),
        key: (index) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
    } satisfies Storage;
}

describe("scoreFor", () => {
    it("returns the raw time when there are no errors", () => {
        expect(scoreFor(4200, 0)).toBe(4200);
    });

    it("adds the penalty per error", () => {
        expect(scoreFor(4200, 2)).toBe(4200 + 2 * ERROR_PENALTY_MS);
    });
});

describe("best-score persistence", () => {
    beforeEach(() => {
        installLocalStorage();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("returns null when nothing is stored", () => {
        expect(loadBest("c-major-scale")).toBeNull();
    });

    it("round-trips a saved result", () => {
        const result: TrialResult = {
            timeMs: 3800,
            errors: 1,
            score: 5800,
            at: "2026-06-22T00:00:00.000Z",
        };
        saveBest("c-major-scale", result);
        expect(loadBest("c-major-scale")).toEqual(result);
    });

    it("scopes results per exercise id", () => {
        const result: TrialResult = {
            timeMs: 1000,
            errors: 0,
            score: 1000,
            at: "2026-06-22T00:00:00.000Z",
        };
        saveBest("c-major-scale", result);
        expect(loadBest("c-major-arpeggio")).toBeNull();
    });

    it("returns null for corrupt stored data", () => {
        localStorage.setItem("plinky:best:c-major-scale", "not json");
        expect(loadBest("c-major-scale")).toBeNull();
    });
});

describe("isBetterRhythm", () => {
    it("is true when there is no previous best", () => {
        expect(isBetterRhythm(summary(120, 3), null)).toBe(true);
    });

    it("prefers a smaller average timing error", () => {
        const current: RhythmBest = { ...summary(100, 3), at: "x" };
        expect(isBetterRhythm(summary(80, 1), current)).toBe(true);
        expect(isBetterRhythm(summary(140, 8), current)).toBe(false);
    });

    it("breaks ties on more perfect notes", () => {
        const current: RhythmBest = { ...summary(100, 3), at: "x" };
        expect(isBetterRhythm(summary(100, 5), current)).toBe(true);
        expect(isBetterRhythm(summary(100, 2), current)).toBe(false);
    });
});

describe("rhythm best persistence", () => {
    beforeEach(() => {
        installLocalStorage();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("round-trips a saved rhythm best under its own key", () => {
        const best: RhythmBest = { ...summary(75, 6), at: "2026-06-22T00:00:00.000Z" };
        saveBestRhythm("twinkle", best);
        expect(loadBestRhythm("twinkle")).toEqual(best);
        // The rhythm key is distinct from the time-trial key.
        expect(loadBest("twinkle")).toBeNull();
    });

    it("returns null for corrupt stored data", () => {
        localStorage.setItem("plinky:rhythm:twinkle", "not json");
        expect(loadBestRhythm("twinkle")).toBeNull();
    });
});
