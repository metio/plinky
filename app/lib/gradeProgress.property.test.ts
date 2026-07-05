// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DecayMode } from "../../core/review";
import type { GradedMastery } from "./gradeProgress";
import { REVIEW_CAP } from "../../core/review";
import {
    currentGrade,
    dueReviews,
    masteredInGrade,
    skillRating,
    STAR_THRESHOLDS,
    starTier,
} from "./gradeProgress";
import { MAX_GRADE } from "../../core/scoreDifficulty";

const arbMastery = fc.record({
    bestScore: fc.integer({ min: 0, max: 100 }),
    learned: fc.boolean(),
    backlog: fc.boolean(),
    intervalDays: fc.integer({ min: 0, max: 365 }),
    reviewAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
    updatedAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

const arbItem: fc.Arbitrary<GradedMastery> = fc.record({
    id: fc.string(),
    title: fc.string(),
    grade: fc.integer({ min: 1, max: MAX_GRADE }),
    cost: fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
    mastery: arbMastery,
});

const arbItems = fc.array(arbItem, { maxLength: 60 });
const arbMode: fc.Arbitrary<DecayMode> = fc.constantFrom("gentle", "competitive");
const arbNow = fc.integer({ min: 0, max: 2_000_000_000_000 });

const TIER_ORDER = ["none", "bronze", "silver", "gold"] as const;

describe("gradeProgress invariants", () => {
    it("ranks the star tier monotonically in the mastered count", () => {
        fc.assert(
            fc.property(fc.nat({ max: 100 }), fc.nat({ max: 100 }), (a, b) => {
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                expect(TIER_ORDER.indexOf(starTier(lo))).toBeLessThanOrEqual(
                    TIER_ORDER.indexOf(starTier(hi)),
                );
            }),
        );
    });

    it("awards each tier exactly at its threshold", () => {
        expect(starTier(STAR_THRESHOLDS.bronze - 1)).toBe("none");
        expect(starTier(STAR_THRESHOLDS.bronze)).toBe("bronze");
        expect(starTier(STAR_THRESHOLDS.silver)).toBe("silver");
        expect(starTier(STAR_THRESHOLDS.gold)).toBe("gold");
    });

    it("keeps the current grade within the ladder", () => {
        fc.assert(
            fc.property(arbItems, (items) => {
                const grade = currentGrade(items);
                expect(grade).toBeGreaterThanOrEqual(0);
                expect(grade).toBeLessThanOrEqual(MAX_GRADE);
                expect(Number.isInteger(grade)).toBe(true);
            }),
        );
    });

    it("never counts more mastered in a grade than the pieces in it", () => {
        fc.assert(
            fc.property(
                arbItems,
                fc.integer({ min: 1, max: MAX_GRADE }),
                arbMode,
                arbNow,
                (items, grade, mode, now) => {
                    const mastered = masteredInGrade(items, grade, mode, now);
                    const inGrade = items.filter((item) => item.grade === grade).length;
                    expect(mastered).toBeGreaterThanOrEqual(0);
                    expect(mastered).toBeLessThanOrEqual(inGrade);
                },
            ),
        );
    });

    it("rates skill as a finite non-negative number", () => {
        fc.assert(
            fc.property(arbItems, arbMode, arbNow, (items, mode, now) => {
                const rating = skillRating(items, mode, now);
                expect(Number.isFinite(rating)).toBe(true);
                expect(rating).toBeGreaterThanOrEqual(0);
            }),
        );
    });

    it("never proposes more reviews than the cap", () => {
        fc.assert(
            fc.property(arbItems, arbNow, fc.integer({ min: 0, max: 50 }), (items, now, cap) => {
                expect(dueReviews(items, now, cap).length).toBeLessThanOrEqual(cap);
                expect(dueReviews(items, now).length).toBeLessThanOrEqual(REVIEW_CAP);
            }),
        );
    });
});
