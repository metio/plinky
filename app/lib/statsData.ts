// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    type Achievement,
    type BadgeMarks,
    collectAchievements,
    NO_BADGE_MARKS,
    raiseBadgeMarks,
    starsThrough,
} from "../../core/achievements";
import { EAR_ITEMS } from "../../core/earCatalog";
import type { ItemKind } from "../../core/practisable";
import { letterFor } from "../../core/grade";
import type { PracticeSummary } from "../../core/history";
import type { DecayMode } from "../../core/review";
import { MAX_GRADE } from "../../core/scoreDifficulty";
import type { Grid } from "../../core/shareCard";
import {
    ladderStanding,
    dueItems,
    type GradeCatalogItem,
    type GradedMastery,
    gradeSuggestions,
    masteredInGrade,
    skillRating,
    starTier,
} from "./gradeProgress";

// How many pieces the "up next" shortlist offers.
const SUGGESTION_COUNT = 4;

export type StatsData = {
    // Every graded piece with its mastery — the input the roadmap breaks down per grade.
    items: GradedMastery[];
    mode: DecayMode;
    now: number;
    level: number;
    skill: number;
    // The grade being worked toward: one past the current level, capped at the top.
    workingGrade: number;
    // The gentlest unmastered pieces of the working grade — what to play next.
    upNext: GradeCatalogItem[];
    // Pieces due a refresh, resolved to titles for linking.
    reviews: Array<{ id: string; title: string; kind: ItemKind; incipit?: string }>;
    // How many catalogue pieces each grade holds.
    summary: PracticeSummary | null;
    fingerprint: Grid | null;
    // The collectible badge set, earned flags included.
    achievements: Achievement[];
    // The kept badge marks raised by what the mastery shows now: what the page should
    // record, so every badge it has shown stays earned.
    badgeMarks: BadgeMarks;
};

export type YouInput = {
    items: GradedMastery[];
    catalogue: GradeCatalogItem[];
    mode: DecayMode;
    // How many reviews a day the player has asked to be offered.
    reviewCap: number;
    summary: PracticeSummary | null;
    fingerprint: Grid | null;
    // The high-water marks kept outside the mastery: the best grade ever celebrated
    // and whether a flawless run has ever landed. Both are cumulative, so a badge
    // once earned cannot be taken back by a later slump.
    reachedGrade: number;
    flawless: boolean;
    // The best star tier and ear mastery ever shown, which the current mastery may
    // have fallen back from.
    badgeMarks: BadgeMarks;
    now: number;
};

// Everything the "You" page shows, derived in one place from data already loaded.
// Every field is a function of the input — the page's standing, roadmap, review
// queue and badges all fall out of the pure gradeProgress helpers — so the whole
// derivation is exercised as a table without mounting React or loading a store.
export function buildStatsData(input: YouInput): StatsData {
    const { items, catalogue, mode, now } = input;
    const { level, workingGrade, mastered } = ladderStanding(items);
    const badgeMarks = raiseBadgeMarks(input.badgeMarks, seenBadgeMarks(items, now));

    return {
        items,
        mode,
        now,
        level,
        skill: skillRating(items, mode, now),
        workingGrade,
        upNext: gradeSuggestions(catalogue, workingGrade, mastered, SUGGESTION_COUNT),
        reviews: dueItems(items, now, input.reviewCap).map((item) => ({
            id: item.id,
            title: item.title,
            kind: item.kind,
            ...(item.incipit ? { incipit: item.incipit } : {}),
        })),
        summary: input.summary,
        fingerprint: input.fingerprint,
        achievements: earnedAchievements(input, level, badgeMarks),
        badgeMarks,
    };
}

// What the mastery shows today toward the two badges that could otherwise fall back: the
// best star tier held in any grade, judged under gentle decay whatever the player's mode,
// and whether every ear exercise is learned, so the whole set must be present.
export function seenBadgeMarks(items: GradedMastery[], now: number): BadgeMarks {
    let marks = NO_BADGE_MARKS;
    for (let grade = 1; grade <= MAX_GRADE; grade++) {
        const tier = starTier(masteredInGrade(items, grade, "gentle", now));
        if (tier !== "none") {
            marks = raiseBadgeMarks(marks, { star: tier, earMastered: false });
        }
    }
    const earMastered =
        EAR_ITEMS.length > 0 &&
        EAR_ITEMS.every((ear) =>
            items.some((item) => item.kind === "ear" && item.id === ear.id && item.mastery.learned),
        );
    return raiseBadgeMarks(marks, { star: null, earMastered });
}

// Badge facts are counted cumulatively: the celebrated grade never lowers, best
// scores never drop, and the star and ear-mastery marks are kept at the most the
// mastery has ever shown — so an earned badge can never quietly disappear.
function earnedAchievements(input: YouInput, level: number, marks: BadgeMarks): Achievement[] {
    const { items, summary } = input;
    const earItems = items.filter((item) => item.kind === "ear");
    return collectAchievements({
        reachedGrade: Math.max(input.reachedGrade, level),
        hasS: items.some((item) => letterFor(item.mastery.bestScore) === "S"),
        flawless: input.flawless,
        stars: starsThrough(marks.star),
        daysPracticed: summary?.daysPracticed ?? 0,
        totalNotes: summary?.totalNotes ?? 0,
        // A touched ear item means a session finished; a best of 100 is a flawless run.
        earTrained: earItems.length > 0,
        earFlawless: earItems.some((item) => item.mastery.bestScore >= 100),
        earMastered: marks.earMastered,
    });
}
