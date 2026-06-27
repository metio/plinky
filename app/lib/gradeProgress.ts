// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { loadBundledScores, loadUserScores } from "./catalog";
import { loadExerciseManifest } from "./exercises";
import { isDue, isLapsed, loadAllMastery, type Mastery } from "./mastery";
import { gradeOf, MAX_GRADE, rawDifficulty } from "./scoreDifficulty";
import { loadManifest } from "./songs";

// Plinky's progression: each of the 1–MAX_GRADE difficulty grades is a pool of
// catalogue items, and you climb by *mastering* items of a grade — not by any single
// thing. A grade earns a star tier at 5/12/25 mastered; you hold it by keeping those
// pieces fresh (light spaced-repetition review of what you already know); and an
// unbounded skill rating tracks the hardest you can play. Decay is a counting rule,
// never destructive: gentle counts everything learned, competitive stops counting a
// lapsed piece until it is refreshed — switching back restores it.

export type DecayMode = "gentle" | "competitive";
export type StarTier = "none" | "bronze" | "silver" | "gold";

// Mastered counts that earn each star tier within a single grade.
export const STAR_THRESHOLDS = { bronze: 5, silver: 12, gold: 25 } as const;

// The most refresh reviews to surface in a day, so maintenance never piles up.
export const REVIEW_CAP = 8;

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

// The grade reached: the highest grade for which it — and every grade below it — has
// at least a Bronze. Requirements only rise, so the first grade short of Bronze caps
// the climb. Nothing is ever locked; this is just the standing shown.
export function currentGrade(items: GradedMastery[], mode: DecayMode, now: number): number {
    let grade = 0;
    for (let g = 1; g <= MAX_GRADE; g++) {
        if (masteredInGrade(items, g, mode, now) >= STAR_THRESHOLDS.bronze) {
            grade = g;
        } else {
            break;
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

// Joins the player's mastery with the catalogue to resolve each touched item's grade
// and cost. Songs and exercises carry both in their manifests; bundled and imported
// scores are graded from their MusicXML. Items with no catalogue match are dropped.
export async function loadGradedMastery(): Promise<GradedMastery[]> {
    const mastery = loadAllMastery();
    if (mastery.length === 0) {
        return [];
    }
    const index = new Map<string, { title: string; grade: number; cost: number }>();
    const [songs, exercises] = await Promise.all([loadManifest(), loadExerciseManifest()]);
    for (const song of songs) {
        index.set(song.id, { title: song.title, grade: song.grade, cost: song.cost });
    }
    for (const exercise of exercises) {
        index.set(exercise.id, {
            title: exercise.title,
            grade: exercise.grade,
            cost: exercise.cost,
        });
    }
    for (const score of [...loadBundledScores(), ...loadUserScores()]) {
        if (!index.has(score.id)) {
            index.set(score.id, {
                title: score.title,
                grade: gradeOf(score.id, score.xml),
                cost: rawDifficulty(score.xml),
            });
        }
    }
    const out: GradedMastery[] = [];
    for (const { id, mastery: state } of mastery) {
        const meta = index.get(id);
        if (meta) {
            out.push({ id, title: meta.title, grade: meta.grade, cost: meta.cost, mastery: state });
        }
    }
    return out;
}
