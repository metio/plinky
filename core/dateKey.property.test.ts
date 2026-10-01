// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    DAY_MS,
    daysBetween,
    daysInRange,
    isDateKey,
    MAX_RANGE_DAYS,
    shiftDay,
    weekdayIndex,
} from "./dateKey";

// Arithmetic over the calendar keys every tally, report and challenge is filed under.
// The failures here are the ones a player would read as lost work: a day that counts
// twice, a day that vanishes, a report whose range never terminates. Each of them is a
// time-zone or daylight-saving question, so the generators go looking for those dates
// on purpose rather than hoping a random one lands on a boundary.

const arbKey = fc
    .integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2032, 11, 31) })
    .map((at) => new Date(at - (at % DAY_MS)).toISOString().slice(0, 10));

// The days clocks change on, in both hemispheres, plus the ends of months and years —
// where adding twenty-four hours and adding a day part company.
const arbAwkwardKey = fc.constantFrom(
    "2026-03-28",
    "2026-03-29",
    "2026-03-30",
    "2026-10-24",
    "2026-10-25",
    "2026-10-26",
    "2026-02-28",
    "2024-02-28",
    "2024-02-29",
    "2026-12-31",
    "2027-01-01",
    "2026-11-01",
);
const arbAnyKey = fc.oneof(arbKey, arbAwkwardKey);
const arbDelta = fc.integer({ min: -800, max: 800 });

// A corrupt stored key, or a hand-typed one. These two behave differently and the
// difference is worth stating: a key the parser cannot read at all comes back untouched,
// while one that parses into a day the calendar does not have is normalised onto the day
// it rolls into. Only the strict check tells them apart, which is why the range helper
// uses it on both ends.
const UNREADABLE = ["", "today", "2026-13-01", "2026-00-10", "26-01-01", "2026-1-1", "NaN-NaN-NaN"];
const NOT_ON_THE_CALENDAR = ["2026-02-29", "2026-02-31", "2026-04-31"];

describe("moving between calendar days", () => {
    it("comes back to the day it started from", () => {
        fc.assert(
            fc.property(arbAnyKey, arbDelta, (key, delta) => {
                expect(shiftDay(shiftDay(key, delta), -delta)).toBe(key);
                expect(shiftDay(key, 0)).toBe(key);
            }),
        );
    });

    it("advances exactly one calendar day across a clock change", () => {
        fc.assert(
            fc.property(arbAnyKey, arbDelta, (key, delta) => {
                // The keys are local dates, so re-reading one as a local timestamp would
                // land a day either side of midnight for some offsets, and adding
                // twenty-four hours across a daylight-saving change would skip or repeat
                // a day. Both show up as a count that disagrees with the shift.
                expect(daysBetween(key, shiftDay(key, delta))).toBe(delta);
            }),
        );
    });

    it("keeps a shifted day a real day", () => {
        fc.assert(
            fc.property(arbAnyKey, arbDelta, (key, delta) => {
                expect(isDateKey(shiftDay(key, delta))).toBe(true);
            }),
        );
    });

    it("measures a gap the same both ways round", () => {
        fc.assert(
            fc.property(arbAnyKey, arbAnyKey, (from, to) => {
                // Stated as a sum so the two directions cancel: a gap of zero is
                // signless, and +0 is not -0 as far as an identity check is concerned.
                expect(daysBetween(from, to) + daysBetween(to, from)).toBe(0);
                expect(daysBetween(from, from)).toBe(0);
            }),
        );
    });

    it("names the weekday the week itself names", () => {
        fc.assert(
            fc.property(arbAnyKey, (key) => {
                const index = weekdayIndex(key);

                expect(index).toBeGreaterThanOrEqual(0);
                expect(index).toBeLessThanOrEqual(6);
                // A week later is the same weekday; a day later is the next one.
                expect(weekdayIndex(shiftDay(key, 7))).toBe(index);
                expect(weekdayIndex(shiftDay(key, 1))).toBe((index + 1) % 7);
            }),
        );
    });

    it("leaves a key it cannot read alone", () => {
        fc.assert(
            fc.property(fc.constantFrom(...UNREADABLE), arbDelta, (junk, delta) => {
                // A corrupt key that turned into "NaN-NaN-NaN" would seed a range that
                // never terminates, so it comes back untouched instead.
                expect(shiftDay(junk, delta)).toBe(junk);
                expect(daysBetween(junk, "2026-01-01")).toBe(0);
                expect(isDateKey(junk)).toBe(false);
            }),
        );
    });

    it("rolls a day the calendar does not have onto the one it means", () => {
        fc.assert(
            fc.property(fc.constantFrom(...NOT_ON_THE_CALENDAR), (fake) => {
                expect(isDateKey(fake)).toBe(false);
                // It parses, so the arithmetic runs on the day it rolls into — the 29th
                // of a February with 28 days is the 1st of March.
                expect(isDateKey(shiftDay(fake, 0))).toBe(true);
                expect(shiftDay(fake, 0)).not.toBe(fake);
            }),
        );
    });

    it("builds no range from a key that is not a day", () => {
        fc.assert(
            fc.property(fc.constantFrom(...UNREADABLE, ...NOT_ON_THE_CALENDAR), (junk) => {
                // Both ends go through the strict check, so neither kind of bad key
                // can seed a report.
                expect(daysInRange(junk, "2026-01-01")).toEqual([]);
                expect(daysInRange("2026-01-01", junk)).toEqual([]);
            }),
        );
    });
});

describe("a range of days", () => {
    it("holds every day from one end to the other, once, in order", () => {
        fc.assert(
            fc.property(arbAnyKey, fc.integer({ min: 0, max: 400 }), (from, span) => {
                const to = shiftDay(from, span);

                const days = daysInRange(from, to);

                expect(days.length).toBe(span + 1);
                expect(days[0]).toBe(from);
                expect(days[days.length - 1]).toBe(to);
                expect(new Set(days).size).toBe(days.length);
                expect([...days].sort()).toEqual(days);
                for (const day of days) {
                    expect(isDateKey(day)).toBe(true);
                }
            }),
        );
    });

    it("gives nothing for a range that runs backwards or too far", () => {
        fc.assert(
            fc.property(arbAnyKey, fc.integer({ min: 1, max: 400 }), (from, span) => {
                expect(daysInRange(shiftDay(from, span), from)).toEqual([]);
                // The cap is what bounds the allocation a stored range can ask for.
                expect(daysInRange(from, shiftDay(from, MAX_RANGE_DAYS + span))).toEqual([]);
                expect(daysInRange(from, shiftDay(from, MAX_RANGE_DAYS)).length).toBe(
                    MAX_RANGE_DAYS + 1,
                );
            }),
        );
    });
});

describe("what counts as a day", () => {
    it("accepts the days a calendar has and refuses the rest", () => {
        fc.assert(
            fc.property(arbAnyKey, (key) => {
                expect(isDateKey(key)).toBe(true);
            }),
        );
        // Parsing alone is too lax: "2026-02-31" parses by rolling into March, which is
        // how a stored key for a day that never existed used to survive a reload.
        expect(isDateKey("2026-02-31")).toBe(false);
        expect(isDateKey("2024-02-29")).toBe(true);
        expect(isDateKey("2026-02-29")).toBe(false);
    });
});
