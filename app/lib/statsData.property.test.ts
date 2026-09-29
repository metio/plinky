// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { NO_BADGE_MARKS } from "../../core/achievements";
import type { Mastery } from "../../core/mastery";
import type { GradeCatalogItem, GradedMastery } from "./gradeProgress";
import { buildStatsData, type YouInput } from "./statsData";

// Everything the Stats page shows, derived from what the player has done. The promise
// the page makes is that it never takes anything away: Plinky has no streaks and no
// ranking, and a badge is the one thing here that could still punish a slump if a
// weaker week could un-earn it. So the law with teeth is monotonicity — more practice,
// or a mark already held, can only ever add.

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const MAX_GRADE = 8;

const arbMastery: fc.Arbitrary<Mastery> = fc
    .record({
        bestScore: fc.integer({ min: 0, max: 100 }),
        learned: fc.boolean(),
        backlog: fc.boolean(),
        intervalDays: fc.integer({ min: 1, max: 90 }),
        dueIn: fc.integer({ min: -30, max: 30 }),
    })
    .map(({ dueIn, ...rest }) => ({
        ...rest,
        reviewAt: NOW + dueIn * DAY,
        updatedAt: NOW - DAY,
        deadline: "",
    }));

const arbItem: fc.Arbitrary<GradedMastery> = fc
    .tuple(
        fc.stringMatching(/^[a-z]{1,6}$/),
        fc.integer({ min: 1, max: MAX_GRADE }),
        fc.constantFrom("piece" as const, "ear" as const, "exercise" as const),
        arbMastery,
    )
    .map(([id, grade, kind, mastery]) => ({
        id: `${kind}-${grade}-${id}`,
        title: id,
        grade,
        cost: 1,
        kind,
        mastery,
    }));

const arbCatalogue: fc.Arbitrary<GradeCatalogItem[]> = fc.array(
    fc
        .tuple(fc.stringMatching(/^[a-z]{1,6}$/), fc.integer({ min: 1, max: MAX_GRADE }))
        .map(([id, grade]) => ({
            id: `piece-${grade}-${id}`,
            title: id,
            grade,
            cost: grade * 10,
            kind: "piece" as const,
        })),
    { maxLength: 20 },
);

const arbInput: fc.Arbitrary<YouInput> = fc
    .record({
        items: fc.array(arbItem, { maxLength: 24 }),
        catalogue: arbCatalogue,
        mode: fc.constantFrom("gentle" as const, "steady" as const),
        reviewCap: fc.integer({ min: 0, max: 12 }),
        reachedGrade: fc.integer({ min: 0, max: MAX_GRADE }),
        flawless: fc.boolean(),
    })
    .map((partial) => ({
        ...partial,
        summary: null,
        fingerprint: null,
        badgeMarks: NO_BADGE_MARKS,
        now: NOW,
    }));

const earnedIds = (input: YouInput) =>
    new Set(
        buildStatsData(input)
            .achievements.filter((achievement) => achievement.earned)
            .map((achievement) => achievement.id),
    );

describe("the Stats page, whatever the player has done", () => {
    it("derives the same page from the same history", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                expect(buildStatsData(input)).toEqual(buildStatsData(input));
            }),
        );
    });

    it("stands the player at a grade on the ladder, working one past it", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const { level, workingGrade } = buildStatsData(input);

                expect(level).toBeGreaterThanOrEqual(0);
                expect(level).toBeLessThanOrEqual(MAX_GRADE);
                expect(workingGrade).toBeGreaterThanOrEqual(1);
                expect(workingGrade).toBeLessThanOrEqual(MAX_GRADE);
                // One past where they stand, until there is no further to go.
                expect(workingGrade).toBe(Math.min(level + 1, MAX_GRADE));
            }),
        );
    });

    it("never takes a badge away for a mark already held", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const held = buildStatsData(input).badgeMarks;

                // Re-deriving the page with the marks it just produced — which is what
                // the next visit does — can only hold or raise them, never lower them.
                const again = buildStatsData({ ...input, badgeMarks: held });

                expect(again.badgeMarks).toEqual(held);
                expect(earnedIds({ ...input, badgeMarks: held })).toEqual(
                    new Set([...earnedIds(input)]),
                );
            }),
        );
    });

    it("never un-earns a badge for a grade once celebrated", () => {
        fc.assert(
            fc.property(arbInput, fc.integer({ min: 0, max: MAX_GRADE }), (input, higher) => {
                fc.pre(higher >= input.reachedGrade);

                const before = earnedIds(input);
                const after = earnedIds({ ...input, reachedGrade: higher });

                // A grade reached is cumulative: raising it adds badges and removes none.
                for (const id of before) {
                    expect(after.has(id)).toBe(true);
                }
            }),
        );
    });

    it("never un-earns a badge for a flawless run that happened", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const before = earnedIds({ ...input, flawless: false });
                const after = earnedIds({ ...input, flawless: true });

                for (const id of before) {
                    expect(after.has(id)).toBe(true);
                }
            }),
        );
    });

    it("offers no more reviews than the player asked for", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const { reviews } = buildStatsData(input);

                expect(reviews.length).toBeLessThanOrEqual(input.reviewCap);
                const known = new Set(input.items.map((item) => item.id));
                for (const review of reviews) {
                    expect(known.has(review.id)).toBe(true);
                }
                // A piece offered twice in one queue would read as two things to do.
                expect(new Set(reviews.map((review) => review.id)).size).toBe(reviews.length);
            }),
        );
    });

    it("suggests only unmastered pieces of the grade being worked", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const { upNext, workingGrade } = buildStatsData(input);

                const learned = new Set(
                    input.items.filter((item) => item.mastery.learned).map((item) => item.id),
                );
                const inCatalogue = new Set(input.catalogue.map((item) => item.id));
                for (const suggestion of upNext) {
                    expect(inCatalogue.has(suggestion.id)).toBe(true);
                    expect(suggestion.grade).toBe(workingGrade);
                    // Suggesting something already mastered is asking for work already done.
                    expect(learned.has(suggestion.id)).toBe(false);
                }
                expect(new Set(upNext.map((one) => one.id)).size).toBe(upNext.length);
            }),
        );
    });
});
