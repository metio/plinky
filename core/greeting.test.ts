// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type PartOfDay, partOfDay } from "./greeting";

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
