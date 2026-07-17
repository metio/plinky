// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { EAR_ITEMS, earItemFor } from "./earCatalog";
import { INTERVAL_LEVELS } from "./earExercise";
import { MAX_GRADE } from "./scoreDifficulty";

describe("ear catalogue", () => {
    it("carries one item per interval level plus perfect pitch", () => {
        expect(EAR_ITEMS.filter((item) => item.exercise === "intervals")).toHaveLength(
            INTERVAL_LEVELS.length,
        );
        expect(EAR_ITEMS.filter((item) => item.exercise === "perfect-pitch")).toHaveLength(1);
    });

    it("gives every item a unique id the catalogue recognises as an ear item", () => {
        const ids = EAR_ITEMS.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(id.startsWith("ear-")).toBe(true);
        }
    });

    it("keeps every grade on the ladder and every cost positive", () => {
        for (const item of EAR_ITEMS) {
            expect(item.grade).toBeGreaterThanOrEqual(1);
            expect(item.grade).toBeLessThanOrEqual(MAX_GRADE);
            expect(item.cost).toBeGreaterThan(0);
        }
    });

    it("climbs in grade as the interval levels get harder", () => {
        const intervals = EAR_ITEMS.filter((item) => item.exercise === "intervals").sort(
            (a, b) => (a.level ?? 0) - (b.level ?? 0),
        );
        for (let i = 1; i < intervals.length; i++) {
            expect(intervals[i]!.grade).toBeGreaterThan(intervals[i - 1]!.grade);
        }
    });

    it("resolves an interval session to its level's item", () => {
        expect(earItemFor("intervals", 0)?.id).toBe("ear-intervals-0");
        expect(earItemFor("intervals", 2)?.id).toBe("ear-intervals-2");
    });

    it("resolves a perfect-pitch session whatever level is passed", () => {
        expect(earItemFor("perfect-pitch", 0)?.id).toBe("ear-perfect-pitch");
        expect(earItemFor("perfect-pitch", 3)?.id).toBe("ear-perfect-pitch");
    });

});
