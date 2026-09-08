// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { barsIn, hasFacts, readPieceFacts } from "./pieceFacts";

const score = (measures: number, beats = 3, tempo = 96) =>
    `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list>` +
    `<part id="P1">` +
    Array.from(
        { length: measures },
        (_, index) =>
            `<measure number="${index + 1}">` +
            (index === 0
                ? `<attributes><time><beats>${beats}</beats><beat-type>4</beat-type></time></attributes>` +
                  `<sound tempo="${tempo}"/>`
                : "") +
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>` +
            `</measure>`,
    ).join("") +
    `</part></score-partwise>`;

describe("what a piece is, in numbers", () => {
    it("counts the bars of one part, not of every staff", () => {
        // Every part spans the same music, so counting them all would multiply the length
        // by the number of staves and put a twelve-bar study at twenty-four.
        const twoParts = score(12).replace(
            "</part></score-partwise>",
            `</part><part id="P2">${'<measure number="1"><note><rest/><duration>1</duration></note></measure>'.repeat(12)}</part></score-partwise>`,
        );
        expect(barsIn(domXmlCodec, twoParts)).toBe(12);
    });

    it("reads the length, the count and the speed off the score", () => {
        expect(readPieceFacts(domXmlCodec, score(24, 3, 96))).toEqual({
            bars: 24,
            beatsPerBar: 3,
            tempo: 96,
        });
    });

    it("says nothing where the score could not be read", () => {
        // A page that says "0 bars" is worse than one that does not mention its length.
        const facts = readPieceFacts(domXmlCodec, "not xml at all");
        expect(hasFacts(facts)).toBe(false);
    });

    it("has something to say about an ordinary piece", () => {
        expect(hasFacts(readPieceFacts(domXmlCodec, score(8)))).toBe(true);
    });
});
