// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { crowdedGrade } from "./bakeChecks.mts";

const tile = (grade: number) => ({ kind: "scale-arpeggio", grade });
const study = (grade: number) => ({ kind: "study", grade });

describe("crowdedGrade", () => {
    it("passes a curriculum spread across the grades", () => {
        expect(crowdedGrade([1, 2, 3, 4, 5, 6, 7, 8].map(tile))).toBeNull();
    });

    it("names the grade a collapsed curriculum piled into", () => {
        const collapsed = [...Array.from({ length: 9 }, () => tile(8)), tile(1)];
        expect(crowdedGrade(collapsed)).toContain("grade 8");
    });

    it("tolerates an uneven curriculum, which is normal", () => {
        // Four of nine in one grade: lopsided, but the boundaries are still separating.
        const uneven = [
            tile(1),
            tile(1),
            tile(1),
            tile(1),
            tile(2),
            tile(3),
            tile(4),
            tile(5),
            tile(6),
        ];
        expect(crowdedGrade(uneven)).toBeNull();
    });

    it("judges the tiles alone, since studies are graded on the piece scale", () => {
        // Every study in one grade is a fact about the studies, not about the boundaries
        // the tiles are cut by.
        const mixed = [...Array.from({ length: 20 }, () => study(1)), tile(1), tile(2)];
        expect(crowdedGrade(mixed)).toBeNull();
    });

    it("says nothing about a manifest with no tiles in it", () => {
        expect(crowdedGrade([study(1)])).toBeNull();
        expect(crowdedGrade([])).toBeNull();
    });
});
