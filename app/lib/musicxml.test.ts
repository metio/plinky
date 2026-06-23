// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { musicXmlToAbc } from "./musicxml";

function note(step: string, octave: number, duration = 1, extra = ""): string {
    return `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration></note>`;
}

function score(body: string, divisions = 1): string {
    const attributes = `<divisions>${divisions}</divisions><time><beats>4</beats><beat-type>4</beat-type></time>`;
    return `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1"><attributes>${attributes}</attributes>${body}</measure></part></score-partwise>`;
}

describe("musicXmlToAbc", () => {
    it("converts a single-staff melody", () => {
        const abc = musicXmlToAbc(score(note("C", 4) + note("D", 4) + note("E", 4) + note("F", 4)));
        expect(abc).toContain("M:4/4");
        expect(abc).toContain("C D E F |");
        expect(abc).not.toContain("V:2");
    });

    it("merges chord notes into a bracket", () => {
        const chord = note("C", 4, 4) + note("E", 4, 4, "<chord/>") + note("G", 4, 4, "<chord/>");
        expect(musicXmlToAbc(score(chord))).toContain("[CEG]4");
    });

    it("encodes accidentals and octaves", () => {
        const sharp = `<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration></note>`;
        expect(musicXmlToAbc(score(sharp))).toContain("^F");
        expect(musicXmlToAbc(score(note("C", 5)))).toContain("c |"); // octave up is lowercase
        expect(musicXmlToAbc(score(note("C", 3)))).toContain("C, |"); // octave down adds a comma
    });

    it("encodes note lengths relative to a quarter", () => {
        expect(musicXmlToAbc(score(note("C", 4, 2)))).toContain("C2 |"); // half note
        expect(musicXmlToAbc(score(note("C", 4, 1), 2))).toContain("C/2 |"); // eighth (divisions 2)
    });

    it("turns rests into z", () => {
        const rest = `<note><rest/><duration>1</duration></note>`;
        expect(musicXmlToAbc(score(note("C", 4) + rest + note("E", 4)))).toContain("C z E |");
    });

    it("splits a grand staff into two voices", () => {
        const body =
            `<note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><staff>1</staff></note>` +
            `<note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><staff>2</staff></note>`;
        const abc = musicXmlToAbc(score(body));
        expect(abc).toContain("V:1 clef=treble");
        expect(abc).toContain("V:2 clef=bass");
    });

    it("rejects input that is not a score-partwise document", () => {
        expect(() => musicXmlToAbc("not music xml")).toThrow();
    });

    it("omits the length for a note with no duration (never emits C0)", () => {
        const abc = musicXmlToAbc(
            score("<note><pitch><step>C</step><octave>4</octave></pitch></note>"),
        );
        expect(abc).not.toContain("C0");
        expect(abc).toContain("C |");
    });
});
