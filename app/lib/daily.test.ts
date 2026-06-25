// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyNumber, dailyScoreId, todayKey } from "./daily";

describe("todayKey", () => {
    it("formats the local date as YYYY-MM-DD", () => {
        // Built from local components so the expectation holds in any runner zone.
        expect(todayKey(new Date(2026, 5, 23, 15, 4))).toBe("2026-06-23");
    });
});

describe("dailyNumber", () => {
    it("starts at one on the epoch day", () => {
        expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    });

    it("counts up one per day", () => {
        expect(dailyNumber("2026-06-26", "2026-06-25")).toBe(2);
        expect(dailyNumber("2026-07-05", "2026-06-25")).toBe(11);
    });
});

describe("dailyScoreId", () => {
    const ids = ["a", "b", "c", "d", "e"];

    it("picks the same score for the same day", () => {
        expect(dailyScoreId(ids, "2026-06-25")).toBe(dailyScoreId(ids, "2026-06-25"));
    });

    it("always picks an id from the catalogue", () => {
        expect(ids).toContain(dailyScoreId(ids, "2026-06-25"));
    });

    it("varies the pick across days", () => {
        const week = ["2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29"].map(
            (day) => dailyScoreId(ids, day),
        );
        // The seed moves the pick around rather than landing on one score forever.
        expect(new Set(week).size).toBeGreaterThan(1);
    });

    it("returns null for an empty catalogue", () => {
        expect(dailyScoreId([], "2026-06-25")).toBeNull();
    });
});
