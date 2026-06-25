// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { loadHistory, recordPractice, summarizePractice } from "./history";

afterEach(() => localStorage.clear());

// Local-time noon so the derived day key is 2026-06-23 in any runner zone.
const NOW = new Date(2026, 5, 23, 12, 0);

describe("recordPractice", () => {
    it("accumulates notes for the day", () => {
        recordPractice(10, NOW);
        recordPractice(5, NOW);
        expect(loadHistory()["2026-06-23"]).toBe(15);
    });

    it("ignores non-positive counts", () => {
        recordPractice(0, NOW);
        expect(loadHistory()).toEqual({});
    });
});

describe("summarizePractice", () => {
    it("totals notes and days", () => {
        const summary = summarizePractice({ "2026-06-21": 30, "2026-06-23": 20 }, NOW);
        expect(summary.totalNotes).toBe(50);
        expect(summary.daysPracticed).toBe(2);
    });

    it("counts a consecutive streak ending today", () => {
        const summary = summarizePractice(
            { "2026-06-21": 5, "2026-06-22": 5, "2026-06-23": 5 },
            NOW,
        );
        expect(summary.currentStreak).toBe(3);
    });

    it("keeps the streak alive when today has no practice yet", () => {
        const summary = summarizePractice({ "2026-06-21": 5, "2026-06-22": 5 }, NOW);
        expect(summary.currentStreak).toBe(2);
    });

    it("breaks the streak after a missed day", () => {
        const summary = summarizePractice({ "2026-06-20": 5 }, NOW);
        expect(summary.currentStreak).toBe(0);
    });

    it("returns the last seven days in order", () => {
        const summary = summarizePractice({ "2026-06-23": 7 }, NOW);
        expect(summary.recent).toHaveLength(7);
        expect(summary.recent[6]).toEqual({ date: "2026-06-23", notes: 7 });
        expect(summary.recent[0]!.date).toBe("2026-06-17");
    });

    it("returns an empty history for corrupt storage", () => {
        localStorage.setItem("plinky:history", "not json");
        expect(loadHistory()).toEqual({});
    });

    it("rejects a stored array so practice is not silently lost", () => {
        localStorage.setItem("plinky:history", "[1,2,3]");
        expect(loadHistory()).toEqual({});
        recordPractice(10, NOW);
        expect(loadHistory()["2026-06-23"]).toBe(10);
    });
});
