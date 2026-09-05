// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { MAX_GRADE, rawDifficulty } from "../core/scoreDifficulty.ts";
import { gradeForCost, gradeForScore, pieceBoundaries } from "./grading.mts";
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
