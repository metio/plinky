// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { History } from "./history";
import { inScope, scopeDays, scopeStart, scopeSummary, weekSeries } from "./statsScope";

// A Wednesday, so the week start is a real shift rather than today.
const NOW = new Date("2026-08-19T10:00:00");

describe("weekSeries", () => {
    it("runs from Monday to today, one entry a day, with the notes of each", () => {
        const history: History = { "2026-08-16": 70, "2026-08-17": 40, "2026-08-19": 900 };
        expect(weekSeries(history, NOW)).toEqual([
            { date: "2026-08-17", notes: 40 },
            { date: "2026-08-18", notes: 0 },
            { date: "2026-08-19", notes: 900 },
        ]);
    });

    it("is today alone on a Monday, however full the days before it were", () => {
        // The rolling seven days would draw six full bars here that the week tile above
        // them counts as nothing.
        const history: History = { "2026-08-18": 100, "2026-08-23": 100 };
        expect(weekSeries(history, new Date("2026-08-24T10:00:00"))).toEqual([
            { date: "2026-08-24", notes: 0 },
        ]);
    });
});

describe("scopeStart", () => {
    it("runs from the first of the month, not thirty days back", () => {
        // The page's actual bug: the practice report's month meant the last thirty days
        // while the recap card's meant August, and both were on screen calling themselves
        // month. On the first of a month they disagree by an entire previous month.
        expect(scopeStart("month", NOW)).toBe("2026-08-01");
        expect(scopeStart("month", new Date("2026-09-01T10:00:00"))).toBe("2026-09-01");
    });

    it("starts the week on Monday", () => {
        expect(scopeStart("week", NOW)).toBe("2026-08-17");
        // A Sunday reads as the end of its week, not the start of the next.
        expect(scopeStart("week", new Date("2026-08-23T10:00:00"))).toBe("2026-08-17");
        expect(scopeStart("week", new Date("2026-08-24T10:00:00"))).toBe("2026-08-24");
    });

    it("runs the year from January", () => {
        expect(scopeStart("year", NOW)).toBe("2026-01-01");
    });

    it("has no start at all for all time", () => {
        expect(scopeStart("all", NOW)).toBeNull();
    });
});

describe("scopeDays", () => {
    it("counts today in", () => {
        // 17th, 18th, 19th.
        expect(scopeDays("week", NOW)).toBe(3);
        expect(scopeDays("month", NOW)).toBe(19);
        expect(scopeDays("year", NOW)).toBe(231);
    });

    it("is one on the first day of a period, never zero", () => {
        // The report divides by this, and a scope covering "no days" would be a page of
        // NaN on the first of the month.
        expect(scopeDays("month", new Date("2026-09-01T10:00:00"))).toBe(1);
        expect(scopeDays("year", new Date("2026-01-01T10:00:00"))).toBe(1);
    });

    it("gives no count for all time, because there is none to give", () => {
        expect(scopeDays("all", NOW)).toBeNull();
    });
});

describe("inScope", () => {
    it("excludes the future, whatever the scope", () => {
        // A device whose clock ran ahead, or a history written in another time zone. A day
        // that has not happened cannot be part of how this month has gone.
        expect(inScope("2026-12-25", "all", NOW)).toBe(false);
        expect(inScope("2026-08-20", "month", NOW)).toBe(false);
    });

    it("includes today and the first day of the period", () => {
        expect(inScope("2026-08-19", "week", NOW)).toBe(true);
        expect(inScope("2026-08-17", "week", NOW)).toBe(true);
        expect(inScope("2026-08-16", "week", NOW)).toBe(false);
    });
});

describe("scopeSummary", () => {
    const history: History = {
        "2025-12-30": 500,
        "2026-01-05": 300,
        "2026-08-01": 100,
        "2026-08-17": 40,
        "2026-08-19": 900,
        "2026-08-25": 7000,
        "2026-08-10": 0,
    };

    it("narrows as the window narrows, and every scope is a subset of the next", () => {
        const week = scopeSummary(history, "week", NOW);
        const month = scopeSummary(history, "month", NOW);
        const year = scopeSummary(history, "year", NOW);
        const all = scopeSummary(history, "all", NOW);
        expect(week.totalNotes).toBe(940);
        expect(month.totalNotes).toBe(1040);
        expect(year.totalNotes).toBe(1340);
        expect(all.totalNotes).toBe(1840);
        expect(week.totalNotes).toBeLessThanOrEqual(month.totalNotes);
        expect(month.totalNotes).toBeLessThanOrEqual(year.totalNotes);
        expect(year.totalNotes).toBeLessThanOrEqual(all.totalNotes);
    });

    it("counts only days with practice on them", () => {
        // A zero-note day is a day the history happens to hold a key for, not a day at the
        // keys — counting it would inflate the figure the page is proudest of.
        expect(scopeSummary(history, "month", NOW).daysPracticed).toBe(3);
    });

    it("leaves the future out of the total, and out of the best day", () => {
        // 7000 on the 25th is ahead of NOW. A best day nobody has played yet would be the
        // loudest number on the page.
        const month = scopeSummary(history, "month", NOW);
        expect(month.bestDay).toEqual({ date: "2026-08-19", notes: 900 });
    });

    it("has no best day when nothing was played", () => {
        expect(scopeSummary({}, "all", NOW).bestDay).toBeNull();
        expect(scopeSummary({ "2026-08-19": 0 }, "week", NOW).bestDay).toBeNull();
    });
});
