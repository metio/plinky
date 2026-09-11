// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    type AchievementFacts,
    collectAchievements,
    NO_BADGE_MARKS,
    normalizeBadgeMarks,
    raiseBadgeMarks,
    starsThrough,
} from "./achievements";

describe("badge marks", () => {
    it("raises the star to a higher tier and never lowers it", () => {
        const bronze = raiseBadgeMarks(NO_BADGE_MARKS, { star: "bronze", earMastered: false });
        expect(bronze.star).toBe("bronze");
        expect(raiseBadgeMarks(bronze, { star: null, earMastered: false }).star).toBe("bronze");
        expect(raiseBadgeMarks(bronze, { star: "gold", earMastered: false }).star).toBe("gold");
        const gold = { star: "gold" as const, earMastered: false };
        expect(raiseBadgeMarks(gold, { star: "silver", earMastered: false }).star).toBe("gold");
    });

    it("latches the ear-mastered mark", () => {
        const mastered = raiseBadgeMarks(NO_BADGE_MARKS, { star: null, earMastered: true });
        expect(mastered.earMastered).toBe(true);
        expect(raiseBadgeMarks(mastered, NO_BADGE_MARKS).earMastered).toBe(true);
    });

    it("hands back the kept marks themselves when nothing is new", () => {
        const kept = { star: "silver" as const, earMastered: true };
        expect(raiseBadgeMarks(kept, { star: "bronze", earMastered: false })).toBe(kept);
    });

    it("earns every tier up to the best one held", () => {
        expect(starsThrough(null)).toEqual(new Set());
        expect(starsThrough("bronze")).toEqual(new Set(["bronze"]));
        expect(starsThrough("gold")).toEqual(new Set(["bronze", "silver", "gold"]));
    });

    it("reads anything unrecognised as no marks", () => {
        expect(normalizeBadgeMarks(null)).toEqual(NO_BADGE_MARKS);
        expect(normalizeBadgeMarks({ star: "platinum", earMastered: "yes" })).toEqual(
            NO_BADGE_MARKS,
        );
        expect(normalizeBadgeMarks({ star: "silver", earMastered: true })).toEqual({
            star: "silver",
            earMastered: true,
        });
    });
});

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
        const earned = new Set(badges.filter((badge) => badge.earned).map((badge) => badge.id));
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
