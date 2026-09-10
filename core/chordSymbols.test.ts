// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { withChordSymbols } from "./chordSymbols";

// A grand-staff bar: the right hand plays what `right` says over the left hand's
// crotchets, at four divisions to the crotchet.
const note = (step: string, octave: number, duration: number, staff: 1 | 2, alter = 0) =>
    `<note><pitch><step>${step}</step>${alter === 0 ? "" : `<alter>${alter}</alter>`}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;
const bar = (number: number, right: string, left: string, fifths = 0) =>
    `<measure number="${number}">${number === 1 ? `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>` : ""}${right}<backup><duration>16</duration></backup>${left}</measure>`;
const score = (bars: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars}</part></score-partwise>`;

const cMajorBar = bar(
    1,
    note("E", 5, 8, 1) + note("G", 5, 8, 1),
    note("C", 3, 4, 2) + note("G", 3, 4, 2) + note("E", 3, 4, 2) + note("G", 3, 4, 2),
);
const gSevenBar = bar(
    2,
    note("F", 5, 8, 1) + note("D", 5, 8, 1),
    note("G", 2, 4, 2) + note("B", 2, 4, 2) + note("F", 3, 4, 2) + note("B", 2, 4, 2),
);

const harmonies = (xml: string) =>
    Array.from(domXmlCodec.parse(xml)?.querySelectorAll("harmony") ?? []).map((one) => ({
        root: `${one.querySelector("root-step")?.textContent ?? ""}${one.querySelector("root-alter")?.textContent ?? ""}`,
        kind: one.querySelector("kind")?.textContent,
        bass:
            one.querySelector("bass-step") === null
                ? null
                : `${one.querySelector("bass-step")?.textContent ?? ""}${one.querySelector("bass-alter")?.textContent ?? ""}`,
        before:
            (one.nextElementSibling?.querySelector("step")?.textContent ?? "") +
            (one.nextElementSibling?.querySelector("octave")?.textContent ?? ""),
    }));

describe("withChordSymbols", () => {
    it("writes a symbol before the right hand's first note at each chord", () => {
        const labelled = withChordSymbols(domXmlCodec, score(cMajorBar + gSevenBar));
        expect(harmonies(labelled)).toEqual([
            { root: "C", kind: "major", bass: null, before: "E5" },
            { root: "G", kind: "dominant", bass: null, before: "F5" },
        ]);
    });

    it("leaves a score that writes its own symbols alone", () => {
        const own = score(cMajorBar).replace(
            "<note>",
            "<harmony><root><root-step>C</root-step></root><kind>major</kind></harmony><note>",
        );
        expect(withChordSymbols(domXmlCodec, own)).toBe(own);
    });

    it("says nothing where the reading is not sure", () => {
        // A chromatic run over nothing: no chord fits well enough to name.
        const run = bar(
            1,
            note("C", 5, 4, 1) + note("C", 5, 4, 1, 1) + note("D", 5, 4, 1) + note("D", 5, 4, 1, 1),
            note("F", 3, 4, 2, 1) +
                note("G", 3, 4, 2, 1) +
                note("A", 3, 4, 2, 1) +
                note("B", 3, 4, 2),
        );
        expect(harmonies(withChordSymbols(domXmlCodec, score(run)))).toEqual([]);
    });

    it("spells the root the way a flat key reads", () => {
        // E flat major: the tonic chord is E♭, never D♯.
        const flat = bar(
            1,
            note("G", 5, 8, 1) + note("B", 5, 8, 1, -1),
            note("E", 3, 4, 2, -1) +
                note("B", 3, 4, 2, -1) +
                note("G", 3, 4, 2) +
                note("B", 3, 4, 2, -1),
            -3,
        );
        expect(harmonies(withChordSymbols(domXmlCodec, score(flat)))[0]).toMatchObject({
            root: "E-1",
            kind: "major",
        });
    });

    it("names the bass of an inversion", () => {
        // C held above, E underneath: C major over its third, not E minor.
        const first = bar(
            1,
            note("C", 6, 16, 1),
            note("E", 3, 4, 2) + note("G", 3, 4, 2) + note("C", 4, 4, 2) + note("G", 3, 4, 2),
        );
        expect(harmonies(withChordSymbols(domXmlCodec, score(first)))[0]).toMatchObject({
            root: "C",
            kind: "major",
            bass: "E",
        });
    });

    // A bar in D minor to settle the mode: the tonic triad, D in the bass.
    const dMinorBar = bar(
        1,
        note("F", 5, 8, 1) + note("A", 5, 8, 1),
        note("D", 3, 4, 2) + note("A", 3, 4, 2) + note("F", 3, 4, 2) + note("A", 3, 4, 2),
        -1,
    );

    it("spells a minor key's raised leading tone as the sharp it is written with", () => {
        // D minor's first-inversion dominant: A major over C♯, the textbook V6 to i.
        const dominant = bar(
            2,
            note("A", 5, 8, 1) + note("E", 5, 8, 1),
            note("C", 3, 4, 2, 1) + note("A", 3, 4, 2) + note("E", 3, 4, 2) + note("A", 3, 4, 2),
        );
        expect(harmonies(withChordSymbols(domXmlCodec, score(dMinorBar + dominant)))).toEqual([
            expect.objectContaining({ root: "D", kind: "minor" }),
            expect.objectContaining({ root: "A", kind: "major", bass: "C1" }),
        ]);
    });

    it("names the leading-tone seventh from its sharpened root in a flat minor key", () => {
        const leading = bar(
            2,
            note("B", 5, 8, 1, -1) + note("G", 5, 8, 1),
            note("C", 3, 4, 2, 1) +
                note("E", 3, 4, 2) +
                note("G", 3, 4, 2) +
                note("B", 3, 4, 2, -1),
        );
        expect(harmonies(withChordSymbols(domXmlCodec, score(dMinorBar + leading)))[1]).toEqual(
            expect.objectContaining({ root: "C1", kind: "diminished-seventh" }),
        );
    });

    it("spells the six- and seven-sharp keys with sharps and six flats with flats", () => {
        // The tonic triad of each, in root position: the names the signature spells.
        const tonic = (
            fifths: number,
            root: [string, number],
            third: [string, number],
            fifth: [string, number],
        ) =>
            bar(
                1,
                note(third[0], 5, 8, 1, third[1]) + note(fifth[0], 5, 8, 1, fifth[1]),
                note(root[0], 3, 4, 2, root[1]) +
                    note(fifth[0], 3, 4, 2, fifth[1]) +
                    note(third[0], 3, 4, 2, third[1]) +
                    note(fifth[0], 3, 4, 2, fifth[1]),
                fifths,
            );
        const rootOf = (xml: string) =>
            harmonies(withChordSymbols(domXmlCodec, score(xml)))[0]?.root;
        expect(rootOf(tonic(6, ["F", 1], ["A", 1], ["C", 1]))).toBe("F1");
        expect(rootOf(tonic(7, ["C", 1], ["E", 1], ["G", 1]))).toBe("C1");
        expect(rootOf(tonic(-6, ["G", -1], ["B", -1], ["D", -1]))).toBe("G-1");
    });

    it("hands back what it was given when the file is not a score", () => {
        expect(withChordSymbols(domXmlCodec, "<not-xml")).toBe("<not-xml");
    });
});
