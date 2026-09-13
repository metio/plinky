// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { MAX_GRADE, rawDifficulty } from "../core/scoreDifficulty.ts";
import { gradeForCost, gradeForScore, pieceBoundaries, reachOf } from "./grading.mts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";

const score = (measure: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes>${measure}</measure></part></score-partwise>`;

const NOTE = `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`;
const REST = `<note><rest/><duration>4</duration><type>whole</type></note>`;

describe("the grade a bake gives a score in hand", () => {
    it("grades a score with nothing fingerable at the top, as the app does", () => {
        // Its cost is 0, and the cost alone reads as the gentlest piece there is; the play
        // page's chip says grade 8 for the same score, and the library must agree with it.
        const xml = score(REST);
        expect(gradeForCost(0, [...pieceBoundaries])).toBe(1);
        expect(gradeForScore(linkedomXmlCodec, xml, 0, [...pieceBoundaries])).toBe(MAX_GRADE);
    });

    it("grades a playable score off its cost", () => {
        const xml = score(NOTE);
        const cost = rawDifficulty(linkedomXmlCodec, xml);
        expect(gradeForScore(linkedomXmlCodec, xml, cost, [...pieceBoundaries])).toBe(
            gradeForCost(cost, [...pieceBoundaries]),
        );
    });
});

describe("the ways into a piece a bake reads off their costs", () => {
    const boundaries = [5, 10, 15];

    it("grades each reduction easier than the piece against the boundaries", () => {
        expect(reachOf({ thinned: 12, outlined: 7, melody: 3 }, 4, boundaries)).toEqual({
            thinned: 3,
            outlined: 2,
            melody: 1,
        });
    });

    it("offers no reduction that grades where the piece already does", () => {
        expect(reachOf({ thinned: 9 }, 2, boundaries)).toEqual({});
    });

    it("offers only the milder of two reductions that land on one grade", () => {
        expect(reachOf({ thinned: 6, outlined: 8, melody: 2 }, 3, boundaries)).toEqual({
            thinned: 2,
            melody: 1,
        });
    });

    it("moves with the boundaries, as the piece's own grade does", () => {
        const costs = { melody: 4 };
        expect(reachOf(costs, 3, boundaries)).toEqual({ melody: 1 });
        expect(reachOf(costs, 3, [3, 10, 15])).toEqual({ melody: 2 });
    });

    it("says nothing about a piece nothing can be taken out of", () => {
        expect(reachOf({}, 8, boundaries)).toEqual({});
    });
});
