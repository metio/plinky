// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { blockChords } from "./blockChords";

const note = (step: string, octave: number, duration: number, staff: 1 | 2, alter = 0) =>
    `<note><pitch><step>${step}</step>${alter === 0 ? "" : `<alter>${alter}</alter>`}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;
const attributes = (fifths: number) =>
    `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
const bar = (number: number, right: string, left: string, fifths = 0) =>
    `<measure number="${number}">${number === 1 ? attributes(fifths) : ""}${right}<backup><duration>16</duration></backup>${left}</measure>`;
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
        // The G7 is voiced as its shell, root, third and seventh, in the hand's own
        // register: the Alberti bass sits around G2 to G3, so the chords do too.
        expect(leftHand(blocked)).toEqual([[[48, 52, 55]], [[43, 47, 53]]]);
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
            [43, 47, 50],
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

    // The left hand's block notes as written: letter, then # or b per alter.
    const leftSpelled = (xml: string) =>
        Array.from(domXmlCodec.parse(xml)?.querySelectorAll("note") ?? [])
            .filter(
                (one) =>
                    one.querySelector("staff")?.textContent === "2" && one.querySelector("pitch"),
            )
            .map((one) => {
                const alter = Number(one.querySelector("alter")?.textContent ?? 0);
                return `${one.querySelector("step")?.textContent ?? ""}${alter > 0 ? "#".repeat(alter) : "b".repeat(-alter)}`;
            });

    it("writes a minor key's raised tones with the sharps the key signature's music uses", () => {
        // G minor, then its dominant: the D major chord holds F♯, never G♭.
        const gMinor = score(
            bar(
                1,
                note("B", 4, 8, 1, -1) + note("D", 5, 8, 1),
                note("G", 2, 4, 2) +
                    note("D", 3, 4, 2) +
                    note("B", 2, 4, 2, -1) +
                    note("D", 3, 4, 2),
                -2,
            ) +
                bar(
                    2,
                    note("A", 4, 8, 1) + note("F", 4, 8, 1, 1),
                    note("D", 3, 4, 2) +
                        note("A", 3, 4, 2) +
                        note("F", 3, 4, 2, 1) +
                        note("A", 3, 4, 2),
                ),
        );
        expect(leftSpelled(blockChords(domXmlCodec, gMinor))).toEqual([
            "G",
            "Bb",
            "D",
            "D",
            "F#",
            "A",
        ]);
    });

    it("spells a flat minor key's dominant over its leading tone with a sharp", () => {
        // D minor: the A major chord's third is C♯.
        const dMinor = score(
            bar(
                1,
                note("F", 5, 8, 1) + note("A", 5, 8, 1),
                note("D", 3, 4, 2) + note("A", 3, 4, 2) + note("F", 3, 4, 2) + note("A", 3, 4, 2),
                -1,
            ) +
                bar(
                    2,
                    note("E", 5, 8, 1) + note("A", 5, 8, 1),
                    note("A", 2, 4, 2) +
                        note("E", 3, 4, 2) +
                        note("C", 3, 4, 2, 1) +
                        note("E", 3, 4, 2),
                ),
        );
        expect(leftSpelled(blockChords(domXmlCodec, dMinor)).slice(3)).toEqual(["A", "C#", "E"]);
    });

    it("writes a seventh chord's shell with its sharp third and flat seventh", () => {
        // G minor, then its leading-tone seventh F♯–A–C–E♭ held for the bar over F♯: the
        // shell drops the fifth, so the block is F♯, A and E♭, a sharp and a flat in one
        // chord. Held rather than broken, since an Alberti figure of it reads as two triads.
        const held = (step: string, octave: number, alter = 0) =>
            note(step, octave, 16, 2, alter).replace("<note>", "<note><chord/>");
        const gMinor = score(
            bar(
                1,
                note("B", 4, 8, 1, -1) + note("D", 5, 8, 1),
                note("G", 2, 4, 2) +
                    note("D", 3, 4, 2) +
                    note("B", 2, 4, 2, -1) +
                    note("D", 3, 4, 2),
                -2,
            ) +
                bar(
                    2,
                    note("A", 4, 8, 1) + note("C", 5, 8, 1),
                    note("F", 2, 16, 2, 1) + held("A", 2) + held("C", 3) + held("E", 3, -1),
                ),
        );
        const blocked = blockChords(domXmlCodec, gMinor);
        expect(leftSpelled(blocked).slice(3)).toEqual(["F#", "A", "Eb"]);
        // Read back from letter, alter and octave, the block is F♯ with a minor third and a
        // diminished seventh above it: every octave follows its letter.
        const [bottom, third, seventh] = leftHand(blocked)[1]?.[0] ?? [];
        expect((bottom ?? 0) % 12).toBe(6);
        expect([(third ?? 0) - (bottom ?? 0), (seventh ?? 0) - (bottom ?? 0)]).toEqual([3, 9]);
    });

    it("leaves a single-staff score alone", () => {
        const melody = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>${note("C", 4, 1, 1)}</measure></part></score-partwise>`;
        expect(blockChords(domXmlCodec, melody)).toBe(melody);
    });
});
