// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { resolveSets, type Definition, type Song } from "./bake-builtin-assignments.mts";

const inventions: Definition = {
    id: "bach-inventions",
    name: "Bach — The two-part inventions",
    composer: "bach",
    title: "^Invention",
    least: 2,
};
const song = (
    id: string,
    title: string,
    composer: string,
    cost: number,
    scoreKind = "solo-piano",
): Song => ({
    id,
    title,
    composer,
    cost,
    scoreKind,
});

describe("resolveSets", () => {
    it("orders a set gentlest first, so working through it is working up through it", () => {
        const { sets, problems } = resolveSets(
            [inventions],
            [
                song("hard", "Invention 9", "J. S. Bach", 12),
                song("easy", "Invention 1", "Johann Sebastian Bach", 3),
                song("mid", "Invention 4", "Bach", 7),
            ],
        );
        expect(problems).toEqual([]);
        expect(sets[0]?.items).toEqual(["easy", "mid", "hard"]);
    });

    it("leaves out a piece the composer did not write", () => {
        const { sets } = resolveSets(
            [inventions],
            [
                song("a", "Invention 1", "Bach", 1),
                song("b", "Invention 1", "Ferruccio Busoni", 1),
                song("c", "Invention 2", "Bach", 2),
            ],
        );
        expect(sets[0]?.items).toEqual(["a", "c"]);
    });

    it("leaves out anything that is not solo piano, however it is titled", () => {
        const { sets, problems } = resolveSets(
            [inventions],
            [
                song("piano", "Invention 1", "Bach", 1),
                song("sung", "Invention 2", "Bach", 1, "voice-and-piano"),
                song("choir", "Invention 3", "Bach", 1, "choral-reduction"),
            ],
        );
        expect(sets).toEqual([]);
        expect(problems[0]).toContain("resolves to 1 pieces");
    });

    it("reports a set that has fallen below what makes it that work, and ships nothing for it", () => {
        const { sets, problems } = resolveSets([inventions], [song("a", "Invention 1", "Bach", 1)]);
        expect(sets).toEqual([]);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("Bach — The two-part inventions");
        expect(problems[0]).toContain("fewer than the 2 it needs");
    });

    it("puts the gentlest set first, so a beginner is not scrolling past the études", () => {
        const hard: Definition = {
            ...inventions,
            id: "etudes",
            name: "Chopin — Études",
            composer: "chopin",
            title: "etude",
            least: 1,
        };
        const gentle: Definition = {
            ...inventions,
            id: "czerny",
            name: "Czerny",
            composer: "czerny",
            title: ".",
            least: 1,
        };
        const { sets } = resolveSets(
            [hard, gentle],
            [song("e", "Etude 1", "Chopin", 22), song("c", "Exercise 1", "Czerny", 3)],
        );
        expect(sets.map((set) => set.id)).toEqual(["czerny", "etudes"]);
    });

    it("levels a set by its middle, so one unreadable score cannot make a hard book look easy", () => {
        const hard: Definition = {
            ...inventions,
            id: "etudes",
            name: "Chopin — Études",
            composer: "chopin",
            title: "etude",
            least: 1,
        };
        const gentle: Definition = {
            ...inventions,
            id: "czerny",
            name: "Czerny",
            composer: "czerny",
            title: ".",
            least: 1,
        };
        const { sets } = resolveSets(
            [hard, gentle],
            [
                // A truncated edition that measures as nothing, among real études.
                song("broken", "Etude 0", "Chopin", 0.4),
                song("e1", "Etude 1", "Chopin", 21),
                song("e2", "Etude 2", "Chopin", 23),
                song("c1", "Exercise 1", "Czerny", 3),
                song("c2", "Exercise 2", "Czerny", 4),
                song("c3", "Exercise 3", "Czerny", 5),
            ],
        );
        expect(sets.map((set) => set.id)).toEqual(["czerny", "etudes"]);
    });

    it("ships only the name and the pieces, not what it ordered them by", () => {
        const { sets } = resolveSets(
            [inventions],
            [song("a", "Invention 1", "Bach", 1), song("b", "Invention 2", "Bach", 2)],
        );
        expect(Object.keys(sets[0]!).sort()).toEqual(["id", "items", "name"]);
    });

    it("carries on past a set that no longer resolves", () => {
        const other: Definition = {
            ...inventions,
            id: "satie",
            name: "Satie — Gymnopédies",
            composer: "satie",
            title: "gymnop",
            least: 1,
        };
        const { sets, problems } = resolveSets(
            [inventions, other],
            [song("g", "Gymnopédie No. 1", "Erik Satie", 12)],
        );
        expect(sets.map((set) => set.id)).toEqual(["satie"]);
        expect(problems).toHaveLength(1);
    });
});
