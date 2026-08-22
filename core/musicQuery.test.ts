// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { EMPTY_MUSIC_FILTER } from "./music";
import { musicFilterParams, readMusicFilter } from "./musicQuery";

describe("readMusicFilter", () => {
    it("reads an empty address as the plain shelf", () => {
        expect(readMusicFilter({})).toEqual(EMPTY_MUSIC_FILTER);
    });

    it("keeps the roadmap's single grade working", () => {
        expect([...readMusicFilter({ grade: "6" }).grades]).toEqual([6]);
    });

    it("reads several grades, and drops what is not one", () => {
        expect([...readMusicFilter({ grade: "2,4,nine,0,99" }).grades]).toEqual([2, 4]);
    });

    it("takes only a kind the shelf has", () => {
        expect(readMusicFilter({ kind: "study" }).kind).toBe("study");
        expect(readMusicFilter({ kind: "sonata" }).kind).toBe("");
    });

    it("reads the toggles as on only when set", () => {
        const on = readMusicFilter({ starred: "1", due: "1", fresh: "1" });
        expect([on.favoritesOnly, on.dueOnly, on.freshOnly]).toEqual([true, true, true]);
        const off = readMusicFilter({ starred: "yes", due: "0" });
        expect([off.favoritesOnly, off.dueOnly, off.freshOnly]).toEqual([false, false, false]);
    });
});

describe("musicFilterParams", () => {
    it("writes nothing for the plain shelf", () => {
        expect(musicFilterParams(EMPTY_MUSIC_FILTER)).toEqual({});
    });

    it("writes grades in reading order", () => {
        expect(
            musicFilterParams({ ...EMPTY_MUSIC_FILTER, grades: new Set([5, 1, 3]) }).grade,
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
        expect(readMusicFilter(musicFilterParams(filter))).toEqual(filter);
    });
});
