// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { stripAccompaniment } from "../../core/accompaniment";
import { stripBeams } from "../../core/beams";
import { transposeMusicXml } from "../../core/transpose";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { fingerKey } from "../stores/fingeringStore";
import { annotateFingerings } from "./fingerScore";
import { pageMarks, prepareScoreSource, type ScoreSourceInputs } from "./scoreSource";

const note = (step: string, octave: number, beam = "") =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><type>eighth</type>${beam}</note>`;
const PIECE = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Voice</part-name></score-part><score-part id="P2"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes>${note("G", 4)}${note("A", 4)}</measure></part><part id="P2"><measure number="1"><attributes><divisions>2</divisions><staves>2</staves></attributes>${note("C", 4, '<beam number="1">begin</beam>')}${note("D", 4, '<beam number="1">end</beam>')}</measure></part></score-partwise>`;

const asWritten: ScoreSourceInputs = {
    chordSymbols: false,
    xml: PIECE,
    transpose: 0,
    handSpan: { left: null, right: null },
    saved: undefined,
    showAccompaniment: true,
    reduction: undefined,
    showBeams: true,
};

const read = (xml: string, selector: string) => [
    ...domXmlCodec.parse(xml)!.querySelectorAll(selector),
];

describe("prepareScoreSource", () => {
    it("hands the engraver the piece as written, with the suggested fingering on it", () => {
        const source = prepareScoreSource(domXmlCodec, asWritten);
        expect(source).toBe(annotateFingerings(domXmlCodec, PIECE, asWritten.handSpan));
        expect(read(source, "fingering").length).toBeGreaterThan(0);
    });

    it("fingers the transposed notes, not the written ones", () => {
        const source = prepareScoreSource(domXmlCodec, { ...asWritten, transpose: 3 });
        const shifted = transposeMusicXml(domXmlCodec, PIECE, 3);
        expect(source).toBe(annotateFingerings(domXmlCodec, shifted, asWritten.handSpan));
        expect(read(source, "part#P2 step").map((el) => el.textContent)).toEqual(["E", "F"]);
    });

    it("drops the other parts after fingering and the beams last", () => {
        const source = prepareScoreSource(domXmlCodec, {
            ...asWritten,
            showAccompaniment: false,
            showBeams: false,
        });
        const annotated = annotateFingerings(domXmlCodec, PIECE, asWritten.handSpan);
        expect(source).toBe(stripBeams(domXmlCodec, stripAccompaniment(domXmlCodec, annotated)));
        expect(read(source, "part").length).toBe(1);
        expect(read(source, "beam")).toHaveLength(0);
        expect(read(source, "fingering").length).toBeGreaterThan(0);
    });

    it("prints the player's own fingering when handed one", () => {
        const source = prepareScoreSource(domXmlCodec, {
            ...asWritten,
            saved: { [fingerKey("right", 0, 0, 0)]: 5 },
        });
        expect(read(source, "fingering")[0]?.textContent).toBe("5");
    });
});

describe("pageMarks", () => {
    // An art song with an arch over the piano's right hand, and the singer above it.
    const crotchet = (step: string, octave: number, notations = "") =>
        `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff>${notations}</note>`;
    const SONG = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Voice</part-name></score-part><score-part id="P2"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes>${crotchet("G", 4)}${crotchet("A", 4)}</measure></part><part id="P2"><measure number="1"><attributes><divisions>2</divisions><staves>2</staves></attributes>${crotchet("C", 5, '<notations><slur number="1" type="start"/></notations>')}${crotchet("D", 5, '<notations><slur number="1" type="stop"/></notations>')}</measure></part></score-partwise>`;
    const marksOf = (showAccompaniment: boolean) =>
        pageMarks(domXmlCodec, { xml: SONG, transpose: 0, showAccompaniment });

    it("numbers the piano's arch for the page drawn with or without the singer", () => {
        expect(marksOf(false).slurs).toEqual([{ from: 0, to: 0.25, staff: 0 }]);
        expect(marksOf(true).slurs).toEqual([{ from: 0, to: 0.25, staff: 1 }]);
    });

    it("puts the arch on the staff the engraver's source draws the piano's right hand on", () => {
        for (const showAccompaniment of [false, true]) {
            const source = domXmlCodec.parse(
                prepareScoreSource(domXmlCodec, {
                    ...asWritten,
                    xml: SONG,
                    showAccompaniment,
                }),
            );
            const above = [...(source?.querySelectorAll("part") ?? [])]
                .filter((part) => part.getAttribute("id") !== "P2")
                .reduce(
                    (sum, part) =>
                        sum + Number(part.querySelector("attributes > staves")?.textContent ?? 1),
                    0,
                );
            expect(marksOf(showAccompaniment).slurs[0]?.staff).toBe(above);
        }
    });

    it("moves the key with the transposition", () => {
        expect(
            pageMarks(domXmlCodec, { xml: SONG, transpose: 2, showAccompaniment: false }).fifths,
        ).toBe(2);
    });
});
