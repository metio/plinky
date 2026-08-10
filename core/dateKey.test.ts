// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { daysBetween, daysInRange, isDateKey, shiftDay } from "./dateKey";

describe("shiftDay", () => {
    it("moves forward and back", () => {
        expect(shiftDay("2026-06-23", 1)).toBe("2026-06-24");
        expect(shiftDay("2026-06-23", -1)).toBe("2026-06-22");
        expect(shiftDay("2026-06-23", 0)).toBe("2026-06-23");
    });

    it("crosses month, year and leap-day boundaries", () => {
        expect(shiftDay("2026-06-30", 1)).toBe("2026-07-01");
        expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
        expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    });

    it("returns a key it cannot parse unchanged rather than NaN", () => {
        expect(shiftDay("not-a-date", 1)).toBe("not-a-date");
    });
});

describe("daysBetween", () => {
    it("counts whole days, signed", () => {
        expect(daysBetween("2026-06-23", "2026-06-30")).toBe(7);
        expect(daysBetween("2026-06-30", "2026-06-23")).toBe(-7);
        expect(daysBetween("2026-06-23", "2026-06-23")).toBe(0);
    });

    it("spans a daylight-saving change exactly", () => {
        // Europe/Berlin springs forward on 2026-03-29; local-clock arithmetic would
        // report 6 days and 23 hours here and round to the wrong day.
        expect(daysBetween("2026-03-28", "2026-04-04")).toBe(7);
    });
});

describe("daysInRange", () => {
    it("includes both ends, oldest first", () => {
        expect(daysInRange("2026-06-23", "2026-06-26")).toEqual([
            "2026-06-23",
            "2026-06-24",
            "2026-06-25",
            "2026-06-26",
        ]);
    });

    it("is empty for an inverted or unparsable range", () => {
        expect(daysInRange("2026-06-26", "2026-06-23")).toEqual([]);
        expect(daysInRange("nonsense", "2026-06-23")).toEqual([]);
    });

    it("refuses a range wider than the cap so a corrupt bound can't allocate freely", () => {
        expect(daysInRange("1900-01-01", "2026-06-23")).toEqual([]);
    });
});

describe("isDateKey", () => {
    it("accepts a real calendar date", () => {
        expect(isDateKey("2026-06-23")).toBe(true);
        expect(isDateKey("2028-02-29")).toBe(true);
    });

    it("rejects a date that only parses by rolling over", () => {
        expect(isDateKey("2026-02-31")).toBe(false);
        expect(isDateKey("2026-13-01")).toBe(false);
    });

    it("rejects anything that is not the canonical shape", () => {
        expect(isDateKey("2026-6-23")).toBe(false);
        expect(isDateKey("23/06/2026")).toBe(false);
        expect(isDateKey("")).toBe(false);
    });
});
