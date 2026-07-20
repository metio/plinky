// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type AchievementFacts, collectAchievements } from "./achievements";

const NOTHING: AchievementFacts = {
    reachedGrade: 0,
    hasS: false,
    flawless: false,
    stars: new Set(),
    daysPracticed: 0,
    totalNotes: 0,
    earTrained: false,
    earFlawless: false,
    earMastered: false,
};

describe("collectAchievements", () => {
    it("lays out the full set unearned for a fresh player", () => {
        const badges = collectAchievements(NOTHING);
        // 8 grades + 3 stars + first S + flawless + 2 day + 2 note + 3 ear badges.
        expect(badges).toHaveLength(20);
        expect(badges.every((badge) => !badge.earned)).toBe(true);
    });

    it("earns every grade badge up to the highest ever reached", () => {
        const badges = collectAchievements({ ...NOTHING, reachedGrade: 3 });
        const grades = badges.filter((badge) => badge.kind === "grade");
        expect(grades.filter((badge) => badge.earned).map((badge) => badge.id)).toEqual([
            "grade-1",
            "grade-2",
            "grade-3",
        ]);
    });

    it("marks the counting badges at their thresholds", () => {
        const badges = collectAchievements({
            ...NOTHING,
            daysPracticed: 10,
            totalNotes: 9_999,
        });
        const earned = badges.filter((badge) => badge.earned).map((badge) => badge.id);
        expect(earned).toContain("days-10");
        expect(earned).not.toContain("days-100");
        expect(earned).toContain("notes-1000");
        expect(earned).not.toContain("notes-10000");
    });

    it("carries the moment badges through directly", () => {
        const badges = collectAchievements({
            ...NOTHING,
            hasS: true,
            flawless: true,
            stars: new Set(["bronze", "gold"]),
        });
        const earned = new Set(
            badges.filter((badge) => badge.earned).map((badge) => badge.id),
        );
        expect(earned).toEqual(new Set(["first-s", "flawless", "star-bronze", "star-gold"]));
    });

    it("earns each ear badge from its own fact", () => {
        const earnedIds = (facts: Partial<AchievementFacts>) =>
            new Set(
                collectAchievements({ ...NOTHING, ...facts })
                    .filter((badge) => badge.kind === "ear" && badge.earned)
                    .map((badge) => badge.id),
            );
        expect(earnedIds({ earTrained: true })).toEqual(new Set(["ear-first"]));
        expect(earnedIds({ earFlawless: true })).toEqual(new Set(["ear-flawless"]));
        expect(earnedIds({ earMastered: true })).toEqual(new Set(["ear-mastered"]));
    });
});
