// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    dueCount,
    EMPTY_LIBRARY_FILTER,
    filterLibrary,
    type LibraryItem,
    toggledGrade,
} from "./library";
import type { Mastery } from "./mastery";

const item = (parts: Partial<LibraryItem>): LibraryItem => ({
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
    ...parts,
});

const emptyContext = { favorites: new Set<string>(), mastery: {}, now: NOW };

describe("filterLibrary", () => {
    it("keeps only the first occurrence of a duplicated id", () => {
        const items = [
            item({ id: "dup", title: "Imported copy" }),
            item({ id: "dup", title: "Catalogue original" }),
            item({ id: "other" }),
        ];
        const result = filterLibrary(items, EMPTY_LIBRARY_FILTER, emptyContext);
        expect(result.map((entry) => entry.title)).toEqual(["Imported copy", "Title"]);
    });

    it("matches the query against title and composer, case-insensitively", () => {
        const items = [
            item({ id: "a", title: "Ode to Joy", composer: "Beethoven" }),
            item({ id: "b", title: "Minuet", composer: "Bach" }),
        ];
        const byTitle = filterLibrary(
            items,
            { ...EMPTY_LIBRARY_FILTER, query: "  ODE " },
            emptyContext,
        );
        expect(byTitle.map((entry) => entry.id)).toEqual(["a"]);
        const byComposer = filterLibrary(
            items,
            { ...EMPTY_LIBRARY_FILTER, query: "bach" },
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
        expect(filterLibrary(items, EMPTY_LIBRARY_FILTER, emptyContext)).toHaveLength(3);
        const studies = filterLibrary(
            items,
            { ...EMPTY_LIBRARY_FILTER, kind: "study" },
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
        const result = filterLibrary(
            items,
            { ...EMPTY_LIBRARY_FILTER, grades: new Set([1, 5]) },
            emptyContext,
        );
        expect(result.map((entry) => entry.id)).toEqual(["g1", "g5"]);
    });

    it("restricts to starred pieces when favoritesOnly is on", () => {
        const items = [item({ id: "starred" }), item({ id: "plain" })];
        const result = filterLibrary(
            items,
            { ...EMPTY_LIBRARY_FILTER, favoritesOnly: true },
            { ...emptyContext, favorites: new Set(["starred"]) },
        );
        expect(result.map((entry) => entry.id)).toEqual(["starred"]);
    });

    it("restricts to due pieces when dueOnly is on, dropping pieces with no mastery", () => {
        const items = [item({ id: "due" }), item({ id: "fresh" }), item({ id: "untracked" })];
        const result = filterLibrary(
            items,
            { ...EMPTY_LIBRARY_FILTER, dueOnly: true },
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
        const result = filterLibrary(
            items,
            {
                query: "sona",
                kind: "song",
                grades: new Set([2]),
                favoritesOnly: true,
                dueOnly: false,
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
