// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    dueCount,
    EMPTY_MUSIC_FILTER,
    filterMusic,
    foldForSearch,
    type MusicItem,
    musicOrder,
    toggledGrade,
} from "./music";
import type { Mastery } from "./mastery";

const item = (parts: Partial<MusicItem>): MusicItem => ({
    id: "id",
    title: "Title",
    composer: "Composer",
    grade: 1,
    removable: false,
    kind: "song",
    ...parts,
});

const NOW = 1_000_000_000_000;

const mastery = (parts: Partial<Mastery>): Mastery => ({
    bestScore: 90,
    learned: true,
    backlog: false,
    intervalDays: 5,
    reviewAt: NOW - 1,
    updatedAt: 0,
    deadline: "",
    ...parts,
});

const emptyContext = { favorites: new Set<string>(), mastery: {}, now: NOW };

describe("filterMusic", () => {
    it("keeps only the first occurrence of a duplicated id", () => {
        const items = [
            item({ id: "dup", title: "Imported copy" }),
            item({ id: "dup", title: "Catalogue original" }),
            item({ id: "other" }),
        ];
        const result = filterMusic(items, EMPTY_MUSIC_FILTER, emptyContext);
        expect(result.map((entry) => entry.title)).toEqual(["Imported copy", "Title"]);
    });

    it("matches the query against title and composer, case-insensitively", () => {
        const items = [
            item({ id: "a", title: "Ode to Joy", composer: "Beethoven" }),
            item({ id: "b", title: "Minuet", composer: "Bach" }),
        ];
        const byTitle = filterMusic(
            items,
            { ...EMPTY_MUSIC_FILTER, query: "  ODE " },
            emptyContext,
        );
        expect(byTitle.map((entry) => entry.id)).toEqual(["a"]);
        const byComposer = filterMusic(
            items,
            { ...EMPTY_MUSIC_FILTER, query: "bach" },
            emptyContext,
        );
        expect(byComposer.map((entry) => entry.id)).toEqual(["b"]);
    });

    it("narrows by kind, with the empty kind meaning every kind", () => {
        const items = [
            item({ id: "song", kind: "song" }),
            item({ id: "scale", kind: "scale-arpeggio" }),
            item({ id: "study", kind: "study" }),
        ];
        expect(filterMusic(items, EMPTY_MUSIC_FILTER, emptyContext)).toHaveLength(3);
        const studies = filterMusic(
            items,
            { ...EMPTY_MUSIC_FILTER, kind: "study" },
            emptyContext,
        );
        expect(studies.map((entry) => entry.id)).toEqual(["study"]);
    });

    it("selects the union of the chosen grades", () => {
        const items = [
            item({ id: "g1", grade: 1 }),
            item({ id: "g3", grade: 3 }),
            item({ id: "g5", grade: 5 }),
        ];
        const result = filterMusic(
            items,
            { ...EMPTY_MUSIC_FILTER, grades: new Set([1, 5]) },
            emptyContext,
        );
        expect(result.map((entry) => entry.id)).toEqual(["g1", "g5"]);
    });

    it("restricts to starred pieces when favoritesOnly is on", () => {
        const items = [item({ id: "starred" }), item({ id: "plain" })];
        const result = filterMusic(
            items,
            { ...EMPTY_MUSIC_FILTER, favoritesOnly: true },
            { ...emptyContext, favorites: new Set(["starred"]) },
        );
        expect(result.map((entry) => entry.id)).toEqual(["starred"]);
    });

    it("restricts to due pieces when dueOnly is on, dropping pieces with no mastery", () => {
        const items = [item({ id: "due" }), item({ id: "fresh" }), item({ id: "untracked" })];
        const result = filterMusic(
            items,
            { ...EMPTY_MUSIC_FILTER, dueOnly: true },
            {
                ...emptyContext,
                mastery: {
                    due: mastery({ reviewAt: NOW - 1 }),
                    fresh: mastery({ reviewAt: NOW + 86_400_000 }),
                },
            },
        );
        expect(result.map((entry) => entry.id)).toEqual(["due"]);
    });

    it("intersects every active axis", () => {
        const items = [
            item({ id: "hit", title: "Sonatina", grade: 2, kind: "song" }),
            item({ id: "wrong-grade", title: "Sonatina", grade: 4, kind: "song" }),
            item({ id: "wrong-kind", title: "Sonatina", grade: 2, kind: "study" }),
            item({ id: "unstarred", title: "Sonatina", grade: 2, kind: "song" }),
        ];
        const result = filterMusic(
            items,
            {
                query: "sona",
                kind: "song",
                grades: new Set([2]),
                favoritesOnly: true,
                dueOnly: false,
                freshOnly: false,
            },
            { ...emptyContext, favorites: new Set(["hit", "wrong-grade", "wrong-kind"]) },
        );
        expect(result.map((entry) => entry.id)).toEqual(["hit"]);
    });
});

describe("toggledGrade", () => {
    it("adds an unselected grade and removes a selected one, leaving neighbours alone", () => {
        const withThree = toggledGrade(new Set([1]), 3);
        expect([...withThree].sort()).toEqual([1, 3]);
        const withoutOne = toggledGrade(withThree, 1);
        expect([...withoutOne]).toEqual([3]);
    });

    it("returns a new set rather than mutating the input", () => {
        const before = new Set([2]);
        toggledGrade(before, 2);
        expect(before.has(2)).toBe(true);
    });
});

