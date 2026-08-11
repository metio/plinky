// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { daysInRange } from "./dateKey";
import {
    addManualSession,
    foldSession,
    MAX_MANUAL_MINUTES,
    type PracticeLog,
    type PracticePing,
    parsePracticeLog,
    sessionDate,
    summarizeRange,
} from "./practiceSession";

const NOON = new Date(2026, 5, 23, 12, 0).getTime();

// Pings arrive in the order the runs finished, so the arbitrary generates gaps and
// accumulates them rather than generating independent timestamps.
const arbPings = fc
    .array(
        fc.record({
            gapMs: fc.integer({ min: 0, max: 4 * 60 * 60_000 }),
            activeMs: fc.integer({ min: 0, max: 20 * 60_000 }),
            notes: fc.nat({ max: 500 }),
            pieceId: fc.option(fc.constantFrom("alpha", "beta", "gamma"), { nil: undefined }),
        }),
        { maxLength: 40 },
    )
    .map((steps) => {
        let at = NOON;
        return steps.map((step): PracticePing => {
            at += step.gapMs;
            return {
                at,
                // A run cannot have begun before the previous one ended — you play one at
                // a time. Modelling that here is what lets the span invariant below hold;
                // an unconstrained generator would produce overlapping runs no device
                // could ever record.
                activeMs: Math.min(step.activeMs, step.gapMs),
                notes: step.notes,
                pieceId: step.pieceId,
            };
        });
    });

function foldAll(pings: PracticePing[]): PracticeLog {
    return pings.reduce<PracticeLog>((log, ping) => foldSession(log, ping), []);
}

describe("foldSession", () => {
    it("keeps every minute and every note the runs contributed", () => {
        fc.assert(
            fc.property(arbPings, (pings) => {
                const log = foldAll(pings);
                const recorded = pings.filter((ping) => ping.activeMs > 0 || ping.notes > 0);
                const sum = (values: number[]) => values.reduce((total, one) => total + one, 0);
                expect(sum(log.map((session) => session.activeMs))).toBe(
                    sum(recorded.map((ping) => ping.activeMs)),
                );
                expect(sum(log.map((session) => session.notes))).toBe(
                    sum(recorded.map((ping) => ping.notes)),
                );
            }),
        );
    });

    it("leaves a log ordered, non-overlapping and never longer than its own span", () => {
        fc.assert(
            fc.property(arbPings, (pings) => {
                const log = foldAll(pings);
                for (const [index, session] of log.entries()) {
                    expect(session.end).toBeGreaterThanOrEqual(session.start);
                    // A sitting can never claim more playing time than wall clock passed
                    // inside it — that is what makes both figures reportable side by side.
                    expect(session.activeMs).toBeLessThanOrEqual(session.end - session.start);
                    const previous = log[index - 1];
                    if (previous) {
                        expect(session.start).toBeGreaterThanOrEqual(previous.start);
                    }
                }
            }),
        );
    });

    it("survives a round trip through storage unchanged", () => {
        fc.assert(
            fc.property(arbPings, (pings) => {
                const log = foldAll(pings);
                expect(parsePracticeLog(JSON.stringify(log))).toEqual(log);
            }),
        );
    });
});

describe("summarizeRange", () => {
    const arbManual = fc.array(
        fc.record({
            date: fc.constantFrom("2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23"),
            minutes: fc.integer({ min: 1, max: MAX_MANUAL_MINUTES }),
        }),
        { maxLength: 12 },
    );

    it("totals exactly the sessions inside the range and nothing outside it", () => {
        fc.assert(
            fc.property(arbPings, arbManual, (pings, manual) => {
                const log = manual.reduce(addManualSession, foldAll(pings));
                const report = summarizeRange(log, "2026-06-20", "2026-06-23");
                const inRange = log.filter((session) =>
                    daysInRange("2026-06-20", "2026-06-23").includes(sessionDate(session)),
                );
                expect(report.sessions).toBe(inRange.length);
                expect(report.activeMs).toBe(
                    inRange.reduce((total, session) => total + session.activeMs, 0),
                );
            }),
        );
    });

    it("agrees with itself: the per-day totals add up to the range total", () => {
        fc.assert(
            fc.property(arbPings, arbManual, (pings, manual) => {
                const log = manual.reduce(addManualSession, foldAll(pings));
                const report = summarizeRange(log, "2026-06-20", "2026-06-23");
                expect(report.days.reduce((total, day) => total + day.activeMs, 0)).toBe(
                    report.activeMs,
                );
                expect(report.days.filter((day) => day.sessions > 0).length).toBe(
                    report.activeDays,
                );
            }),
        );
    });

    it("never reports more active days than the range holds", () => {
        fc.assert(
            fc.property(arbPings, (pings) => {
                const report = summarizeRange(foldAll(pings), "2026-06-20", "2026-06-23");
                expect(report.activeDays).toBeLessThanOrEqual(4);
                expect(report.averageMs * report.activeDays).toBeLessThanOrEqual(
                    report.activeMs + report.activeDays,
                );
            }),
        );
    });
});
