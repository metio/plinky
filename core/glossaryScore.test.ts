// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    buildSnippet,
    DIVISIONS,
    noteDivisions,
    noteQuarters,
    type Snippet,
    snippetMidi,
} from "./glossaryScore";

const bar = (notes: Snippet["notes"], over: Partial<Snippet> = {}): Snippet => ({
    clef: "treble",
    fifths: 0,
    beatsPerBar: 4,
    notes,
    ...over,
});

describe("noteDivisions", () => {
    it("gives a dotted note half its value again", () => {
        expect(noteDivisions({ step: "C", value: "half" })).toBe(8);
        expect(noteDivisions({ step: "C", value: "half", dotted: true })).toBe(12);
    });

    it("keeps a dotted quarter a whole number of divisions", () => {
        // The reason DIVISIONS is 4 rather than 2: a dotted quarter is 3 eighths, and
        // MusicXML durations must be integers.
        expect(noteDivisions({ step: "C", value: "quarter", dotted: true })).toBe(6);
        expect(Number.isInteger(noteDivisions({ step: "C", value: "quarter", dotted: true }))).toBe(
            true,
        );
    });

    it("measures a note's written length in quarter notes", () => {
        expect(noteQuarters({ step: "C", value: "quarter" })).toBe(1);
        expect(noteQuarters({ step: "C", value: "whole" })).toBe(4);
        expect(noteQuarters({ step: "C", value: "sixteenth" })).toBe(1 / DIVISIONS);
    });
});

describe("buildSnippet", () => {
    it("writes the clef, key and time signature once, on the first bar", () => {
        const xml = buildSnippet(
            bar(
                [
                    { step: "C", octave: 5, value: "whole" },
                    { step: "D", octave: 5, value: "whole" },
                ],
                { clef: "bass", fifths: 2 },
            ),
        );

        expect(xml.match(/<attributes>/g)).toHaveLength(1);
        expect(xml).toContain("<sign>F</sign>");
        expect(xml).toContain("<fifths>2</fifths>");
        expect(xml.match(/<measure number="\d+">/g)).toHaveLength(2);
    });

    it("marks a rest without a pitch", () => {
        const xml = buildSnippet(bar([{ step: null, value: "quarter" }]));

        expect(xml).toContain("<rest/>");
        expect(xml).not.toContain("<pitch>");
    });

    it("draws a staccato dot and an accent inside one articulations block", () => {
        const xml = buildSnippet(
            bar([
                { step: "C", octave: 5, value: "quarter", articulation: "staccato", accent: true },
            ]),
        );

        expect(xml).toContain("<articulations><staccato/><accent/></articulations>");
    });

    it("writes a tie as both the sounding instruction and the drawn curve", () => {
        // OSMD draws <tied>; the sounding length comes from <tie>. A snippet carrying
        // only one of them either renders a curve that does not sound or sounds a
        // held note with nothing drawn.
        const xml = buildSnippet(
            bar([
                { step: "G", octave: 4, value: "half", tie: "start" },
                { step: "G", octave: 4, value: "half", tie: "stop" },
            ]),
        );

        expect(xml).toContain('<tie type="start"/>');
        expect(xml).toContain('<tied type="start"/>');
        expect(xml).toContain('<tie type="stop"/>');
        expect(xml).toContain('<tied type="stop"/>');
    });

    it("places a dynamic as a direction before the note it applies to", () => {
        const xml = buildSnippet(bar([{ step: "C", octave: 5, value: "whole", dynamic: "p" }]));

        expect(xml).toContain("<dynamics><p/></dynamics>");
        expect(xml.indexOf("<direction")).toBeLessThan(xml.indexOf("<note>"));
    });

    it("omits the notations block when the note carries no marks", () => {
        // An empty <notations/> is not valid MusicXML.
        const xml = buildSnippet(bar([{ step: "C", octave: 5, value: "whole" }]));

        expect(xml).not.toContain("<notations>");
    });

    it("writes a notehead shape after the accidental, where the schema wants it", () => {
        // Out of order it is dropped rather than rejected, so the example would draw round
        // notes and look right enough to pass a glance.
        const xml = buildSnippet({
            clef: "treble",
            fifths: 0,
            beatsPerBar: 4,
            notes: [
                { step: "C", octave: 4, value: "whole", accidental: "natural", notehead: "do" },
            ],
        });

        expect(xml).toContain("<accidental>natural</accidental><notehead>do</notehead>");
    });

    it("leaves a note with no shape round", () => {
        const xml = buildSnippet({
            clef: "treble",
            fifths: 0,
            beatsPerBar: 4,
            notes: [{ step: "C", octave: 4, value: "whole" }],
        });

        expect(xml).not.toContain("notehead");
    });

    it("writes the dot after the type, where the schema wants it", () => {
        const xml = buildSnippet(bar([{ step: "C", octave: 5, value: "half", dotted: true }]));

        expect(xml).toContain("<type>half</type><dot/>");
    });
});

describe("snippetMidi", () => {
    it("applies the key signature to an unmarked note", () => {
        // F in one sharp is F#: the signature does the work with nothing on the note.
        expect(snippetMidi({ step: "F", octave: 4, value: "quarter" }, 1)).toBe(66);
        expect(snippetMidi({ step: "F", octave: 4, value: "quarter" }, 0)).toBe(65);
    });

    it("lets an accidental on the note override the key signature", () => {
        expect(
            snippetMidi({ step: "F", octave: 4, value: "quarter", accidental: "natural" }, 1),
        ).toBe(65);
    });

    it("puts middle C at 60", () => {
        expect(snippetMidi({ step: "C", octave: 4, value: "quarter" }, 0)).toBe(60);
    });

    it("has no pitch for a rest", () => {
        expect(snippetMidi({ step: null, value: "quarter" }, 0)).toBeNull();
    });
});
