// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    currentGrade,
    dueReviews,
    type GradeCatalogItem,
    type GradedMastery,
    gradeFreshness,
    gradeSuggestions,
    masteredInGrade,
    nextStar,
    poolSizes,
    skillRating,
    starTier,
} from "./gradeProgress";
import type { Mastery } from "./mastery";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

function mastery(partial: Partial<Mastery> = {}): Mastery {
    return {
        bestScore: 80,
        learned: true,
        backlog: false,
        intervalDays: 10,
        reviewAt: NOW + 5 * DAY, // fresh: due in the future
        updatedAt: NOW,
        ...partial,
    };
}

// A learned, fresh piece (not due).
const fresh = (overrides: Partial<Mastery> = {}) => mastery(overrides);
// A learned piece due for review but within the lapse grace.
const due = () => mastery({ intervalDays: 10, reviewAt: NOW - 2 * DAY });
// A learned piece overdue past the grace.
const lapsed = () => mastery({ intervalDays: 10, reviewAt: NOW - 20 * DAY });

function item(id: string, grade: number, cost: number, m: Mastery): GradedMastery {
    return { id, title: id, grade, cost, mastery: m };
}

function learnedGrade(grade: number, count: number): GradedMastery[] {
    return Array.from({ length: count }, (_, i) => item(`g${grade}-${i}`, grade, grade, fresh()));
}

describe("masteredInGrade", () => {
    it("counts learned pieces of the grade", () => {
        const items = [...learnedGrade(3, 4), item("other", 4, 4, fresh())];
        expect(masteredInGrade(items, 3, "gentle", NOW)).toBe(4);
    });

    it("ignores not-learned and shelved pieces", () => {
        const items = [
            item("a", 2, 1, fresh()),
            item("b", 2, 1, fresh({ learned: false })),
            item("c", 2, 1, fresh({ backlog: true })),
        ];
        expect(masteredInGrade(items, 2, "gentle", NOW)).toBe(1);
    });

    it("drops a lapsed piece only in competitive mode", () => {
        const items = [item("a", 5, 1, fresh()), item("b", 5, 1, lapsed())];
        expect(masteredInGrade(items, 5, "gentle", NOW)).toBe(2);
        expect(masteredInGrade(items, 5, "competitive", NOW)).toBe(1);
    });
});

describe("starTier", () => {
    it("maps mastered count to a tier at 5/12/25", () => {
        expect(starTier(4)).toBe("none");
        expect(starTier(5)).toBe("bronze");
        expect(starTier(12)).toBe("silver");
        expect(starTier(24)).toBe("silver");
        expect(starTier(25)).toBe("gold");
    });
});

describe("currentGrade", () => {
    it("is the highest grade with two pieces played at B or better", () => {
        const items = [...learnedGrade(1, 3), ...learnedGrade(2, 2)];
        expect(currentGrade(items)).toBe(2);
    });

    it("skips ahead — a higher grade played well counts despite gaps below", () => {
        // Nothing in grades 1–4, but two Grade 5 pieces played well.
        expect(currentGrade(learnedGrade(5, 2))).toBe(5);
    });

    it("needs two — one well-played piece doesn't promote", () => {
        expect(currentGrade(learnedGrade(3, 1))).toBe(0);
    });

    it("ignores pieces played below the ability bar", () => {
        const items = [
            item("a", 2, 2, fresh({ bestScore: 70 })), // a C, below B
            item("b", 2, 2, fresh({ bestScore: 80 })),
        ];
        expect(currentGrade(items)).toBe(0);
    });

    it("is zero before any grade is earned", () => {
        expect(currentGrade(learnedGrade(1, 1))).toBe(0);
    });
});

describe("gradeFreshness", () => {
    it("reports mastered and how many want a refresh", () => {
        const items = [item("a", 4, 1, fresh()), item("b", 4, 1, due()), item("c", 4, 1, due())];
        expect(gradeFreshness(items, 4, "gentle", NOW)).toEqual({ mastered: 3, due: 2 });
    });
});

