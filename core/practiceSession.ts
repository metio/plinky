// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { toCsv } from "./csv";
import { todayKey } from "./daily";
import { daysBetween, daysInRange, isDateKey } from "./dateKey";

// A practice session: one stretch of sitting at the instrument.
//
// The lifetime tally in history.ts answers "how many notes, on how many days"; it
// cannot answer "how long did I practise", which is the question a teacher asks and
// the one every practice journal is built around. A session carries both clocks
// because they measure different things and neither alone is honest:
//
//   `activeMs` is time actually spent playing — the summed length of the runs that
//   fed the session. It is what the player earned.
//   `end - start` is the wall-clock span from the first run to the last. It includes
//   the pauses between them, so it flatters, but it is what "I practised from six to
//   seven" means.
//
// A session recorded by hand (time at a piano Plinky never saw) sets both to the same
// figure and carries `manual`, so a report can say which minutes were measured and
// which were claimed.
export type PracticeSession = {
    start: number; // epoch ms
    end: number; // epoch ms, always >= start
    activeMs: number;
    notes: number;
    // Catalogue ids touched, in first-touch order, deduped and capped.
    pieces: string[];
    manual: boolean;
    mood: Mood | null;
    label: string;
};

// How the session felt, asked never and offered always — the scale exists so a
// player can annotate their own log, not so Plinky can score their mood. Ordered
// worst to best so a report can average it; "rough" is a legitimate entry and the
// copy must never treat it as a failure.
export const MOODS = ["rough", "slow", "steady", "good", "breakthrough"] as const;
export type Mood = (typeof MOODS)[number];

// Sessions oldest first. A bare array rather than a wrapper object: the shape is
// the whole value, and every reader wants it in order.
export type PracticeLog = PracticeSession[];

// A finished run, on its way into the log.
export type PracticePing = {
    at: number; // epoch ms the run ended
    activeMs: number;
    notes: number;
    pieceId?: string;
};

// Two runs closer together than this belong to the same sitting. Half an hour is
// long enough to survive making a cup of tea and short enough that this morning
// and this evening stay two sessions.
export const SESSION_GAP_MS = 30 * 60_000;

// A single sitting longer than this is a device left open, not practice. The span
// is clamped rather than the session dropped, so the runs inside it still count.
const MAX_SPAN_MS = 12 * 60 * 60_000;

// Enough sessions for years of daily practice, bounded so the log cannot grow
// without limit in a storage budget shared with the score library. Oldest go first;
// the lifetime aggregates that must never be pruned live in history.ts, which is
// one small number per calendar day and is deliberately uncapped.
const MAX_SESSIONS = 2000;
const MAX_PIECES = 24;
export const MAX_LABEL_LENGTH = 120;

// The longest single hand-logged sitting that will be accepted. A typo of "600"
// for "60" minutes would otherwise silently dominate every total in the report.
export const MAX_MANUAL_MINUTES = 600;

function clampNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanLabel(value: unknown): string {
    return typeof value === "string" ? value.slice(0, MAX_LABEL_LENGTH).trim() : "";
}

function cleanMood(value: unknown): Mood | null {
    return MOODS.includes(value as Mood) ? (value as Mood) : null;
}

function normalizeSession(raw: unknown): PracticeSession | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const value = raw as Record<string, unknown>;
    const start = clampNumber(value.start, 0);
    if (start <= 0) {
        return null;
    }
    // A stored end before its start (a clock moved backwards mid-session, a hand-edited
    // file) would make every duration negative and quietly subtract from the totals.
    const end = Math.min(Math.max(clampNumber(value.end, start), start), start + MAX_SPAN_MS);
    return {
        start,
        end,
        activeMs: Math.max(0, Math.min(clampNumber(value.activeMs, 0), MAX_SPAN_MS)),
        notes: Math.max(0, Math.floor(clampNumber(value.notes, 0))),
        pieces: Array.isArray(value.pieces)
            ? [...new Set(value.pieces.filter((id): id is string => typeof id === "string"))].slice(
                  0,
                  MAX_PIECES,
              )
            : [],
        manual: value.manual === true,
        mood: cleanMood(value.mood),
        label: cleanLabel(value.label),
    };
}

// Sorting on read rather than trusting the stored order keeps every reader — the
// fold below included, which only inspects the last entry — correct against a log
// that was hand-edited or merged from a restored backup.
function sortSessions(sessions: PracticeSession[]): PracticeLog {
    return [...sessions].sort((left, right) => left.start - right.start).slice(-MAX_SESSIONS);
}

