// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { currentDailyStreak, loadDailyStreak, recordDailyDone } from "./dailyStreak";

afterEach(() => localStorage.clear());

describe("recordDailyDone", () => {
    it("extends the streak across consecutive days", () => {
        expect(recordDailyDone(100).streak).toBe(1);
        expect(recordDailyDone(101).streak).toBe(2);
        expect(recordDailyDone(102).streak).toBe(3);
    });

    it("restarts the streak after a missed day, keeping the best", () => {
        recordDailyDone(100);
        recordDailyDone(101);
        const after = recordDailyDone(105);
        expect(after.streak).toBe(1);
        expect(after.best).toBe(2);
    });

    it("ignores a replay of the same or an older day", () => {
        recordDailyDone(100);
        recordDailyDone(101);
        expect(recordDailyDone(101).streak).toBe(2);
        expect(recordDailyDone(100).streak).toBe(2);
        expect(loadDailyStreak().last).toBe(101);
    });
});

describe("currentDailyStreak", () => {
    it("counts while today's or yesterday's daily is the last completed", () => {
        recordDailyDone(100);
        recordDailyDone(101);
        // Today is #101 (played) or #102 (yesterday's #101 still counts).
        expect(currentDailyStreak(101)).toBe(2);
        expect(currentDailyStreak(102)).toBe(2);
    });

    it("lapses to zero once a full day is missed", () => {
        recordDailyDone(100);
        recordDailyDone(101);
        expect(currentDailyStreak(103)).toBe(0);
    });
});
