// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { foldPractice, parseHistory, summarizePractice } from "./history";

// Local-time noon so the derived day key is 2026-06-23 in any runner zone.
const NOW = new Date(2026, 5, 23, 12, 0);

describe("foldPractice", () => {
    it("accumulates notes for the day", () => {
        const once = foldPractice({}, 10, NOW);
        const twice = foldPractice(once, 5, NOW);
        expect(twice["2026-06-23"]).toBe(15);
    });

    it("ignores non-positive counts", () => {
        const history = {};
        expect(foldPractice(history, 0, NOW)).toBe(history);
        expect(foldPractice(history, -3, NOW)).toBe(history);
    });
});

describe("parseHistory", () => {
    it("returns an empty history for nothing stored or corrupt data", () => {
        expect(parseHistory(null)).toEqual({});
        expect(parseHistory("not json")).toEqual({});
    });

    it("rejects a stored array so practice is not silently lost", () => {
        expect(parseHistory("[1,2,3]")).toEqual({});
    });

    it("keeps only finite-number values so a corrupt entry can't concatenate totals", () => {
        expect(
            parseHistory('{"2026-06-21":30,"2026-06-22":"oops","2026-06-23":null,"2026-06-24":15}'),
        ).toEqual({ "2026-06-21": 30, "2026-06-24": 15 });
    });
});

describe("summarizePractice", () => {
    it("totals notes and days", () => {
        const summary = summarizePractice({ "2026-06-21": 30, "2026-06-23": 20 }, NOW);
        expect(summary.totalNotes).toBe(50);
        expect(summary.daysPracticed).toBe(2);
    });

    it("counts only the days with positive notes", () => {
        // parseHistory keeps a stored 0 — it is a finite number — but a zero-note day
        // is not a day practiced.
        const summary = summarizePractice(
            { "2026-06-21": 30, "2026-06-22": 0, "2026-06-23": 20 },
            NOW,
        );
        expect(summary.totalNotes).toBe(50);
        expect(summary.daysPracticed).toBe(2);
    });

    it("returns the last seven days in order", () => {
        const summary = summarizePractice({ "2026-06-23": 7 }, NOW);
        expect(summary.recent).toHaveLength(7);
        expect(summary.recent[6]).toEqual({ date: "2026-06-23", notes: 7 });
        expect(summary.recent[0]!.date).toBe("2026-06-17");
    });
});
