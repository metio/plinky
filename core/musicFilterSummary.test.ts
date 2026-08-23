// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    activeFilterCount,
    filterSummaryParts,
    type MusicFilterLabels,
    type MusicFilterState,
    sortedGrades,
} from "./musicFilterSummary";

const labels: MusicFilterLabels = {
    kind: (kind) => `kind:${kind}`,
    grades: (grades) => `grades:${grades.join("+")}`,
    favorites: "favourites",
    fresh: "fresh",
    due: "due",
};

const none: MusicFilterState = {
    kind: "",
    grades: new Set(),
    favoritesOnly: false,
    freshOnly: false,
    dueOnly: false,
};

describe("activeFilterCount", () => {
    it("counts nothing when the library is unfiltered", () => {
        expect(activeFilterCount(none)).toBe(0);
    });

    it("counts each chosen grade separately", () => {
        expect(activeFilterCount({ ...none, grades: new Set([2, 5, 7]) })).toBe(3);
    });

    it("counts a kind, and every toggle that is on", () => {
        expect(
            activeFilterCount({
                ...none,
                kind: "song",
                favoritesOnly: true,
                freshOnly: true,
                dueOnly: true,
            }),
        ).toBe(4);
    });
});

describe("sortedGrades", () => {
    it("reads low to high whatever order they were tapped in", () => {
        expect(sortedGrades({ ...none, grades: new Set([7, 2, 4]) })).toEqual([2, 4, 7]);
    });
});

describe("filterSummaryParts", () => {
    it("says nothing at all when nothing is filtering", () => {
        expect(filterSummaryParts(none, labels)).toEqual([]);
    });

    it("keeps the order the axes are offered in, not the order they were set", () => {
        expect(
            filterSummaryParts(
                {
                    kind: "study",
                    grades: new Set([3, 1]),
                    favoritesOnly: true,
                    freshOnly: false,
                    dueOnly: true,
                },
                labels,
            ),
        ).toEqual(["kind:study", "grades:1+3", "favourites", "due"]);
    });

    it("hands the whole grade list over rather than a joined string", () => {
        const seen: number[][] = [];
        filterSummaryParts(
            { ...none, grades: new Set([6, 6, 2]) },
            {
                ...labels,
                grades: (g) => {
                    seen.push([...g]);
                    return "x";
                },
            },
        );
        expect(seen).toEqual([[2, 6]]);
    });
});
