// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { MAX_GRADE } from "./scoreDifficulty";

// The collectible badges: every earned moment the app already records, laid out
// as one durable set. Everything here is CUMULATIVE — a badge, once earned, can
// never un-earn (the inputs only ever grow), and none involves consecutive days:
// Plinky never punishes a break.

export type StarKind = "bronze" | "silver" | "gold";

export type EarBadge = "first" | "flawless" | "mastered";

export type Achievement =
    | { id: string; kind: "grade"; grade: number; earned: boolean }
    | { id: string; kind: "star"; tier: StarKind; earned: boolean }
    | { id: string; kind: "firstS"; earned: boolean }
    | { id: string; kind: "flawless"; earned: boolean }
    | { id: string; kind: "days"; target: number; earned: boolean }
    | { id: string; kind: "notes"; target: number; earned: boolean }
    | { id: string; kind: "ear"; badge: EarBadge; earned: boolean };

export type AchievementFacts = {
    // The highest grade ever celebrated — recorded once, never lowered, so the
    // badge survives any later decay.
    reachedGrade: number;
    // Whether any piece's best run has hit an S.
    hasS: boolean;
    flawless: boolean;
    // The star tiers earned in at least one grade.
    stars: ReadonlySet<StarKind>;
    daysPracticed: number;
    totalNotes: number;
    // Whether the player has finished an ear-training session at all, hit a flawless
    // one, and mastered every ear exercise. All three only ever grow — a best ear score
    // never drops and a mastered exercise stays mastered — so the badges are safe.
    earTrained: boolean;
    earFlawless: boolean;
    earMastered: boolean;
};

const DAY_TARGETS = [10, 100];
const NOTE_TARGETS = [1_000, 10_000];
const STAR_ORDER: StarKind[] = ["bronze", "silver", "gold"];
const EAR_BADGES: EarBadge[] = ["first", "flawless", "mastered"];

// Two badge facts are read off the current mastery, and the mastery can fall back: the best
// star tier held in any grade, and whether every ear exercise is learned, both drop when a
// piece is shelved or un-marked. So they are kept as high-water marks beside the celebrated
// grade, raised whenever the mastery shows more and never lowered, which is what keeps the
// promise above.
export type BadgeMarks = { star: StarKind | null; earMastered: boolean };

export const NO_BADGE_MARKS: BadgeMarks = { star: null, earMastered: false };

function starRank(star: StarKind | null): number {
    return star === null ? -1 : STAR_ORDER.indexOf(star);
}

// The kept marks raised to whatever `seen` shows beyond them. Returns `kept` itself when
// nothing is new, so a caller can skip a write that would change nothing.
export function raiseBadgeMarks(kept: BadgeMarks, seen: BadgeMarks): BadgeMarks {
    const star = starRank(seen.star) > starRank(kept.star) ? seen.star : kept.star;
    const earMastered = kept.earMastered || seen.earMastered;
    return star === kept.star && earMastered === kept.earMastered ? kept : { star, earMastered };
}

// Every star tier up to the best one held: a gold star was reached through bronze and silver.
export function starsThrough(star: StarKind | null): Set<StarKind> {
    return new Set(STAR_ORDER.slice(0, starRank(star) + 1));
}

// Stored marks read defensively: anything that is not a known tier holds no star.
export function normalizeBadgeMarks(raw: unknown): BadgeMarks {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        star: STAR_ORDER.find((tier) => tier === value.star) ?? null,
        earMastered: value.earMastered === true,
    };
}

export function collectAchievements(facts: AchievementFacts): Achievement[] {
    return [
        ...Array.from({ length: MAX_GRADE }, (_, i) => {
            const grade = i + 1;
            return {
                id: `grade-${grade}`,
                kind: "grade" as const,
                grade,
                earned: facts.reachedGrade >= grade,
            };
        }),
        ...STAR_ORDER.map((tier) => ({
            id: `star-${tier}`,
            kind: "star" as const,
            tier,
            earned: facts.stars.has(tier),
        })),
        { id: "first-s", kind: "firstS", earned: facts.hasS },
        { id: "flawless", kind: "flawless", earned: facts.flawless },
        ...DAY_TARGETS.map((target) => ({
            id: `days-${target}`,
            kind: "days" as const,
            target,
            earned: facts.daysPracticed >= target,
        })),
        ...NOTE_TARGETS.map((target) => ({
            id: `notes-${target}`,
            kind: "notes" as const,
            target,
            earned: facts.totalNotes >= target,
        })),
        ...EAR_BADGES.map((badge) => ({
            id: `ear-${badge}`,
            kind: "ear" as const,
            badge,
            earned:
                badge === "first"
                    ? facts.earTrained
                    : badge === "flawless"
                      ? facts.earFlawless
                      : facts.earMastered,
        })),
    ];
}
