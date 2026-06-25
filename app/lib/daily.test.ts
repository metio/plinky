// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyChallenge, dailyNumber, todayKey } from "./daily";

const measureCount = (xml: string) => (xml.match(/<measure /g) ?? []).length;

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

describe("dailyChallenge", () => {
    it("generates the same phrase and tempo for the same day", () => {
        expect(dailyChallenge("2026-06-25", 1)).toEqual(dailyChallenge("2026-06-25", 1));
    });

    it("emits a playable score-partwise document titled for the day", () => {
        const { xml } = dailyChallenge("2026-06-25", 1);
        expect(xml).toContain("<score-partwise");
        expect(xml).toContain("<work-title>Plinky #1</work-title>");
        expect(xml).toContain("<note>");
        expect(xml).toContain("<time><beats>4</beats>");
    });

    it("keeps the tempo in the beginner-friendly band", () => {
        for (const day of ["2026-06-25", "2026-07-01", "2026-08-15", "2026-12-31"]) {
            const { tempo } = dailyChallenge(day, 1);
            expect(tempo).toBeGreaterThanOrEqual(80);
            expect(tempo).toBeLessThanOrEqual(120);
        }
    });

    it("sizes the phrase to about forty-five seconds of play", () => {
        for (const day of ["2026-06-25", "2026-07-01", "2026-12-31"]) {
            const { tempo, xml } = dailyChallenge(day, 1);
            // Rhythm varies within each bar, so play time follows the bar count:
            // seconds = bars × 4 beats / tempo × 60.
            const seconds = ((measureCount(xml) * 4) / tempo) * 60;
            expect(seconds).toBeGreaterThan(42);
            expect(seconds).toBeLessThan(48);
        }
    });

    it("varies the phrase across days", () => {
        const week = ["2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28"].map(
            (day) => dailyChallenge(day, 1).xml,
        );
        expect(new Set(week).size).toBeGreaterThan(1);
    });
});
