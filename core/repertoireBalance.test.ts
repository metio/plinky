// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { PracticeLog, PracticeSession } from "./practiceSession";
import { daysSince, repertoireBalance } from "./repertoireBalance";

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

const session = (over: Partial<PracticeSession>): PracticeSession => ({
    start: START,
    end: START + 60_000,
    activeMs: 60_000,
    notes: 0,
    pieces: [],
    manual: false,
    mood: null,
    label: "",
    ...over,
});

describe("the repertoire balance", () => {
    it("totals the time each piece was given, most-practised first", () => {
        const log: PracticeLog = [
            session({ start: START, activeMs: 60_000, pieces: ["bach"] }),
            session({ start: START + DAY, activeMs: 120_000, pieces: ["satie"] }),
            session({ start: START + 2 * DAY, activeMs: 30_000, pieces: ["bach"] }),
        ];
        expect(repertoireBalance(log).map((one) => [one.piece, one.activeMs])).toEqual([
            ["satie", 120_000],
            ["bach", 90_000],
        ]);
    });

    it("splits a session that touched several pieces evenly between them", () => {
        // The log says which pieces a session touched, never how the minutes divided —
        // so an even split is the only claim the data supports.
        const log: PracticeLog = [
            session({ activeMs: 90_000, pieces: ["bach", "satie", "grieg"] }),
        ];
        expect(repertoireBalance(log).map((one) => one.activeMs)).toEqual([
            30_000, 30_000, 30_000,
        ]);
    });

    it("counts a session once per piece, and keeps the latest touch", () => {
        const log: PracticeLog = [
            session({ start: START, pieces: ["bach"] }),
            session({ start: START + 5 * DAY, pieces: ["bach", "satie"] }),
        ];
        const bach = repertoireBalance(log).find((one) => one.piece === "bach");
        expect(bach).toMatchObject({ sessions: 2, lastAt: START + 5 * DAY });
    });

    it("ignores a session that names no piece", () => {
        // Free play and the trainers log minutes with no catalogue id, and they are not
        // repertoire — counting them would put a row in the list with nothing to name it.
        expect(repertoireBalance([session({ activeMs: 60_000 })])).toEqual([]);
    });

    it("breaks a tie on minutes by which piece was touched most recently", () => {
        const log: PracticeLog = [
            session({ start: START, activeMs: 60_000, pieces: ["aaa"] }),
            session({ start: START + DAY, activeMs: 60_000, pieces: ["zzz"] }),
        ];
        expect(repertoireBalance(log).map((one) => one.piece)).toEqual(["zzz", "aaa"]);
    });

    it("counts whole days since a piece was last touched", () => {
        const [entry] = repertoireBalance([session({ start: START, pieces: ["bach"] })]);
        expect(daysSince(entry!, START + 3 * DAY + 1000)).toBe(3);
        // A piece touched later than the reference instant is not negative days old.
        expect(daysSince(entry!, START - DAY)).toBe(0);
    });
});
