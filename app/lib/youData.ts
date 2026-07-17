// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Achievement, collectAchievements, type StarKind } from "../../core/achievements";
import { letterFor } from "../../core/grade";
import type { PracticeSummary } from "../../core/history";
import type { DecayMode } from "../../core/review";
import { MAX_GRADE } from "../../core/scoreDifficulty";
import type { Grid } from "../../core/shareCard";
import {
    currentGrade,
    dueReviews,
    type GradeCatalogItem,
    type GradedMastery,
    gradeSuggestions,
    masteredInGrade,
    poolSizes,
    skillRating,
    starTier,
} from "./gradeProgress";

// How many pieces the "up next" shortlist offers.
const SUGGESTION_COUNT = 4;

export type YouData = {
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
    reviews: Array<{ id: string; title: string }>;
    // How many catalogue pieces each grade holds.
    poolSizes: Map<number, number>;
    summary: PracticeSummary | null;
    fingerprint: Grid | null;
    // The collectible badge set, earned flags included.
    achievements: Achievement[];
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
    now: number;
};

// Everything the "You" page shows, derived in one place from data already loaded.
// Every field is a function of the input — the page's standing, roadmap, review
// queue and badges all fall out of the pure gradeProgress helpers — so the whole
// derivation is exercised as a table without mounting React or loading a store.
export function buildYouData(input: YouInput): YouData {
    const { items, catalogue, mode, now } = input;
    const level = currentGrade(items);
    const byId = new Map(items.map((item) => [item.id, item]));
    const masteredIds = new Set(
        items.filter((item) => item.mastery.learned && !item.mastery.backlog).map((i) => i.id),
    );
    const workingGrade = Math.min(level + 1, MAX_GRADE);

    return {
        items,
        mode,
        now,
        level,
        skill: skillRating(items, mode, now),
        workingGrade,
        upNext: gradeSuggestions(catalogue, workingGrade, masteredIds, SUGGESTION_COUNT),
        reviews: dueReviews(items, now, input.reviewCap).map((id) => ({
            id,
            title: byId.get(id)?.title ?? id,
        })),
        poolSizes: poolSizes(catalogue),
        summary: input.summary,
        fingerprint: input.fingerprint,
        achievements: earnedAchievements(input, level),
    };
}

// Badge facts are counted cumulatively: the celebrated grade never lowers, best
// scores never drop, and stars are judged under gentle decay regardless of the
// player's chosen mode — so an earned badge can never quietly disappear.
function earnedAchievements(input: YouInput, level: number): Achievement[] {
    const { items, summary, now } = input;
    const stars = new Set<StarKind>();
    for (let grade = 1; grade <= MAX_GRADE; grade++) {
        const tier = starTier(masteredInGrade(items, grade, "gentle", now));
        if (tier !== "none") {
            stars.add(tier);
        }
    }
    return collectAchievements({
        reachedGrade: Math.max(input.reachedGrade, level),
        hasS: items.some((item) => letterFor(item.mastery.bestScore) === "S"),
        flawless: input.flawless,
        stars,
        daysPracticed: summary?.daysPracticed ?? 0,
        totalNotes: summary?.totalNotes ?? 0,
    });
}
