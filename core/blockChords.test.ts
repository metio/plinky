// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { blockChords } from "./blockChords";

const note = (step: string, octave: number, duration: number, staff: 1 | 2, alter = 0) =>
    `<note><pitch><step>${step}</step>${alter === 0 ? "" : `<alter>${alter}</alter>`}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;
const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
const bar = (number: number, right: string, left: string) =>
    `<measure number="${number}">${number === 1 ? ATTR : ""}${right}<backup><duration>16</duration></backup>${left}</measure>`;
const score = (bars: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars}</part></score-partwise>`;

// An Alberti bass under a tune: C for a bar, then G7 for a bar.
const ALBERTI = score(
    bar(
        1,
        note("E", 5, 8, 1) + note("G", 5, 8, 1),
        note("C", 3, 4, 2) + note("G", 3, 4, 2) + note("E", 3, 4, 2) + note("G", 3, 4, 2),
    ) +
        bar(
            2,
            note("F", 5, 8, 1) + note("D", 5, 8, 1),
            note("G", 2, 4, 2) + note("B", 2, 4, 2) + note("F", 3, 4, 2) + note("B", 2, 4, 2),
        ),
);

// The left hand of each measure: the pitches sounded together per position, as MIDI.
function leftHand(xml: string): number[][][] {
    const doc = domXmlCodec.parse(xml);
    const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return Array.from(doc?.querySelectorAll("measure") ?? []).map((measure) => {
        const positions: number[][] = [];
        for (const one of Array.from(measure.querySelectorAll("note"))) {
            if (one.querySelector("staff")?.textContent !== "2") {
                continue;
            }
            if (one.querySelector("rest")) {
                positions.push([]);
                continue;
            }
            const midi =
                (Number(one.querySelector("octave")?.textContent) + 1) * 12 +
                (STEP[one.querySelector("step")?.textContent ?? "C"] ?? 0) +
                Number(one.querySelector("alter")?.textContent ?? 0);
            if (one.querySelector("chord") && positions.length > 0) {
                positions[positions.length - 1]?.push(midi);
            } else {
                positions.push([midi]);
            }
        }
        return positions;
    });
}

describe("blockChords", () => {
    it("holds each bar's chord as one block in the left hand, the tune untouched", () => {
        const blocked = blockChords(domXmlCodec, ALBERTI);
        expect(leftHand(blocked)).toEqual([[[48, 52, 55]], [[55, 59, 62]]]);
        // The right hand is the composer's.
        const doc = domXmlCodec.parse(blocked);
        const right = Array.from(doc?.querySelectorAll("note") ?? []).filter(
            (one) => one.querySelector("staff")?.textContent === "1",
        );
        expect(right.map((one) => one.querySelector("step")?.textContent)).toEqual([
            "E",
            "G",
            "F",
            "D",
        ]);
        // A whole-bar chord is written as a whole note.
        const block = Array.from(doc?.querySelectorAll("note") ?? []).find(
            (one) => one.querySelector("staff")?.textContent === "2",
        );
        expect(block?.querySelector("type")?.textContent).toBe("whole");
        expect(block?.querySelector("duration")?.textContent).toBe("16");
    });

    it("cuts the bar where the chord changes inside it", () => {
        const twoChords = score(
            bar(
                1,
                note("E", 5, 8, 1) + note("D", 5, 8, 1),
                note("C", 3, 4, 2) + note("G", 3, 4, 2) + note("G", 2, 4, 2) + note("D", 3, 4, 2),
            ),
        );
        const [measure] = leftHand(blockChords(domXmlCodec, twoChords));
        expect(measure).toEqual([
            [48, 52, 55],
            [55, 59, 62],
        ]);
    });

    it("rests where nothing sounds", () => {
        const silentBar = score(
            bar(
                1,
                note("E", 5, 8, 1) + note("G", 5, 8, 1),
                note("C", 3, 4, 2) + note("E", 3, 4, 2) + note("G", 3, 4, 2) + note("C", 4, 4, 2),
            ) +
                `<measure number="2"><note><rest/><duration>16</duration><voice>1</voice><type>whole</type><staff>1</staff></note><backup><duration>16</duration></backup><note><rest/><duration>16</duration><voice>2</voice><type>whole</type><staff>2</staff></note></measure>`,
        );
        expect(leftHand(blockChords(domXmlCodec, silentBar))[1]).toEqual([[]]);
    });

    it("plays only where the composer's left hand played", () => {
        // A pickup the right hand plays alone: no chord is read off the tune for it.
        const pickup = score(
            `<measure number="1">${ATTR}${note("E", 5, 8, 1)}${note("D", 5, 8, 1)}<backup><duration>16</duration></backup><note><rest/><duration>16</duration><voice>2</voice><type>whole</type><staff>2</staff></note></measure>` +
                bar(
                    2,
                    note("E", 5, 8, 1) + note("G", 5, 8, 1),
                    note("C", 3, 4, 2) +
                        note("G", 3, 4, 2) +
                        note("E", 3, 4, 2) +
                        note("G", 3, 4, 2),
                ),
        );
        expect(leftHand(blockChords(domXmlCodec, pickup))).toEqual([[[]], [[48, 52, 55]]]);
    });

    it("leaves a single-staff score alone", () => {
        const melody = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>${note("C", 4, 1, 1)}</measure></part></score-partwise>`;
        expect(blockChords(domXmlCodec, melody)).toBe(melody);
    });
});
