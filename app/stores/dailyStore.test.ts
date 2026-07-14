// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import type { DailyResult } from "../../core/daily";
import { memoryStore } from "../adapters/memoryStore";
import { createDailyStore } from "./dailyStore";

const RESULT: DailyResult = {
    grade: { accuracy: 90, timing: 80, flow: 70, dynamics: null, score: 82, letter: "B" },
    grid: [
        ["best", "good"],
        ["ok", "weak"],
        ["none", "best"],
    ],
    notes: [
        { targetMs: 0, playedMs: 12, wrongBefore: 0 },
        { targetMs: 500, playedMs: 530, wrongBefore: 1 },
    ],
    tolerance: 200,
};

describe("dailyStore.lastDone / recordDone", () => {
    it("starts with nothing completed", () => {
        expect(createDailyStore(memoryStore()).lastDone()).toBe(0);
    });

    it("remembers the last daily completed", () => {
        const daily = createDailyStore(memoryStore());
        expect(daily.recordDone(100)).toBe(true);
        expect(daily.lastDone()).toBe(100);
        daily.recordDone(101);
        expect(daily.lastDone()).toBe(101);
    });

    it("only ever moves forward, ignoring a replay of an older daily", () => {
        const daily = createDailyStore(memoryStore());
        daily.recordDone(101);
        expect(daily.recordDone(100)).toBe(true);
        expect(daily.lastDone()).toBe(101);
    });

    it("does not track any streak or count of consecutive days", () => {
        // A gap between completed dailies is not a missed-streak event — it simply
        // updates the last completed number.
        const daily = createDailyStore(memoryStore());
        daily.recordDone(100);
        daily.recordDone(105);
        expect(daily.lastDone()).toBe(105);
    });

    it("reads a tampered non-number as nothing completed", () => {
        expect(createDailyStore(memoryStore({ "plinky:daily-done": '"ten"' })).lastDone()).toBe(0);
    });
});

describe("dailyStore.loadResult / saveResult", () => {
    it("has nothing stored to begin with", () => {
        expect(createDailyStore(memoryStore()).loadResult(5)).toBeNull();
    });

    it("round-trips the finished run for its own number", () => {
        const daily = createDailyStore(memoryStore());
        expect(daily.saveResult(5, RESULT)).toBe(true);
        expect(daily.loadResult(5)).toEqual(RESULT);
    });

    it("ignores a result stored under a different (earlier) day", () => {
        const daily = createDailyStore(memoryStore());
        daily.saveResult(5, RESULT);
        expect(daily.loadResult(6)).toBeNull();
    });

    it("keeps only the latest day, replacing an older result", () => {
        const daily = createDailyStore(memoryStore());
        daily.saveResult(5, RESULT);
        daily.saveResult(6, { ...RESULT, grade: { ...RESULT.grade, letter: "S" } });
        expect(daily.loadResult(5)).toBeNull();
        expect(daily.loadResult(6)?.grade.letter).toBe("S");
    });

    it("does not let replaying an older day clobber a newer completion", () => {
        const daily = createDailyStore(memoryStore());
        daily.saveResult(6, { ...RESULT, grade: { ...RESULT.grade, letter: "S" } });
        // Replaying and finishing daily #5 must not erase the stored #6 result.
        expect(daily.saveResult(5, RESULT)).toBe(true);
        expect(daily.loadResult(6)?.grade.letter).toBe("S");
        expect(daily.loadResult(5)).toBeNull();
    });

    it("returns null for a malformed store rather than throwing", () => {
        expect(
            createDailyStore(memoryStore({ "plinky:daily-result": "{ not json" })).loadResult(5),
        ).toBeNull();
        expect(
            createDailyStore(
                memoryStore({ "plinky:daily-result": JSON.stringify({ number: 5, grade: 1 }) }),
            ).loadResult(5),
        ).toBeNull();
    });

    it("rejects a null grade rather than handing back one that crashes on .letter", () => {
        // typeof null === "object", so a stored null grade slips past a bare object
        // check and the result page reads grade.letter off null.
        const kv = memoryStore({
            "plinky:daily-result": JSON.stringify({
                number: 5,
                grade: null,
                grid: [],
                notes: [],
                tolerance: 1,
            }),
        });
        expect(createDailyStore(kv).loadResult(5)).toBeNull();
    });

    it("notifies subscribers for either half — done and result", () => {
        const daily = createDailyStore(memoryStore());
        const onChange = vi.fn();
        const unsubscribe = daily.subscribe(onChange);
        daily.recordDone(5);
        daily.saveResult(5, RESULT);
        expect(onChange).toHaveBeenCalledTimes(2);
        unsubscribe();
        daily.recordDone(6);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("reports refused writes on both halves", () => {
        const daily = createDailyStore({ ...memoryStore(), set: () => false });
        expect(daily.recordDone(5)).toBe(false);
        expect(daily.saveResult(5, RESULT)).toBe(false);
    });
});
