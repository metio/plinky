// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MusicItem } from "./music";
import { candidatesForGrade, pickForGrade } from "./pickForGrade";

const item = (id: string, grade: number, kind: MusicItem["kind"] = "song"): MusicItem => ({
    id,
    title: id,
    composer: "Anon",
    grade,
    removable: false,
    kind,
});

const shelf = [item("a", 1), item("b", 2), item("c", 2), item("d", 2, "study"), item("e", 3)];

describe("candidatesForGrade", () => {
    it("keeps only the asked-for grade", () => {
        expect(candidatesForGrade(shelf, 2).map((i) => i.id)).toEqual(["b", "c", "d"]);
    });

    it("honours an excluded id and a kind", () => {
        expect(
            candidatesForGrade(shelf, 2, { exclude: new Set(["b"]), kind: "song" }).map(
                (i) => i.id,
            ),
        ).toEqual(["c"]);
    });
});

describe("pickForGrade", () => {
    it("says nothing rather than hands back a wrong piece", () => {
        expect(pickForGrade(shelf, 9, "seed")).toBeUndefined();
        expect(pickForGrade(shelf, 1, "seed", { exclude: new Set(["a"]) })).toBeUndefined();
    });

    it("always picks from inside the grade", () => {
        fc.assert(
            fc.property(fc.string(), (seed) => {
                expect(pickForGrade(shelf, 2, seed)?.grade).toBe(2);
            }),
        );
    });

    it("gives the same piece for the same seed, so a re-render cannot swap it", () => {
        const first = pickForGrade(shelf, 2, "monday");
        expect(pickForGrade(shelf, 2, "monday")).toBe(first);
    });

    it("gives a different piece for some other seed", () => {
        const seen = new Set(
            ["1", "2", "3", "4", "5", "6", "7", "8"].map((s) => pickForGrade(shelf, 2, s)?.id),
        );
        expect(seen.size).toBeGreaterThan(1);
    });

    it("prefers a piece never played", () => {
        fc.assert(
            fc.property(fc.string(), (seed) => {
                const picked = pickForGrade(shelf, 2, seed, { played: new Set(["b", "c"]) });
                expect(picked?.id).toBe("d");
            }),
        );
    });

    it("falls back to a played piece rather than to nothing", () => {
        const picked = pickForGrade(shelf, 2, "seed", { played: new Set(["b", "c", "d"]) });
        expect(picked).toBeDefined();
        expect(picked?.grade).toBe(2);
    });

    it("never returns an excluded piece, whatever the seed", () => {
        fc.assert(
            fc.property(fc.string(), (seed) => {
                const picked = pickForGrade(shelf, 2, seed, { exclude: new Set(["b", "d"]) });
                expect(picked?.id).toBe("c");
            }),
        );
    });
});
