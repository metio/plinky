// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { todayKey } from "./daily";
import type { History } from "./history";
import {
    inScope,
    type Scope,
    scopeDays,
    scopeStart,
    scopeSummary,
    weekSeries,
} from "./statsScope";

// Any day within a few years either side of the clock, so windows are sometimes empty,
// sometimes full, and the future is well represented.
const dateKey = fc
    .date({
        min: new Date("2023-01-01T00:00:00Z"),
        max: new Date("2029-12-31T00:00:00Z"),
        // fc.date() puts an Invalid Date in its domain even between bounds, and these
        // properties are about real clocks: an invalid one has no today for a window to
        // cover, so it fails an assertion that is right about every date there is.
        noInvalidDate: true,
    })
    .map((at) => todayKey(at));

const history = fc
    .array(fc.tuple(dateKey, fc.integer({ min: 0, max: 5000 })), { maxLength: 60 })
    .map((pairs) => Object.fromEntries(pairs) as History);

const clock = fc.date({
    min: new Date("2024-01-01T00:00:00Z"),
    max: new Date("2029-12-31T00:00:00Z"),
    noInvalidDate: true,
});

const NARROWER: [Scope, Scope][] = [
    ["week", "month"],
    ["month", "year"],
    ["year", "all"],
];

describe("the week's day series", () => {
    it("is exactly the days the week scope counts, in order, ending today", () => {
        fc.assert(
            fc.property(history, clock, (log, now) => {
                const series = weekSeries(log, now);
                expect(series.length).toBe(scopeDays("week", now));
                expect(series.at(-1)?.date).toBe(todayKey(now));
                for (const [at, day] of series.entries()) {
                    expect(inScope(day.date, "week", now)).toBe(true);
                    if (at > 0) {
                        expect(day.date > series[at - 1].date).toBe(true);
                    }
                }
                // What the bars add up to is what the tile above them reports.
                const notes = series.reduce((sum, day) => sum + day.notes, 0);
                expect(notes).toBe(scopeSummary(log, "week", now).totalNotes);
            }),
        );
    });
});

describe("scope windows", () => {
    it("nest: anything a narrow scope counts, a wider one counts too", () => {
        // The property the whole dial rests on. A reader moving the dial outwards expects
        // the figures to grow, and a week that reported more than its month would read as
        // a bug in the numbers rather than in the windows.
        fc.assert(
            fc.property(history, clock, (log, now) => {
                for (const [narrow, wide] of NARROWER) {
                    const inner = scopeSummary(log, narrow, now);
                    const outer = scopeSummary(log, wide, now);
                    expect(inner.totalNotes).toBeLessThanOrEqual(outer.totalNotes);
                    expect(inner.daysPracticed).toBeLessThanOrEqual(outer.daysPracticed);
                }
            }),
        );
    });

    it("never counts a day that has not happened", () => {
        fc.assert(
            fc.property(dateKey, clock, (date, now) => {
                if (date > todayKey(now)) {
                    for (const scope of ["week", "month", "year", "all"] as Scope[]) {
                        expect(inScope(date, scope, now)).toBe(false);
                    }
                }
            }),
        );
    });

    it("covers at least today, so nothing ever divides by an empty window", () => {
        fc.assert(
            fc.property(clock, (now) => {
                for (const scope of ["week", "month", "year"] as Scope[]) {
                    const days = scopeDays(scope, now);
                    expect(days).not.toBeNull();
                    expect(days ?? 0).toBeGreaterThanOrEqual(1);
                    expect(inScope(todayKey(now), scope, now)).toBe(true);
                    // The start is a real date key that is not in the future. Compared as
                    // strings, which is exactly how inScope compares them.
                    const start = scopeStart(scope, now) ?? "";
                    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                    expect(start <= todayKey(now)).toBe(true);
                }
            }),
        );
    });

    it("reports a best day that is one of the days it counted", () => {
        fc.assert(
            fc.property(history, clock, (log, now) => {
                for (const scope of ["week", "month", "year", "all"] as Scope[]) {
                    const { bestDay, daysPracticed, totalNotes } = scopeSummary(log, scope, now);
                    if (bestDay === null) {
                        expect(daysPracticed).toBe(0);
                        expect(totalNotes).toBe(0);
                        continue;
                    }
                    expect(inScope(bestDay.date, scope, now)).toBe(true);
                    expect(log[bestDay.date]).toBe(bestDay.notes);
                    // Nobody's biggest day is bigger than everything they played.
                    expect(bestDay.notes).toBeLessThanOrEqual(totalNotes);
                }
            }),
        );
    });
});
