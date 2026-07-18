// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { EAR_ITEMS, earItemFor } from "./earCatalog";
import { CHORD_LEVELS, INTERVAL_LEVELS, PROGRESSION_LEVELS, SCALE_LEVELS } from "./earExercise";
import { MAX_GRADE } from "./scoreDifficulty";

describe("ear catalogue", () => {
    it("carries one item per level of each laddered exercise, plus perfect pitch", () => {
        const count = (exercise: string) =>
            EAR_ITEMS.filter((item) => item.exercise === exercise).length;
        expect(count("intervals")).toBe(INTERVAL_LEVELS.length);
        expect(count("chords")).toBe(CHORD_LEVELS.length);
        expect(count("scales")).toBe(SCALE_LEVELS.length);
        expect(count("progressions")).toBe(PROGRESSION_LEVELS.length);
        expect(count("perfect-pitch")).toBe(1);
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

    it("never lowers the grade as the levels of a laddered exercise climb", () => {
        for (const exercise of ["intervals", "chords", "scales", "progressions"]) {
            const items = EAR_ITEMS.filter((item) => item.exercise === exercise).sort(
                (a, b) => (a.level ?? 0) - (b.level ?? 0),
            );
            for (let i = 1; i < items.length; i++) {
                expect(items[i]!.grade).toBeGreaterThanOrEqual(items[i - 1]!.grade);
            }
        }
    });

    it("resolves a laddered session to its level's item", () => {
        expect(earItemFor("intervals", 0)?.id).toBe("ear-intervals-0");
        expect(earItemFor("chords", 2)?.id).toBe("ear-chords-2");
        expect(earItemFor("scales", 3)?.id).toBe("ear-scales-3");
        expect(earItemFor("progressions", 1)?.id).toBe("ear-progressions-1");
    });

    it("resolves a perfect-pitch session whatever level is passed", () => {
        expect(earItemFor("perfect-pitch", 0)?.id).toBe("ear-perfect-pitch");
        expect(earItemFor("perfect-pitch", 3)?.id).toBe("ear-perfect-pitch");
    });
});