export function parsePracticeLog(raw: string | null): PracticeLog {
    try {
        const parsed = JSON.parse(raw ?? "[]");
        if (!Array.isArray(parsed)) {
            return [];
        }
        return sortSessions(
            parsed
                .map(normalizeSession)
                .filter((session): session is PracticeSession => session !== null),
        );
    } catch {
        return [];
    }
}

function withPiece(pieces: string[], pieceId: string | undefined): string[] {
    if (!pieceId || pieces.includes(pieceId) || pieces.length >= MAX_PIECES) {
        return pieces;
    }
    return [...pieces, pieceId];
}

// Folds a finished run into the log, extending the sitting in progress or opening a
// new one. Returns the log unchanged when there is nothing to record, so a caller
// can skip the write.
//
// A new session starts at `at - activeMs` — the moment the run began — so a lone run
// contributes its real length rather than a zero-width span. Extending never moves
// `start`, which is what makes a session's span the sitting rather than the last run.
export function foldSession(
    log: PracticeLog,
    ping: PracticePing,
    gapMs: number = SESSION_GAP_MS,
): PracticeLog {
    const activeMs = Math.max(0, Math.min(clampNumber(ping.activeMs, 0), MAX_SPAN_MS));
    const notes = Math.max(0, Math.floor(clampNumber(ping.notes, 0)));
    const at = clampNumber(ping.at, 0);
    if (at <= 0 || (activeMs === 0 && notes === 0)) {
        return log;
    }

    const last = log.at(-1);
    // A hand-logged sitting is a claim about time away from Plinky; a run that lands
    // near it is separate practice and must not be absorbed into it.
    const extends_ =
        last !== undefined &&
        !last.manual &&
        at >= last.end &&
        at - last.end <= gapMs &&
        at - last.start <= MAX_SPAN_MS;

    if (!extends_) {
        const session: PracticeSession = {
            start: at - activeMs,
            end: at,
            activeMs,
            notes,
            pieces: withPiece([], ping.pieceId),
            manual: false,
            mood: null,
            label: "",
        };
        return [...log, session].slice(-MAX_SESSIONS);
    }

    const merged: PracticeSession = {
        ...last,
        // Extending normally leaves the start alone — that is what makes a session's span
        // the sitting rather than the last run. It moves only when the arriving run began
        // before it, which happens when the session was opened by a run that cleared
        // instantly and so recorded a zero-width span. Without this the summed playing
        // time can exceed the wall clock the session covers.
        start: Math.min(last.start, at - activeMs),
        end: at,
        activeMs: last.activeMs + activeMs,
        notes: last.notes + notes,
        pieces: withPiece(last.pieces, ping.pieceId),
    };
    return [...log.slice(0, -1), merged];
}

export type ManualEntry = {
    // Local calendar date the practice happened on.
    date: string;
    minutes: number;
    mood?: Mood | null;
    label?: string;
};

// Adds a sitting the player did away from Plinky. Anchored at noon on the given day
// so the session lands on that calendar date under any time zone — midnight would
// fall on the previous day for anyone east of UTC once read back through a local
// date key. Returns the log unchanged when the entry says nothing.
export function addManualSession(log: PracticeLog, entry: ManualEntry): PracticeLog {
    const minutes = Math.floor(clampNumber(entry.minutes, 0));
    if (!isDateKey(entry.date) || minutes <= 0 || minutes > MAX_MANUAL_MINUTES) {
        return log;
    }
    const start = Date.parse(`${entry.date}T12:00:00Z`);
    const activeMs = minutes * 60_000;
    const session: PracticeSession = {
        start,
        end: start + activeMs,
        activeMs,
        notes: 0,
        pieces: [],
        manual: true,
        mood: cleanMood(entry.mood),
        label: cleanLabel(entry.label),
    };
    return sortSessions([...log, session]);
}

export function removeSession(log: PracticeLog, start: number): PracticeLog {
    return log.filter((session) => session.start !== start);
}

// Annotates a recorded sitting. Passing null clears the mood, so a mis-tap is
// undoable — the log is the player's own record and every entry in it is editable.
export function setSessionMood(log: PracticeLog, start: number, mood: Mood | null): PracticeLog {
    return log.map((session) =>
        session.start === start ? { ...session, mood: cleanMood(mood) } : session,
    );
}

