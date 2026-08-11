// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    addManualSession,
    foldSession,
    MAX_MANUAL_MINUTES,
    type PracticeLog,
    type PracticeSession,
    parsePracticeLog,
    practiceLogToCsv,
    removeSession,
    SESSION_GAP_MS,
    sessionDate,
    setSessionMood,
    summarizeRange,
} from "./practiceSession";

const MINUTE = 60_000;
// Local-time noon so the derived day key is 2026-06-23 in any runner zone.
const NOON = new Date(2026, 5, 23, 12, 0).getTime();


// The log's first session, or a failure. Indexing is checked in this project, and a
// test that quietly skipped its assertions on an empty log would pass for the wrong
// reason.
function nth(log: PracticeLog, index: number): PracticeSession {
    const session = log[index];
    if (!session) {
        throw new Error(`expected the log to hold a session at ${index}`);
    }
    return session;
}

function only(log: PracticeLog): PracticeSession {
    const [session] = log;
    if (!session) {
        throw new Error("expected the log to hold a session");
    }
    return session;
}

function ping(atOffsetMs: number, activeMs = 5 * MINUTE, notes = 40, pieceId?: string) {
    return { at: NOON + atOffsetMs, activeMs, notes, pieceId };
}

describe("foldSession", () => {
    it("opens a session that starts when the run did, not when it ended", () => {
        const session = only(foldSession([], ping(0, 5 * MINUTE)));
        expect(session.start).toBe(NOON - 5 * MINUTE);
        expect(session.end).toBe(NOON);
        expect(session.activeMs).toBe(5 * MINUTE);
    });

    it("extends the sitting in progress rather than appending a row per run", () => {
        const first = foldSession([], ping(0, 5 * MINUTE, 40, "alpha"));
        const log = foldSession(first, ping(10 * MINUTE, 4 * MINUTE, 30, "beta"));
        expect(log).toHaveLength(1);
        expect(only(log).activeMs).toBe(9 * MINUTE);
        expect(only(log).notes).toBe(70);
        expect(only(log).pieces).toEqual(["alpha", "beta"]);
        // Extending must not move the start, or the span stops describing the sitting.
        expect(only(log).start).toBe(NOON - 5 * MINUTE);
    });

    it("opens a new session once the gap is exceeded", () => {
        const first = foldSession([], ping(0));
        const log = foldSession(first, ping(SESSION_GAP_MS + 5 * MINUTE));
        expect(log).toHaveLength(2);
    });

    it("never absorbs a run into a hand-logged sitting", () => {
        const manual = addManualSession([], { date: "2026-06-23", minutes: 20 });
        const log = foldSession(manual, { at: only(manual).end + MINUTE, activeMs: MINUTE, notes: 5 });
        expect(log).toHaveLength(2);
        expect(nth(log, 1).manual).toBe(false);
    });

    it("records nothing for a run with no time and no notes", () => {
        const log: PracticeLog = [];
        expect(foldSession(log, ping(0, 0, 0))).toBe(log);
    });

    it("keeps a run that played notes but reported no elapsed time", () => {
        // A one-note drill clears immediately; the notes are real practice even though
        // the run's own clock reads zero.
        expect(foldSession([], ping(0, 0, 3))).toHaveLength(1);
    });

    it("does not fold a run that lands before the sitting it would extend", () => {
        // A clock corrected backwards mid-session would otherwise pull `end` back and
        // make the sitting shorter than the runs inside it.
        const first = foldSession([], ping(0));
        const log = foldSession(first, ping(-MINUTE));
        expect(log).toHaveLength(2);
    });
});

describe("addManualSession", () => {
    it("lands on the named calendar day", () => {
        const session = only(addManualSession([], { date: "2026-06-23", minutes: 45 }));
        expect(sessionDate(session)).toBe("2026-06-23");
        expect(session.activeMs).toBe(45 * MINUTE);
        expect(session.manual).toBe(true);
    });

    it("keeps the log in date order when back-logging an older day", () => {
        const log = addManualSession(
            addManualSession([], { date: "2026-06-23", minutes: 30 }),
            { date: "2026-06-20", minutes: 15 },
        );
        expect(log.map(sessionDate)).toEqual(["2026-06-20", "2026-06-23"]);
    });

    it("refuses a nonsense date, a zero and an implausible length", () => {
        const log: PracticeLog = [];
        expect(addManualSession(log, { date: "2026-02-31", minutes: 30 })).toBe(log);
        expect(addManualSession(log, { date: "2026-06-23", minutes: 0 })).toBe(log);
        expect(addManualSession(log, { date: "2026-06-23", minutes: MAX_MANUAL_MINUTES + 1 })).toBe(
            log,
        );
    });
});

