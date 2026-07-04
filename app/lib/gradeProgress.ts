// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { loadBundledScores, loadUserScores } from "./catalog";
import { loadExerciseManifest } from "./exercises";
import type { Letter } from "../../core/grade";
import { type DecayMode, REVIEW_CAP } from "../../core/review";
import { isDue, isLapsed, letterMin, type Mastery } from "../../core/mastery";
import { gradeOf, MAX_GRADE, parsePositions, rawDifficulty } from "./scoreDifficulty";
import { loadManifest } from "./songs";

// Plinky's progression: each of the 1–MAX_GRADE difficulty grades is a pool of
// catalogue items, and you climb by *mastering* items of a grade — not by any single
// thing. A grade earns a star tier at 5/12/25 mastered; you hold it by keeping those
// pieces fresh (light spaced-repetition review of what you already know); and an
// unbounded skill rating tracks the hardest you can play. Decay is a counting rule,
// never destructive: gentle counts everything learned, competitive stops counting a
// lapsed piece until it is refreshed — switching back restores it.

export type StarTier = "none" | "bronze" | "silver" | "gold";

// Mastered counts that earn each star tier within a single grade.
export const STAR_THRESHOLDS = { bronze: 5, silver: 12, gold: 25 } as const;

// How many of your hardest mastered pieces the skill rating averages.
const SKILL_TOP = 10;

// A catalogue item placed on the ladder, paired with the player's mastery of it.
export type GradedMastery = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    mastery: Mastery;
};

// Whether a piece counts toward its grade under the decay rule. Gentle counts every
// learned, un-shelved piece; competitive drops one that has lapsed until refreshed.
function counts(mastery: Mastery, mode: DecayMode, now: number): boolean {
    if (!mastery.learned || mastery.backlog) {
        return false;
    }
    return mode === "gentle" || !isLapsed(mastery, now);
}

export function masteredInGrade(
    items: GradedMastery[],
    grade: number,
    mode: DecayMode,
    now: number,
): number {
    return items.filter((item) => item.grade === grade && counts(item.mastery, mode, now)).length;
}

export function starTier(masteredCount: number): StarTier {
    if (masteredCount >= STAR_THRESHOLDS.gold) {
        return "gold";
    }
    if (masteredCount >= STAR_THRESHOLDS.silver) {
        return "silver";
    }
    if (masteredCount >= STAR_THRESHOLDS.bronze) {
        return "bronze";
    }
    return "none";
}

// Ability over grind: the grade reached is the highest grade where you've played a few
// pieces *well* (at least B), not where you've ground out a full pool. So a strong player
// who sight-reads Grade 7 is placed at Grade 7 without first mastering five pieces of
// every grade below — but a single lucky run can't promote them, since it takes two.
// Ability is what you can do, so it doesn't decay (the stars and freshness below do).
export const ABILITY_LETTER: Letter = "B";
export const ABILITY_PIECES = 2;

// How many pieces of a grade you've played at the ability bar or better.
export function playedWellInGrade(items: GradedMastery[], grade: number): number {
    const bar = letterMin(ABILITY_LETTER);
    return items.filter((item) => item.grade === grade && item.mastery.bestScore >= bar).length;
}

export function currentGrade(items: GradedMastery[]): number {
    let grade = 0;
    for (let g = 1; g <= MAX_GRADE; g++) {
        if (playedWellInGrade(items, g) >= ABILITY_PIECES) {
            grade = g;
        }
    }
    return grade;
}

// A grade's mastered count and how many of those want a refresh, so the UI can show
// "✨ fresh" or "3 due to keep it sharp".
export function gradeFreshness(
    items: GradedMastery[],
    grade: number,
    mode: DecayMode,
    now: number,
): { mastered: number; due: number } {
    const inGrade = items.filter((item) => item.grade === grade && counts(item.mastery, mode, now));
    return {
        mastered: inGrade.length,
        due: inGrade.filter((item) => isDue(item.mastery, now)).length,
    };
}

// The pieces to refresh now, most overdue first, capped so a day's maintenance stays
// gentle. Mode-independent: a lapsed piece (competitive's "lost" piece) is still due
// here, so refreshing it recovers it.
export function dueReviews(
    items: GradedMastery[],
    now: number,
    cap: number = REVIEW_CAP,
): string[] {
    return items
        .filter((item) => isDue(item.mastery, now))
        .sort((a, b) => a.mastery.reviewAt - b.mastery.reviewAt)
        .slice(0, cap)
        .map((item) => item.id);
}