export type PracticeDay = {
    date: string;
    activeMs: number;
    notes: number;
    sessions: number;
};

export type PracticeReport = {
    from: string;
    to: string;
    sessions: number;
    manualSessions: number;
    activeMs: number;
    spanMs: number;
    notes: number;
    activeDays: number;
    // Every day in the range, oldest first, including the empty ones — a consistency
    // chart has to draw the gaps, and a day missing from the array would close one up.
    days: PracticeDay[];
    // Mean over the days actually practised, not over the range: dividing by calendar
    // days would report a shrinking session length for anyone who takes a week off,
    // which is exactly the shape of a streak reproach.
    averageMs: number;
    longestDay: PracticeDay | null;
    pieces: string[];
    moods: Record<Mood, number>;
};

// The calendar date a session belongs to: the day it started on. A sitting that runs
// past midnight counts wholly against the evening it began, which is how a player
// would describe it.
export function sessionDate(session: PracticeSession): string {
    return todayKey(new Date(session.start));
}

export function sessionsInRange(log: PracticeLog, from: string, to: string): PracticeLog {
    return log.filter((session) => {
        const date = sessionDate(session);
        return daysBetween(from, date) >= 0 && daysBetween(date, to) >= 0;
    });
}

const NO_MOODS: Record<Mood, number> = {
    rough: 0,
    slow: 0,
    steady: 0,
    good: 0,
    breakthrough: 0,
};

export function summarizeRange(log: PracticeLog, from: string, to: string): PracticeReport {
    const days = daysInRange(from, to);
    const byDate = new Map<string, PracticeDay>(
        days.map((date) => [date, { date, activeMs: 0, notes: 0, sessions: 0 }]),
    );
    const moods = { ...NO_MOODS };
    const pieces = new Set<string>();
    let sessions = 0;
    let manualSessions = 0;
    let activeMs = 0;
    let spanMs = 0;
    let notes = 0;

    for (const session of sessionsInRange(log, from, to)) {
        const day = byDate.get(sessionDate(session));
        if (!day) {
            continue;
        }
        day.activeMs += session.activeMs;
        day.notes += session.notes;
        day.sessions += 1;
        sessions += 1;
        manualSessions += session.manual ? 1 : 0;
        activeMs += session.activeMs;
        spanMs += session.end - session.start;
        notes += session.notes;
        if (session.mood) {
            moods[session.mood] += 1;
        }
        for (const piece of session.pieces) {
            pieces.add(piece);
        }
    }

    const ordered = days.map((date) => byDate.get(date) as PracticeDay);
    const practised = ordered.filter((day) => day.activeMs > 0 || day.sessions > 0);
    const longestDay = practised.reduce<PracticeDay | null>(
        (best, day) => (!best || day.activeMs > best.activeMs ? day : best),
        null,
    );

    return {
        from,
        to,
        sessions,
        manualSessions,
        activeMs,
        spanMs,
        notes,
        activeDays: practised.length,
        days: ordered,
        averageMs: practised.length === 0 ? 0 : Math.round(activeMs / practised.length),
        longestDay,
        pieces: [...pieces],
        moods,
    };
}

// Common ranges the report offers. Values are day counts back from today, so the
// report never has to reason about month lengths.
export const RANGE_DAYS = { week: 7, month: 30, quarter: 90, year: 365 } as const;
export type RangeKey = keyof typeof RANGE_DAYS;

// One row per session, for a player who wants their own log in a spreadsheet — and
// for the report a teacher asks to see. Durations are minutes because that is the
// unit the question is asked in.
export function practiceLogToCsv(
    log: PracticeLog,
    pieceTitle: (id: string) => string,
    // Renders an epoch timestamp for the sheet. Passed in because formatting a local
    // date belongs to the locale-aware layer, not here.
    formatTime: (at: number) => string,
): string {
    const header = ["Date", "Started", "Minutes", "Notes", "Logged", "Mood", "Note", "Pieces"];
    const rows = log.map((session) => [
        sessionDate(session),
        formatTime(session.start),
        String(Math.round(session.activeMs / 60_000)),
        String(session.notes),
        session.manual ? "by hand" : "measured",
        session.mood ?? "",
        session.label,
        session.pieces.map(pieceTitle).join("; "),
    ]);
    return toCsv([header, ...rows]);
}
