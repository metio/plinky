// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { Composition } from "./composition";
import { withDeniedStorage } from "./deniedStorage";
import {
    fastestTakeOnsets,
    loadTakes,
    MAX_TAKES_PER_SONG,
    removeTake,
    type Take,
    saveTake,
} from "./savedTakes";

afterEach(() => localStorage.clear());

const comp = (starts: number[]): Composition => ({
    notes: starts.map((startMs, i) => ({ pitch: 60 + i, startMs, durationMs: 200, velocity: 90 })),
    tempo: 120,
    beatsPerBar: 4,
});

const take = (id: string, overrides: Partial<Take> = {}): Take => ({
    id,
    createdAt: Number(id),
    letter: "B",
    complete: true,
    composition: comp([0, 500, 1000]),
    ...overrides,
});

describe("saveTake / loadTakes", () => {
    it("round-trips a take through the share codec", () => {
        saveTake("song", take("1"));
        const loaded = loadTakes("song");
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.letter).toBe("B");
        expect(loaded[0]?.composition.notes.map((n) => n.startMs)).toEqual([0, 500, 1000]);
    });

    it("keeps the newest first", () => {
        saveTake("song", take("1"));
        saveTake("song", take("2"));
        expect(loadTakes("song").map((t) => t.id)).toEqual(["2", "1"]);
    });

    it("caps the list and drops the oldest", () => {
        for (let i = 1; i <= MAX_TAKES_PER_SONG + 2; i++) {
            saveTake("song", take(String(i)));
        }
        const loaded = loadTakes("song");
        expect(loaded).toHaveLength(MAX_TAKES_PER_SONG);
        // The two oldest (1, 2) fell off; the newest is first.
        expect(loaded[0]?.id).toBe(String(MAX_TAKES_PER_SONG + 2));
        expect(loaded.map((t) => t.id)).not.toContain("1");
    });

    it("keeps each song's takes separate", () => {
        saveTake("a", take("1"));
        saveTake("b", take("2"));
        expect(loadTakes("a").map((t) => t.id)).toEqual(["1"]);
        expect(loadTakes("b").map((t) => t.id)).toEqual(["2"]);
    });

    it("removes a take by id", () => {
        saveTake("song", take("1"));
        saveTake("song", take("2"));
        expect(removeTake("song", "1").map((t) => t.id)).toEqual(["2"]);
        expect(loadTakes("song").map((t) => t.id)).toEqual(["2"]);
    });

    it("drops a corrupt stored entry rather than failing the list", () => {
        localStorage.setItem(
            "plinky:takes:song",
            JSON.stringify([
                { id: "ok", createdAt: 1, letter: "A", complete: true, code: "x" },
                "junk",
            ]),
        );
        // The valid entry has an unreadable code, so it's skipped; no throw.
        expect(loadTakes("song")).toEqual([]);
    });
});

describe("fastestTakeOnsets", () => {
    it("returns the onsets of the shortest-span complete take, normalised to zero", () => {
        const slow = take("1", { composition: comp([0, 1000, 2000]) });
        const fast = take("2", { composition: comp([200, 600, 1000]) }); // 800ms span
        expect(fastestTakeOnsets([slow, fast])).toEqual([0, 400, 800]);
    });

    it("ignores incomplete takes", () => {
        const partial = take("1", { complete: false, composition: comp([0, 100]) });
        const full = take("2", { composition: comp([0, 500, 1000]) });
        expect(fastestTakeOnsets([partial, full])).toEqual([0, 500, 1000]);
    });

    it("is null when no complete take exists", () => {
        expect(fastestTakeOnsets([take("1", { complete: false })])).toBeNull();
        expect(fastestTakeOnsets([])).toBeNull();
    });
});

describe("savedTakes under denied storage", () => {
    it("reads an empty list and swallows a save when storage is blocked", () => {
        expect(withDeniedStorage(() => loadTakes("song"))).toEqual([]);
        expect(() => withDeniedStorage(() => saveTake("song", take("1")))).not.toThrow();
    });
});
