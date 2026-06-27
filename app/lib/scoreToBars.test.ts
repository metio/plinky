// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { scoreToBars, staffFor, windowPositions } from "./scoreToBars";

const note = (step: string, octave: number, staff: number, chord = false) =>
    `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch><staff>${staff}</staff></note>`;

const XML = `<score-partwise><part id="P1">
  <measure number="1">
    ${note("C", 4, 1)}${note("E", 4, 1, true)}${note("G", 4, 1)}${note("C", 3, 2)}
  </measure>
  <measure number="2">
    ${note("D", 4, 1)}<note><rest/><staff>1</staff></note>
  </measure>
</part></score-partwise>`;

describe("scoreToBars", () => {
    it("reads the treble hand into bars of positions, grouping chords", () => {
        const bars = scoreToBars(XML, 1);
        // Bar 1: a C4+E4 chord, then a single G4. Bar 2: a single D4 (rest skipped).
        expect(bars).toEqual([[[60, 64], [67]], [[62]]]);
    });

    it("reads the bass hand from the other staff", () => {
        expect(scoreToBars(XML, 2)).toEqual([[[48]], []]);
    });

    it("maps hands to the grand-staff split", () => {
        expect(staffFor("right")).toBe(1);
        expect(staffFor("left")).toBe(2);
    });

    it("returns nothing for unreadable XML", () => {
        expect(scoreToBars("not xml at all <", 1)).toEqual([]);
    });

    it("flattens a bar window in play order, clamped to range", () => {
        const bars = scoreToBars(XML, 1);
        expect(windowPositions(bars, 0, 2)).toEqual([[60, 64], [67], [62]]);
        expect(windowPositions(bars, 1, 2)).toEqual([[62]]);
    });
});