describe("parsePracticeLog", () => {
    it("reads nothing stored, or corrupt data, as an empty log", () => {
        expect(parsePracticeLog(null)).toEqual([]);
        expect(parsePracticeLog("not json")).toEqual([]);
        expect(parsePracticeLog('{"sessions":[]}')).toEqual([]);
    });

    it("drops entries with no usable start", () => {
        expect(parsePracticeLog('[{"start":0},{"activeMs":60000},null,7]')).toEqual([]);
    });

    it("repairs an end stored before its start so durations cannot go negative", () => {
        const session = only(parsePracticeLog(`[{"start":${NOON},"end":${NOON - MINUTE}}]`));
        expect(session.end).toBe(NOON);
    });

    it("sorts a log restored out of order", () => {
        const log = parsePracticeLog(
            `[{"start":${NOON},"end":${NOON}},{"start":${NOON - 86_400_000},"end":${NOON - 86_400_000}}]`,
        );
        expect(only(log).start).toBeLessThan(nth(log, 1).start);
    });
});

describe("summarizeRange", () => {
    const log = [
        ...addManualSession([], { date: "2026-06-21", minutes: 30, mood: "rough" }),
        ...foldSession([], ping(0, 20 * MINUTE, 200, "alpha")),
    ];

    it("draws every day in the range, including the empty ones", () => {
        const report = summarizeRange(log, "2026-06-21", "2026-06-23");
        expect(report.days.map((day) => day.date)).toEqual([
            "2026-06-21",
            "2026-06-22",
            "2026-06-23",
        ]);
        expect(report.days.at(1)?.activeMs).toBe(0);
    });

    it("totals only the days actually practised when averaging", () => {
        const report = summarizeRange(log, "2026-06-21", "2026-06-23");
        expect(report.activeDays).toBe(2);
        expect(report.activeMs).toBe(50 * MINUTE);
        expect(report.averageMs).toBe(25 * MINUTE);
    });

    it("separates hand-logged minutes from measured ones", () => {
        const report = summarizeRange(log, "2026-06-21", "2026-06-23");
        expect(report.sessions).toBe(2);
        expect(report.manualSessions).toBe(1);
    });

    it("names the longest day and the pieces touched", () => {
        const report = summarizeRange(log, "2026-06-21", "2026-06-23");
        // The hand-logged half hour outweighs the measured twenty minutes: both are
        // practice, and the report ranks by time rather than by how it was recorded.
        expect(report.longestDay?.date).toBe("2026-06-21");
        expect(report.pieces).toEqual(["alpha"]);
        expect(report.moods.rough).toBe(1);
    });

    it("is empty over a range with no practice", () => {
        const report = summarizeRange(log, "2026-07-01", "2026-07-07");
        expect(report.activeDays).toBe(0);
        expect(report.averageMs).toBe(0);
        expect(report.longestDay).toBeNull();
    });
});

describe("editing the log", () => {
    it("removes a session by its start", () => {
        const log = foldSession([], ping(0));
        expect(removeSession(log, only(log).start)).toEqual([]);
        expect(removeSession(log, 12345)).toEqual(log);
    });

    it("sets and clears a mood", () => {
        const log = foldSession([], ping(0));
        expect(only(setSessionMood(log, only(log).start, "good")).mood).toBe("good");
        const set = setSessionMood(log, only(log).start, "good");
        expect(only(setSessionMood(set, only(log).start, null)).mood).toBeNull();
    });

    it("ignores a mood that is not on the scale", () => {
        const log = foldSession([], ping(0));
        expect(
            only(setSessionMood(log, only(log).start, "amazing" as unknown as null)).mood,
        ).toBeNull();
    });
});

describe("practiceLogToCsv", () => {
    const title = (id: string) => (id === "alpha" ? "Alpha" : id);
    const formatTime = () => "12:00";

    it("writes one row per session under a header", () => {
        const log = foldSession([], ping(0, 20 * MINUTE, 200, "alpha"));
        const csv = practiceLogToCsv(log, title, formatTime);
        const [header, row] = csv.split("\n");
        expect(header).toBe("Date,Started,Minutes,Notes,Logged,Mood,Note,Pieces");
        expect(row).toBe("2026-06-23,12:00,20,200,measured,,,Alpha");
    });

    it("disarms a label a spreadsheet would execute", () => {
        const log = addManualSession([], {
            date: "2026-06-23",
            minutes: 10,
            label: "=HYPERLINK(\"http://evil\")",
        });
        expect(practiceLogToCsv(log, title, formatTime)).toContain("\"'=HYPERLINK");
    });
});
