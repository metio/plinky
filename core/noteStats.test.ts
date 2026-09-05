// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    foldRun,
    MAX_READ_MS,
    meanMs,
    type NoteStats,
    normalizeNoteStats,
    slowestNotes,
    typicalMs,
} from "./noteStats";

const note = (pitches: number[], playedMs: number, wrongBefore = 0) => ({
    pitches,
    playedMs,
    wrongBefore,
});

describe("foldRun", () => {
    it("averages the reading time over the plays that carried a gap", () => {
        // A run's first note has no gap before it; counting that play in the mean read
        // every piece-opening note as quick to find.
        const stats = foldRun({}, [note([60], 0), note([62], 1000), note([60], 3000)]);
        expect(stats[60]?.plays).toBe(2);
        expect(stats[60]?.timed).toBe(1);
        expect(meanMs(stats[60]!)).toBe(2000);
    });

    it("credits each note the gap since the one before it", () => {
        const stats = foldRun({}, [note([60], 0), note([62], 500), note([64], 1500)]);

        // The first note has no gap to measure; the others take 500ms and 1000ms.
        expect(stats["60"]).toEqual({ plays: 1, wrongs: 0, totalMs: 0, timed: 0 });
        expect(meanMs(stats["62"]!)).toBe(500);
        expect(meanMs(stats["64"]!)).toBe(1000);
    });

    it("gives every note of a chord the same reading time", () => {
        const stats = foldRun({}, [note([60], 0), note([64, 67], 800)]);

        expect(meanMs(stats["64"]!)).toBe(800);
        expect(meanMs(stats["67"]!)).toBe(800);
    });

    it("accumulates across runs", () => {
        const first = foldRun({}, [note([60], 0), note([62], 400)]);
        const both = foldRun(first, [note([60], 0), note([62], 800)]);

        expect(both["62"]).toMatchObject({ plays: 2, totalMs: 1200 });
        expect(meanMs(both["62"]!)).toBe(600);
    });

    it("refuses to count a break as reading time", () => {
        // A run left open over a cup of tea would otherwise poison the note's mean
        // for good.
        const stats = foldRun({}, [note([60], 0), note([62], MAX_READ_MS + 1)]);

        expect(stats["62"]).toEqual({ plays: 1, wrongs: 0, totalMs: 0, timed: 0 });
        expect(meanMs(stats["62"]!)).toBeNull();
    });

    it("ignores a gap that runs backwards", () => {
        const stats = foldRun({}, [note([60], 900), note([62], 400)]);

        expect(stats["62"]?.totalMs).toBe(0);
    });

    it("counts wrong keys even on a note whose time cannot be measured", () => {
        // The very first note of a run still tells us it was fumbled.
        const stats = foldRun({}, [note([60], 0, 2)]);

        expect(stats["60"]).toEqual({ plays: 1, wrongs: 2, totalMs: 0, timed: 0 });
    });
});

describe("meanMs", () => {
    it("says nothing rather than averaging over nothing", () => {
        expect(meanMs({ plays: 0, wrongs: 0, totalMs: 0, timed: 0 })).toBeNull();
        expect(meanMs({ plays: 4, wrongs: 0, totalMs: 0, timed: 0 })).toBeNull();
        expect(meanMs({ plays: 2, wrongs: 0, totalMs: 900, timed: 2 })).toBe(450);
    });
});

describe("slowestNotes", () => {
    const stats: NoteStats = {
        "60": { plays: 10, wrongs: 0, totalMs: 3000, timed: 10 },
        "62": { plays: 10, wrongs: 4, totalMs: 12000, timed: 10 },
        "64": { plays: 2, wrongs: 0, totalMs: 20000, timed: 2 },
    };

    it("puts the slowest first", () => {
        expect(slowestNotes(stats).map((row) => row.note)).toEqual([62, 60]);
    });

    it("leaves out a note read too few times to mean anything", () => {
        // 64 averages ten seconds, but off two readings — noise, and pointing a
        // player at noise wastes the practice it prompts.
        expect(slowestNotes(stats).some((row) => row.note === 64)).toBe(false);
        expect(slowestNotes(stats, 2).some((row) => row.note === 64)).toBe(true);
    });

    it("carries the counts the number was built from", () => {
        expect(slowestNotes(stats)[0]).toEqual({
            note: 62,
            meanMs: 1200,
            plays: 10,
            wrongs: 4,
        });
    });

    it("comes back empty before anything has been read enough", () => {
        expect(slowestNotes({})).toEqual([]);
    });

    it("holds to the limit it was given", () => {
        const many: NoteStats = Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [
                String(60 + i),
                { plays: 5, wrongs: 0, totalMs: 1000 * (i + 1), timed: 5 },
            ]),
        );

        expect(slowestNotes(many, 3, 3)).toHaveLength(3);
    });
});

describe("typicalMs", () => {
    it("takes the middle note, not the average", () => {
        // One note abandoned mid-run must not drag the line everything else is
        // measured against.
        const stats: NoteStats = {
            "60": { plays: 5, wrongs: 0, totalMs: 2500, timed: 5 },
            "62": { plays: 5, wrongs: 0, totalMs: 3000, timed: 5 },
            "64": { plays: 5, wrongs: 0, totalMs: 45000, timed: 5 },
        };

        expect(typicalMs(stats)).toBe(600);
    });

    it("says nothing until something qualifies", () => {
        expect(typicalMs({})).toBeNull();
        expect(typicalMs({ "60": { plays: 1, wrongs: 0, totalMs: 500, timed: 1 } })).toBeNull();
    });
});

describe("normalizeNoteStats", () => {
    it("keeps what could have come from a run", () => {
        expect(normalizeNoteStats({ "60": { plays: 3, wrongs: 1, totalMs: 900, timed: 3 } })).toEqual({
            "60": { plays: 3, wrongs: 1, totalMs: 900, timed: 3 },
        });
    });

    it("drops entries that could not", () => {
        const cleaned = normalizeNoteStats({
            "60": { plays: 3, wrongs: 1, totalMs: 900, timed: 3 },
            "999": { plays: 3, wrongs: 0, totalMs: 100, timed: 3 },
            nonsense: { plays: 3, wrongs: 0, totalMs: 100, timed: 3 },
            "62": { plays: 0, wrongs: 0, totalMs: 0, timed: 0 },
            "64": "not a stat",
            "65": { plays: -5, wrongs: 0, totalMs: 100 },
        });

        expect(Object.keys(cleaned)).toEqual(["60"]);
    });

    it("reads junk as no stats at all", () => {
        expect(normalizeNoteStats(null)).toEqual({});
        expect(normalizeNoteStats("nope")).toEqual({});
    });
});
