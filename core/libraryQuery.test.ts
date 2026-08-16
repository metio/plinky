// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { EMPTY_LIBRARY_FILTER } from "./library";
import { libraryFilterParams, readLibraryFilter } from "./libraryQuery";

describe("readLibraryFilter", () => {
    it("reads an empty address as the plain shelf", () => {
        expect(readLibraryFilter({})).toEqual(EMPTY_LIBRARY_FILTER);
    });

    it("keeps the roadmap's single grade working", () => {
        expect([...readLibraryFilter({ grade: "6" }).grades]).toEqual([6]);
    });

    it("reads several grades, and drops what is not one", () => {
        expect([...readLibraryFilter({ grade: "2,4,nine,0,99" }).grades]).toEqual([2, 4]);
    });

    it("takes only a kind the shelf has", () => {
        expect(readLibraryFilter({ kind: "study" }).kind).toBe("study");
        expect(readLibraryFilter({ kind: "sonata" }).kind).toBe("");
    });

    it("reads the toggles as on only when set", () => {
        const on = readLibraryFilter({ starred: "1", due: "1", fresh: "1" });
        expect([on.favoritesOnly, on.dueOnly, on.freshOnly]).toEqual([true, true, true]);
        const off = readLibraryFilter({ starred: "yes", due: "0" });
        expect([off.favoritesOnly, off.dueOnly, off.freshOnly]).toEqual([false, false, false]);
    });
});

describe("libraryFilterParams", () => {
    it("writes nothing for the plain shelf", () => {
        expect(libraryFilterParams(EMPTY_LIBRARY_FILTER)).toEqual({});
    });

    it("writes grades in reading order", () => {
        expect(
            libraryFilterParams({ ...EMPTY_LIBRARY_FILTER, grades: new Set([5, 1, 3]) }).grade,
        ).toBe("1,3,5");
    });

    it("survives the round trip", () => {
        const filter = {
            query: "für elise",
            kind: "song" as const,
            grades: new Set([2, 7]),
            favoritesOnly: true,
            dueOnly: false,
            freshOnly: true,
        };
        expect(readLibraryFilter(libraryFilterParams(filter))).toEqual(filter);
    });
});
