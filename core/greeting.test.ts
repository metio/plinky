// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { msUntilPartOfDayChanges, type PartOfDay, partOfDay } from "./greeting";

describe("partOfDay", () => {
    it("names each part at the hours a person would", () => {
        expect(partOfDay(7)).toBe("morning");
        expect(partOfDay(14)).toBe("afternoon");
        expect(partOfDay(20)).toBe("evening");
        expect(partOfDay(23)).toBe("night");
    });

    it("puts the small hours in the night, not in a very early morning", () => {
        // Somebody at the piano at two is not having a morning.
        expect(partOfDay(0)).toBe("night");
        expect(partOfDay(2)).toBe("night");
        expect(partOfDay(4)).toBe("night");
        expect(partOfDay(5)).toBe("morning");
    });

    it("turns over on the boundary rather than inside it", () => {
        expect(partOfDay(11)).toBe("morning");
        expect(partOfDay(12)).toBe("afternoon");
        expect(partOfDay(17)).toBe("afternoon");
        expect(partOfDay(18)).toBe("evening");
        expect(partOfDay(21)).toBe("evening");
        expect(partOfDay(22)).toBe("night");
    });

    it("names a part for every hour of the day, whole or not", () => {
        const named: PartOfDay[] = [];
        for (let hour = 0; hour < 24; hour += 0.5) {
            named.push(partOfDay(hour));
        }
        expect(named).toHaveLength(48);
        expect(new Set(named)).toEqual(new Set(["morning", "afternoon", "evening", "night"]));
    });
});

describe("waiting for the greeting to change", () => {
    const at = (hour: number, minute = 0) => new Date(2026, 7, 25, hour, minute, 0, 0);

    it("waits until the next boundary, not a fixed interval", () => {
        // 09:30 is morning; the next thing to say is afternoon, at noon.
        expect(msUntilPartOfDayChanges(at(9, 30))).toBe(2.5 * 60 * 60 * 1000);
        expect(msUntilPartOfDayChanges(at(17, 45))).toBe(15 * 60 * 1000);
    });

    it("carries over midnight, where the next boundary is tomorrow's", () => {
        // Night runs from 22:00 to 05:00, so at eleven the next change is six hours off.
        expect(msUntilPartOfDayChanges(at(23))).toBe(6 * 60 * 60 * 1000);
        expect(msUntilPartOfDayChanges(at(2))).toBe(3 * 60 * 60 * 1000);
    });

    it("never waits for nothing", () => {
        // Standing exactly on a boundary, the answer is the NEXT one — a wait of zero
        // would fire straight back into itself.
        for (const hour of [5, 12, 18, 22, 0]) {
            expect(msUntilPartOfDayChanges(at(hour))).toBeGreaterThan(0);
        }
    });

    it("agrees with what the greeting actually reads", () => {
        // The wait and the reading are the same list of hours, so waiting it out has to
        // land on a different answer. Anything else is a timer that fires and changes
        // nothing.
        for (let hour = 0; hour < 24; hour++) {
            const from = at(hour, 30);
            const later = new Date(from.getTime() + msUntilPartOfDayChanges(from));
            expect(partOfDay(later.getHours())).not.toBe(partOfDay(from.getHours()));
        }
    });
});