describe("dueCount", () => {
    it("counts only the entries due at the given time", () => {
        expect(
            dueCount(
                {
                    due: mastery({ reviewAt: NOW - 1 }),
                    alsoDue: mastery({ reviewAt: NOW - 5_000 }),
                    fresh: mastery({ reviewAt: NOW + 86_400_000 }),
                },
                NOW,
            ),
        ).toBe(2);
    });

    it("is zero with no mastery at all", () => {
        expect(dueCount({}, NOW)).toBe(0);
    });
});

describe("foldForSearch", () => {
    it("takes the marks off a letter, so a keyboard without them still finds the piece", () => {
        expect(foldForSearch("Hänschen Klein")).toBe("hanschen klein");
        expect(foldForSearch("Für Elise")).toBe("fur elise");
        expect(foldForSearch("Gabriel Fauré")).toBe("gabriel faure");
        expect(foldForSearch("Antonín Dvořák")).toBe("antonin dvorak");
    });

    it("settles the apostrophes a title can be typed with", () => {
        expect(foldForSearch("O\u2019Carolan")).toBe("o'carolan");
        expect(foldForSearch("O'Carolan")).toBe("o'carolan");
    });

    it("leaves a script whose marks are not accents exactly as it is", () => {
        // The dakuten is what tells \u30cf from \u30d0 from \u30d1: stripping it would fold three
        // syllables into one and match a title nobody typed.
        expect(foldForSearch("\u30a2\u30eb\u30da\u30b8\u30aa")).toBe("\u30a2\u30eb\u30da\u30b8\u30aa");
        expect(foldForSearch("Прелюдия")).toBe("прелюдия");
    });
});

describe("searching the shelf", () => {
    const shelf = [
        item({ id: "a", title: "Hänschen Klein", composer: "Deutsches Kinderlied" }),
        item({ id: "b", title: "Für Elise", composer: "Ludwig van Beethoven" }),
        item({ id: "c", title: "Clair de lune", composer: "Claude Debussy" }),
    ];
    const found = (query: string) =>
        filterMusic(shelf, { ...EMPTY_MUSIC_FILTER, query }, emptyContext).map((one) => one.id);

    it("finds a piece typed without its accents", () => {
        // The case that sent a reader away empty-handed: no umlaut key, no result.
        expect(found("hanschen")).toEqual(["a"]);
        expect(found("fur elise")).toEqual(["b"]);
    });

    it("still finds it typed with them", () => {
        expect(found("hänschen")).toEqual(["a"]);
        expect(found("Für")).toEqual(["b"]);
    });

    it("searches the composer the same way", () => {
        expect(found("debussy")).toEqual(["c"]);
    });
});

describe("musicOrder", () => {
    it("puts the gentlest of a grade first, and every grade in order", () => {
        const shelf = [
            item({ id: "g2-hard", grade: 2, cost: 9 }),
            item({ id: "g1-hard", grade: 1, cost: 5 }),
            item({ id: "g1-easy", grade: 1, cost: 1 }),
            item({ id: "g2-easy", grade: 2, cost: 2 }),
        ];
        expect(musicOrder(shelf).map((one) => one.id)).toEqual([
            "g1-easy",
            "g1-hard",
            "g2-easy",
            "g2-hard",
        ]);
    });

    it("sorts an unmeasured piece last within its grade rather than first", () => {
        // A missing cost is "we never measured this", not "this is the gentlest thing
        // here" — which is what a zero would have claimed.
        const shelf = [item({ id: "unknown", grade: 1 }), item({ id: "measured", grade: 1, cost: 4 })];
        expect(musicOrder(shelf).map((one) => one.id)).toEqual(["measured", "unknown"]);
    });

    it("settles a tie by title, so the same shelf always reads the same way", () => {
        const shelf = [
            item({ id: "b", title: "Bourrée", grade: 1, cost: 2 }),
            item({ id: "a", title: "Aria", grade: 1, cost: 2 }),
        ];
        expect(musicOrder(shelf).map((one) => one.id)).toEqual(["a", "b"]);
    });

    it("leaves the shelf it was given alone", () => {
        const shelf = [item({ id: "b", grade: 2 }), item({ id: "a", grade: 1 })];
        musicOrder(shelf);
        expect(shelf.map((one) => one.id)).toEqual(["b", "a"]);
    });
});

describe("the fresh filter", () => {
    const shelf = [item({ id: "played" }), item({ id: "never" })];
    const context = {
        favorites: new Set<string>(),
        mastery: { played: mastery({}) },
        now: NOW,
    };

    it("keeps only the pieces with no history at all", () => {
        const fresh = filterMusic(
            shelf,
            { ...EMPTY_MUSIC_FILTER, freshOnly: true },
            context,
        ).map((one) => one.id);
        expect(fresh).toEqual(["never"]);
    });

    it("counts a piece as played the moment it has a record, however bad the run", () => {
        // A stumbled-through attempt is still an answer to "have I tried this?".
        const stumbled = { ...context, mastery: { played: mastery({ learned: false, bestScore: 10 }) } };
        expect(
            filterMusic(shelf, { ...EMPTY_MUSIC_FILTER, freshOnly: true }, stumbled).map(
                (one) => one.id,
            ),
        ).toEqual(["never"]);
    });

    it("is off by default, so the shelf is the whole shelf", () => {
        expect(filterMusic(shelf, EMPTY_MUSIC_FILTER, context)).toHaveLength(2);
    });
});
