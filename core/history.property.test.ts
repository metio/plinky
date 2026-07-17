// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { foldPractice, type History, parseHistory, summarizePractice } from "./history";

// The tally behind the grade badge, the Today panel and the You page. These pin
// conservation (no note is lost or invented) and the seven-day window's shape
// over arbitrary histories, dates and run sizes.

// Bounded a few days inside the key range, so a seven-day window reaching back from
// any generated day still lands on representable dates.
const anyDate = fc.date({
    min: new Date("2020-01-05T00:00:00Z"),
    max: new Date("2030-12-25T00:00:00Z"),
    noInvalidDate: true,
});

const dateKey = fc
    .date({
        min: new Date("2020-01-01T00:00:00Z"),
        max: new Date("2030-12-31T00:00:00Z"),
        noInvalidDate: true,
    })
    .map((date) => date.toISOString().slice(0, 10));

const historyArb: fc.Arbitrary<History> = fc.dictionary(
    dateKey,
    fc.integer({ min: 1, max: 5000 }),
    { maxKeys: 30 },
);

const total = (history: History) => Object.values(history).reduce((sum, n) => sum + n, 0);

describe("history properties", () => {
    it("conserves every note across a fold: total grows by exactly the run's count", () => {
        fc.assert(
            fc.property(historyArb, fc.integer({ min: 1, max: 10_000 }), fc.date({ noInvalidDate: true }), (history, notes, now) => {
                expect(total(foldPractice(history, notes, now))).toBe(total(history) + notes);
            }),
        );
    });

    it("records nothing for an empty or aborted run", () => {
        fc.assert(
            fc.property(historyArb, fc.integer({ min: -10_000, max: 0 }), fc.date({ noInvalidDate: true }), (history, notes, now) => {
                expect(foldPractice(history, notes, now)).toBe(history);
            }),
        );
    });

    it("summarizes exactly seven consecutive days ending today", () => {
        fc.assert(
            fc.property(
                historyArb,
                anyDate,
                (history, now) => {
                    const { recent } = summarizePractice(history, now);
                    expect(recent).toHaveLength(7);
                    // Consecutive calendar days, one apart, oldest first.
                    for (let i = 1; i < recent.length; i++) {
                        const previous = new Date(`${recent[i - 1]?.date}T00:00:00Z`).getTime();
                        const current = new Date(`${recent[i]?.date}T00:00:00Z`).getTime();
                        expect(current - previous).toBe(24 * 60 * 60 * 1000);
                    }
                    // Every shown tally is the history's own number (or zero).
                    for (const day of recent) {
                        expect(day.notes).toBe(history[day.date] ?? 0);
                    }
                },
            ),
        );
    });

    it("counts days practiced as the days with a positive tally, whatever day it is", () => {
        fc.assert(
            fc.property(historyArb, anyDate, (history, now) => {
                // The lifetime aggregates span the whole map, so the day they are read
                // on cannot move them — only the seven-day window follows the clock.
                const { daysPracticed, totalNotes } = summarizePractice(history, now);
                expect(daysPracticed).toBe(Object.values(history).filter((n) => n > 0).length);
                expect(totalNotes).toBe(total(history));
            }),
        );
    });

    it("never throws on arbitrary stored strings, reading garbage as empty", () => {
        fc.assert(
            fc.property(fc.string(), (raw) => {
                expect(() => parseHistory(raw)).not.toThrow();
            }),
        );
    });
});
