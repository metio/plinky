// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { seedStarterSongs } from "./seed";
import { loadUserSongs } from "./songs";

const PACK = JSON.stringify({
    format: "plinky-songs",
    version: 1,
    curriculums: [],
    songs: [{ id: "s1", title: "S1", abc: "X:1\nK:C\nC", tempo: 90, beatsPerBar: 4 }],
});

afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
});

describe("seedStarterSongs", () => {
    it("imports the starter pack on first run and marks it seeded", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(PACK, { status: 200 })),
        );
        await seedStarterSongs();
        expect(loadUserSongs().map((song) => song.id)).toEqual(["s1"]);
        expect(localStorage.getItem("plinky:seeded")).toBe("1");
    });

    it("does nothing once already seeded", async () => {
        localStorage.setItem("plinky:seeded", "1");
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        await seedStarterSongs();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not mark seeded when the fetch fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new Error("offline");
            }),
        );
        await seedStarterSongs();
        expect(localStorage.getItem("plinky:seeded")).toBeNull();
        expect(loadUserSongs()).toEqual([]);
    });
});