// An unbounded ability number: the average cost of your hardest mastered pieces,
// scaled to a friendly range. It rises as you master harder music and, in competitive
// mode, eases down as pieces lapse — the climb that never caps.
export function skillRating(items: GradedMastery[], mode: DecayMode, now: number): number {
    const costs = items
        .filter((item) => counts(item.mastery, mode, now))
        .map((item) => item.cost)
        .sort((a, b) => b - a)
        .slice(0, SKILL_TOP);
    if (costs.length === 0) {
        return 0;
    }
    return Math.round((100 * costs.reduce((sum, cost) => sum + cost, 0)) / costs.length);
}

// A catalogue item on the ladder, independent of any mastery — the pool a grade
// draws from.
export type GradeCatalogItem = { id: string; title: string; grade: number; cost: number };

// The whole gradeable catalogue, keyed by id: songs and exercises from their
// manifests (grade + cost precomputed), bundled and imported scores graded from their
// MusicXML. The pools the grades draw from.
async function buildCatalogue(): Promise<Map<string, GradeCatalogItem>> {
    const index = new Map<string, GradeCatalogItem>();
    const [songs, exercises] = await Promise.all([loadManifest(), loadExerciseManifest()]);
    for (const song of songs) {
        index.set(song.id, { id: song.id, title: song.title, grade: song.grade, cost: song.cost });
    }
    for (const exercise of exercises) {
        index.set(exercise.id, {
            id: exercise.id,
            title: exercise.title,
            grade: exercise.grade,
            cost: exercise.cost,
        });
    }
    for (const score of [...loadBundledScores(), ...loadUserScores()]) {
        if (index.has(score.id)) {
            continue;
        }
        const { right, left } = parsePositions(score.xml);
        // A score with no fingerable notes — empty or unreadable — is nothing to
        // practise, so it stays out of the grade pools. Keeping it out also lets a
        // cost of 0 mean "measured as gentlest" everywhere, so the easy real pieces
        // that score 0 lead their grade rather than being mistaken for unmeasured.
        if (right.length + left.length === 0) {
            continue;
        }
        index.set(score.id, {
            id: score.id,
            title: score.title,
            grade: gradeOf(score.id, score.xml),
            cost: rawDifficulty(score.xml),
        });
    }
    return index;
}

export async function loadGradeCatalogue(): Promise<GradeCatalogItem[]> {
    return [...(await buildCatalogue()).values()];
}

// Where the per-piece mastery entries come from — structurally the mastery store's
// loadAll, taken as a parameter so the caller decides which store backs the join.
export type MasterySource = { loadAll(): Array<{ id: string; value: Mastery }> };

// Joins the player's mastery with the catalogue to resolve each touched item's grade
// and cost. Items with no catalogue match are dropped.
export async function loadGradedMastery(source: MasterySource): Promise<GradedMastery[]> {
    const mastery = source.loadAll();
    if (mastery.length === 0) {
        return [];
    }
    const index = await buildCatalogue();
    const out: GradedMastery[] = [];
    for (const { id, value: state } of mastery) {
        const meta = index.get(id);
        if (meta) {
            out.push({ id, title: meta.title, grade: meta.grade, cost: meta.cost, mastery: state });
        }
    }
    return out;
}

// The next star above the current mastered count and how many more pieces reach it,
// or null once Gold is held — the "3 to Silver" nudge.
export function nextStar(
    masteredCount: number,
): { tier: Exclude<StarTier, "none">; remaining: number } | null {
    if (masteredCount < STAR_THRESHOLDS.bronze) {
        return { tier: "bronze", remaining: STAR_THRESHOLDS.bronze - masteredCount };
    }
    if (masteredCount < STAR_THRESHOLDS.silver) {
        return { tier: "silver", remaining: STAR_THRESHOLDS.silver - masteredCount };
    }
    if (masteredCount < STAR_THRESHOLDS.gold) {
        return { tier: "gold", remaining: STAR_THRESHOLDS.gold - masteredCount };
    }
    return null;
}

// What to learn next in a grade: its gentlest not-yet-mastered pieces, easiest first
// by cost, so the climb through a grade stays gradual.
export function gradeSuggestions(
    catalogue: GradeCatalogItem[],
    grade: number,
    mastered: ReadonlySet<string>,
    count: number,
): GradeCatalogItem[] {
    return (
        catalogue
            .filter((item) => item.grade === grade && !mastered.has(item.id))
            // Easiest first by cost. Unplayable scores are kept out of the catalogue, so
            // a cost of 0 reliably means "gentlest" rather than "couldn't measure" — the
            // beginner-friendly pieces that score 0 lead their grade.
            .sort((a, b) => a.cost - b.cost)
            .slice(0, count)
    );
}

// How many pieces each grade's pool holds, indexed by grade.
export function poolSizes(catalogue: GradeCatalogItem[]): Map<number, number> {
    const sizes = new Map<number, number>();
    for (const item of catalogue) {
        sizes.set(item.grade, (sizes.get(item.grade) ?? 0) + 1);
    }
    return sizes;
}