describe("dueReviews", () => {
    it("returns due pieces most-overdue first, capped", () => {
        const items = [
            item("soon", 1, 1, mastery({ reviewAt: NOW - 1 * DAY })),
            item("oldest", 1, 1, mastery({ reviewAt: NOW - 30 * DAY })),
            item("mid", 1, 1, mastery({ reviewAt: NOW - 5 * DAY })),
            item("fresh", 1, 1, fresh()),
        ];
        expect(dueReviews(items, NOW)).toEqual(["oldest", "mid", "soon"]);
        expect(dueReviews(items, NOW, 1)).toEqual(["oldest"]);
    });
});

describe("skillRating", () => {
    it("averages the hardest ten mastered costs, scaled by 100", () => {
        const items = [
            item("a", 8, 3, fresh()),
            item("b", 8, 2, fresh()),
            item("c", 8, 1, fresh()),
        ];
        expect(skillRating(items, "gentle", NOW)).toBe(200); // mean(3,2,1)=2 → 200
    });

    it("ranks by the hardest pieces, not the most pieces", () => {
        const easy = Array.from({ length: 20 }, (_, i) => item(`e${i}`, 2, 1, fresh()));
        const hard = [item("h", 8, 11, fresh())];
        // Top 10 of {one 11, nineteen-plus 1s} = [11,1,1,1,1,1,1,1,1,1] → mean 2 → 200.
        expect(skillRating([...easy, ...hard], "gentle", NOW)).toBe(200);
    });

    it("eases down in competitive mode as pieces lapse", () => {
        const items = [item("a", 8, 5, fresh()), item("b", 8, 1, lapsed())];
        expect(skillRating(items, "gentle", NOW)).toBe(300); // mean(5,1)=3
        expect(skillRating(items, "competitive", NOW)).toBe(500); // only the fresh 5 counts
    });

    it("is zero with nothing mastered", () => {
        expect(skillRating([], "gentle", NOW)).toBe(0);
    });
});

const cat = (id: string, grade: number, cost: number): GradeCatalogItem => ({
    id,
    title: id,
    grade,
    cost,
});

describe("nextStar", () => {
    it("points at the next tier and how many more reach it", () => {
        expect(nextStar(0)).toEqual({ tier: "bronze", remaining: 5 });
        expect(nextStar(4)).toEqual({ tier: "bronze", remaining: 1 });
        expect(nextStar(5)).toEqual({ tier: "silver", remaining: 7 });
        expect(nextStar(12)).toEqual({ tier: "gold", remaining: 13 });
    });

    it("is null once Gold is held", () => {
        expect(nextStar(25)).toBeNull();
    });
});

describe("gradeSuggestions", () => {
    it("offers the gentlest not-yet-mastered pieces of the grade, easiest first", () => {
        const catalogue = [
            cat("hard", 3, 3),
            cat("easy", 3, 1),
            cat("mid", 3, 2),
            cat("done", 3, 0.5),
            cat("other", 4, 1),
        ];
        const suggestions = gradeSuggestions(catalogue, 3, new Set(["done"]), 2);
        expect(suggestions.map((item) => item.id)).toEqual(["easy", "mid"]);
    });

    it("treats an unmeasured cost (0) as hardest, so it isn't suggested first", () => {
        const catalogue = [cat("zero", 1, 0), cat("real", 1, 2)];
        const suggestions = gradeSuggestions(catalogue, 1, new Set(), 2);
        expect(suggestions.map((item) => item.id)).toEqual(["real", "zero"]);
    });
});

describe("poolSizes", () => {
    it("counts each grade's pool", () => {
        const sizes = poolSizes([cat("a", 1, 1), cat("b", 1, 2), cat("c", 2, 1)]);
        expect(sizes.get(1)).toBe(2);
        expect(sizes.get(2)).toBe(1);
    });
});
