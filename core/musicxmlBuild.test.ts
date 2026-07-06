// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { alterFor, type BuiltNote, buildScore } from "./musicxmlBuild";
import { parseMusicXml } from "./musicxmlParse";
import { scoreToBars, staffFor } from "./scoreToBars";

const q = (step: string, octave: number, alter = 0): BuiltNote => ({
    pitch: { step, octave, alter },
    value: "quarter",
});

describe("alterFor", () => {
    it("sharpens the letters a sharp key signature raises", () => {
        expect(alterFor("F", 1)).toBe(1); // G major sharpens F
        expect(alterFor("C", 1)).toBe(0);
    });

    it("flattens the letters a flat key signature lowers", () => {
        expect(alterFor("B", -1)).toBe(-1); // F major flattens B
        expect(alterFor("E", -1)).toBe(0);
    });

    it("leaves every letter natural in C major", () => {
        expect(alterFor("F", 0)).toBe(0);
        expect(alterFor("B", 0)).toBe(0);
    });
});

describe("buildScore", () => {
    it("builds a single-staff score that parses back to its notes", () => {
        const xml = buildScore({
            title: "Scale",
            fifths: 0,
            beatsPerBar: 4,
            treble: [q("C", 4), q("D", 4), q("E", 4), q("F", 4)],
        });
        expect(parseMusicXml(domXmlCodec, xml)!.notes.map((n) => n.pitch)).toEqual([60, 62, 64, 65]);
    });

    it("escapes XML-special characters in the title yet stays well-formed", () => {
        const xml = buildScore({ title: "A & B <C>", fifths: 0, beatsPerBar: 4, treble: [q("C", 4)] });
        expect(xml).toContain("A &amp; B &lt;C&gt;");
        expect(domXmlCodec.parse(xml)).not.toBeNull();
    });

    it("keeps a bass line that outlasts the treble rather than truncating it", () => {
        // One treble bar, two bass bars: the second bass bar must survive.
        const treble = [q("C", 4), q("C", 4), q("C", 4), q("C", 4)];
        const bass = [
            q("C", 3), q("C", 3), q("C", 3), q("C", 3),
            q("G", 2), q("G", 2), q("G", 2), q("G", 2),
        ];
        const xml = buildScore({ title: "Grand", fifths: 0, beatsPerBar: 4, treble, bass });
        const bassBars = scoreToBars(domXmlCodec, xml, staffFor("left"));
        expect(bassBars.length).toBe(2);
        expect(bassBars[1]).toEqual([[43], [43], [43], [43]]); // four G2 (MIDI 43) positions
    });

    it("rewinds the bass by the treble's real duration when the final measure is partial", () => {
        // Five quarters per hand: a full first bar, then a one-quarter second bar.
        const treble = [q("C", 5), q("D", 5), q("E", 5), q("F", 5), q("G", 5)];
        const bass = [q("C", 3), q("D", 3), q("E", 3), q("F", 3), q("G", 3)];
        const xml = buildScore({ title: "Partial", fifths: 0, beatsPerBar: 4, treble, bass });
        // The full first bar rewinds a whole bar (8 divisions); the partial final bar holds
        // one quarter, so it rewinds only 2. A fixed full-bar backup there would rewind
        // before the bar start and desync the bass from the treble.
        expect(xml).toContain("<backup><duration>8</duration></backup>");
        expect(xml).toContain("<backup><duration>2</duration></backup>");
        expect(scoreToBars(domXmlCodec, xml, staffFor("right")).length).toBe(2);
        expect(scoreToBars(domXmlCodec, xml, staffFor("left"))).toEqual([
            [[48], [50], [52], [53]], // C3 D3 E3 F3
            [[55]], // G3
        ]);
    });
});
