// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { GLOSSARY } from "./glossary";
import { buildSnippet } from "./glossaryScore";
import { symbolsInScore } from "./scoreSymbols";

const ids = (xml: string) => symbolsInScore(xml).map((symbol) => symbol.id);

// A minimal piece: one note, four beats, no key signature, nothing marked.
const PLAIN = `<?xml version="1.0"?><score-partwise version="3.1"><part-list>
<score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">
<measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key>
<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef>
</attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>16</duration>
<type>whole</type></note></measure></part></score-partwise>`;

describe("symbolsInScore", () => {
    it("finds nothing to explain in a plain piece", () => {
        // Four beats to the bar and no sharps or flats are what a reader assumes without
        // being told, so neither is worth pointing at.
        expect(ids(PLAIN)).toEqual([]);
    });

    it("recognises every symbol the glossary explains", () => {
        // The glossary's own examples are the reference implementation of each mark, so
        // every entry must be findable in the notation that demonstrates it — otherwise
        // the two would disagree about what a symbol looks like.
        for (const entry of GLOSSARY) {
            const found = ids(buildSnippet(entry.shown));
            expect(`${entry.id}: ${found.includes(entry.id)}`).toBe(`${entry.id}: true`);
        }
    });

    it("reports a piece's marks in the glossary's order", () => {
        const xml = buildSnippet({
            clef: "treble",
            fifths: 0,
            beatsPerBar: 4,
            notes: [
                { step: "C", octave: 5, value: "quarter", articulation: "staccato" },
                { step: null, value: "quarter" },
                { step: "D", octave: 5, value: "half", dynamic: "f" },
            ],
        });

        // rest (length) comes before staccato (touch) before forte (loudness) — the
        // glossary's grouping, so the list reads the same way the reference does.
        expect(ids(xml)).toEqual(["rest", "staccato", "forte"]);
    });

    it("ignores a key signature of C major and a four-four bar", () => {
        const four = buildSnippet({
            clef: "treble",
            fifths: 0,
            beatsPerBar: 4,
            notes: [{ step: "C", octave: 5, value: "whole" }],
        });
        const three = buildSnippet({
            clef: "treble",
            fifths: 2,
            beatsPerBar: 3,
            notes: [
                { step: "C", octave: 5, value: "quarter" },
                { step: "D", octave: 5, value: "half" },
            ],
        });

        expect(ids(four)).not.toContain("keySignature");
        expect(ids(four)).not.toContain("timeSignature");
        expect(ids(three)).toContain("keySignature");
        expect(ids(three)).toContain("timeSignature");
    });

    it("does not mistake a compound dynamic for a plain one", () => {
        // <mp/> is its own mark; the glossary explains p and f, and claiming a piece
        // uses "piano" because it has a mezzo-piano would send the reader to the wrong
        // entry.
        const mezzo = PLAIN.replace(
            "<note>",
            "<direction><direction-type><dynamics><mp/></dynamics></direction-type></direction><note>",
        );

        expect(ids(mezzo)).not.toContain("piano");
        expect(ids(mezzo)).not.toContain("forte");
    });

    it("only counts a tie that is drawn", () => {
        // <tie> is the sounding instruction; <tied> is the curve a reader can see and
        // ask about. A piece with only the former has nothing on the page to explain.
        const soundingOnly = PLAIN.replace("<type>whole</type>", '<tie type="start"/><type>whole</type>');

        expect(ids(soundingOnly)).not.toContain("tie");
    });
});
