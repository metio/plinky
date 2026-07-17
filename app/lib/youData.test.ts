// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Mastery } from "../../core/mastery";
import type { Grid } from "../../core/shareCard";
import type { GradeCatalogItem, GradedMastery } from "./gradeProgress";
import { STAR_THRESHOLDS } from "./gradeProgress";
import { buildYouData, type YouInput } from "./youData";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const mastered: Mastery = {
    bestScore: 80,
    learned: true,
    backlog: false,
    intervalDays: 10,
    reviewAt: NOW + DAY,
    updatedAt: NOW,
};

function piece(id: string, grade: number, mastery: Partial<Mastery> = {}): GradedMastery {
    return { id, title: id, grade, cost: 1, mastery: { ...mastered, ...mastery } };
}

// A grade's worth of mastered pieces — the unit the star tiers count in.
function pieces(grade: number, count: number, mastery: Partial<Mastery> = {}): GradedMastery[] {
    return Array.from({ length: count }, (_, i) => piece(`g${grade}-${i}`, grade, mastery));
}

function input(overrides: Partial<YouInput> = {}): YouInput {
    return {
        items: [],
        catalogue: [],
        mode: "gentle",
        reviewCap: 10,
        summary: null,
        fingerprint: null,
        reachedGrade: 0,
        flawless: false,
        now: NOW,
        ...overrides,
    };
}

const earned = (data: ReturnType<typeof buildYouData>, id: string) =>
    data.achievements.find((achievement) => achievement.id === id)?.earned;

describe("buildYouData", () => {
    it("places the player at the highest grade they have played well, and works one past it", () => {
        const data = buildYouData(input({ items: [...pieces(1, 2), ...pieces(2, 2)] }));
        expect(data.level).toBe(2);
        expect(data.workingGrade).toBe(3);
    });

    it("holds a beginner at grade zero, working toward the first grade", () => {
        // One strong run is not ability — it takes two pieces to place a grade.
        const data = buildYouData(input({ items: pieces(1, 1) }));
        expect(data.level).toBe(0);
        expect(data.workingGrade).toBe(1);
    });

    it("caps the working grade at the top of the ladder", () => {
        const data = buildYouData(input({ items: pieces(8, 2) }));
        expect(data.workingGrade).toBe(8);
    });

    it("suggests the gentlest unmastered pieces of the working grade", () => {
        const catalogue: GradeCatalogItem[] = [
            { id: "g1-hard", title: "Harder", grade: 1, cost: 5 },
            { id: "g1-easy", title: "Gentle", grade: 1, cost: 1 },
            { id: "g1-mid", title: "Middling", grade: 1, cost: 3 },
            { id: "g2-off", title: "Wrong grade", grade: 2, cost: 1 },
        ];
        const data = buildYouData(input({ catalogue }));
        expect(data.upNext.map((item) => item.id)).toEqual(["g1-easy", "g1-mid", "g1-hard"]);
    });

    it("leaves a mastered piece out of the suggestions", () => {
        const catalogue: GradeCatalogItem[] = [
            { id: "done", title: "Done", grade: 1, cost: 1 },
            { id: "todo", title: "Todo", grade: 1, cost: 2 },
        ];
        // Neither run reaches the ability bar, so the player still works at grade 1 —
        // the grade these pieces sit in. A backlogged piece is not mastered, so it
        // stays on the shortlist even though it is marked learned.
        const items = [
            piece("done", 1, { bestScore: 50 }),
            piece("todo", 1, { bestScore: 50, backlog: true }),
        ];
        const data = buildYouData(input({ items, catalogue }));
        expect(data.workingGrade).toBe(1);
        expect(data.upNext.map((item) => item.id)).toEqual(["todo"]);
    });

    it("resolves due reviews to linkable titles, and leaves fresh pieces alone", () => {
        const items = [
            piece("stale", 1, { reviewAt: NOW - DAY }),
            piece("fresh", 1, { reviewAt: NOW + DAY }),
        ];
        const data = buildYouData(input({ items }));
        expect(data.reviews).toEqual([{ id: "stale", title: "stale" }]);
    });

    it("holds the review queue to the player's cap", () => {
        const items = pieces(1, 6, { reviewAt: NOW - DAY });
        expect(buildYouData(input({ items, reviewCap: 2 })).reviews).toHaveLength(2);
    });

    it("counts the catalogue pool per grade", () => {
        const catalogue: GradeCatalogItem[] = [
            { id: "a", title: "A", grade: 1, cost: 1 },
            { id: "b", title: "B", grade: 1, cost: 1 },
            { id: "c", title: "C", grade: 3, cost: 1 },
        ];
        const sizes = buildYouData(input({ catalogue })).poolSizes;
        expect(sizes.get(1)).toBe(2);
        expect(sizes.get(3)).toBe(1);
        expect(sizes.get(2)).toBeUndefined();
    });

    describe("badges", () => {
        it("awards a star tier once a grade holds enough mastered pieces", () => {
            const bronze = buildYouData(input({ items: pieces(1, STAR_THRESHOLDS.bronze) }));
            expect(earned(bronze, "star-bronze")).toBe(true);
            expect(earned(bronze, "star-silver")).toBe(false);

            const silver = buildYouData(input({ items: pieces(1, STAR_THRESHOLDS.silver) }));
            expect(earned(silver, "star-silver")).toBe(true);
            expect(earned(silver, "star-gold")).toBe(false);
        });

        it("keeps a star earned in competitive decay, where the mastery has lapsed", () => {
            // Stars are judged gently whatever the player's mode, so a badge already
            // won cannot vanish over a stretch of days away.
            const lapsed = pieces(1, STAR_THRESHOLDS.bronze, { reviewAt: NOW - 400 * DAY });
            const data = buildYouData(input({ items: lapsed, mode: "competitive" }));
            expect(earned(data, "star-bronze")).toBe(true);
        });

        it("celebrates the highest grade ever reached, not the current standing", () => {
            // The milestone outlives the mastery behind it: an empty ladder still
            // shows the badge the player has already earned.
            const data = buildYouData(input({ reachedGrade: 4 }));
            expect(earned(data, "grade-4")).toBe(true);
            expect(earned(data, "grade-5")).toBe(false);
        });

        it("celebrates a standing above the recorded milestone", () => {
            const data = buildYouData(input({ items: pieces(2, 2), reachedGrade: 0 }));
            expect(earned(data, "grade-2")).toBe(true);
        });

        it("awards the first S on any piece's best run", () => {
            expect(earned(buildYouData(input({ items: pieces(1, 1) })), "first-s")).toBe(false);
            const data = buildYouData(input({ items: [piece("ace", 1, { bestScore: 100 })] }));
            expect(earned(data, "first-s")).toBe(true);
        });

        it("passes the flawless milestone through", () => {
            expect(earned(buildYouData(input({ flawless: true })), "flawless")).toBe(true);
            expect(earned(buildYouData(input()), "flawless")).toBe(false);
        });

        it("counts an absent practice summary as no days and no notes", () => {
            const data = buildYouData(input({ summary: null }));
            expect(data.achievements.some((a) => a.kind === "days" && a.earned)).toBe(false);
            expect(data.achievements.some((a) => a.kind === "notes" && a.earned)).toBe(false);
        });
    });

    it("passes the loaded summary and fingerprint straight through", () => {
        const fingerprint: Grid = [["best", "ok"]];
        const data = buildYouData(input({ fingerprint }));
        expect(data.fingerprint).toBe(fingerprint);
        expect(data.summary).toBeNull();
    });
});
