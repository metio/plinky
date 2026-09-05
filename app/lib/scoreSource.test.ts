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
import { prepareScoreSource, type ScoreSourceInputs } from "./scoreSource";

const note = (step: string, octave: number, beam = "") =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><type>eighth</type>${beam}</note>`;
const PIECE = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Voice</part-name></score-part><score-part id="P2"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes>${note("G", 4)}${note("A", 4)}</measure></part><part id="P2"><measure number="1"><attributes><divisions>2</divisions><staves>2</staves></attributes>${note("C", 4, '<beam number="1">begin</beam>')}${note("D", 4, '<beam number="1">end</beam>')}</measure></part></score-partwise>`;

const asWritten: ScoreSourceInputs = {
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
