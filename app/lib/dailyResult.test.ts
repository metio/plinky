// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { withDeniedStorage } from "./deniedStorage";
import { type DailyResult, loadDailyResult, saveDailyResult } from "./dailyResult";

afterEach(() => localStorage.clear());

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

describe("dailyResult", () => {
    it("has nothing stored to begin with", () => {
        expect(loadDailyResult(5)).toBeNull();
    });

    it("round-trips the finished run for its own number", () => {
        saveDailyResult(5, RESULT);
        expect(loadDailyResult(5)).toEqual(RESULT);
    });

    it("ignores a result stored under a different (earlier) day", () => {
        saveDailyResult(5, RESULT);
        expect(loadDailyResult(6)).toBeNull();
    });

    it("keeps only the latest day, replacing an older result", () => {
        saveDailyResult(5, RESULT);
        saveDailyResult(6, { ...RESULT, grade: { ...RESULT.grade, letter: "S" } });
        expect(loadDailyResult(5)).toBeNull();
        expect(loadDailyResult(6)?.grade.letter).toBe("S");
    });

    it("returns null for a malformed store rather than throwing", () => {
        localStorage.setItem("plinky:daily-result", "{ not json");
        expect(loadDailyResult(5)).toBeNull();
        localStorage.setItem("plinky:daily-result", JSON.stringify({ number: 5, grade: 1 }));
        expect(loadDailyResult(5)).toBeNull();
    });

    it("rejects a null grade rather than handing back one that crashes on .letter", () => {
        // typeof null === "object", so a stored null grade slips past a bare object
        // check and the result page reads grade.letter off null.
        localStorage.setItem(
            "plinky:daily-result",
            JSON.stringify({ number: 5, grade: null, grid: [], notes: [], tolerance: 1 }),
        );
        expect(loadDailyResult(5)).toBeNull();
    });
});

describe("dailyResult under denied storage", () => {
    it("loads null rather than throwing when storage is blocked", () => {
        expect(withDeniedStorage(() => loadDailyResult(1))).toBeNull();
    });

    it("swallows a save when storage is blocked", () => {
        expect(() => withDeniedStorage(() => saveDailyResult(1, RESULT))).not.toThrow();
    });
});
