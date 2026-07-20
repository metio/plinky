// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { MAX_GRADE } from "./scoreDifficulty";

// The collectible badges: every earned moment the app already records, laid out
// as one durable set. The practice badges are CUMULATIVE — once earned they can
// never un-earn (their inputs only ever grow), and none involves consecutive days:
// Plinky never punishes a break. The ONE exception is the data-hero badge, which
// simply reflects the current analytics consent: it appears while it's on and
// disappears the moment it's turned off. That is deliberate and required — a
// consent must be as free to withdraw as to give, so opting out must cost nothing,
// not even a badge; it is a light thank-you, never a reward that pressures.

export type StarKind = "bronze" | "silver" | "gold";

export type EarBadge = "first" | "flawless" | "mastered";

export type Achievement =
    | { id: string; kind: "grade"; grade: number; earned: boolean }
    | { id: string; kind: "star"; tier: StarKind; earned: boolean }
    | { id: string; kind: "firstS"; earned: boolean }
    | { id: string; kind: "flawless"; earned: boolean }
    | { id: string; kind: "days"; target: number; earned: boolean }
    | { id: string; kind: "notes"; target: number; earned: boolean }
    | { id: string; kind: "ear"; badge: EarBadge; earned: boolean }
    | { id: string; kind: "dataHero"; earned: boolean };

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
    // Whether analytics is currently opted in. Unlike every other fact this can go
    // both ways — the data-hero badge follows it exactly, so turning consent off
    // takes the badge away with no penalty.
    consented: boolean;
};

const DAY_TARGETS = [10, 100];
const NOTE_TARGETS = [1_000, 10_000];
const STAR_ORDER: StarKind[] = ["bronze", "silver", "gold"];
const EAR_BADGES: EarBadge[] = ["first", "flawless", "mastered"];

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
        { id: "data-hero", kind: "dataHero", earned: facts.consented },
    ];
}
