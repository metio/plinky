// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { alterFor, type BuiltPitch, buildScore } from "./musicxmlBuild";

function pitch(step: string, octave: number, alter = 0): BuiltPitch {
    return { step, octave, alter };
}

describe("alterFor", () => {
    it("sharpens the leading sharps in a sharp key", () => {
        expect(alterFor("F", 1)).toBe(1); // G major sharpens F
        expect(alterFor("C", 1)).toBe(0);
    });

    it("flattens the leading flats in a flat key", () => {
        expect(alterFor("B", -1)).toBe(-1); // F major flattens B
        expect(alterFor("E", -1)).toBe(0);
    });

    it("leaves C major untouched", () => {
        expect(alterFor("F", 0)).toBe(0);
    });
});

describe("buildScore", () => {
    const treble = [pitch("C", 4), pitch("D", 4), pitch("E", 4), pitch("F", 4)];

    it("emits a single-staff score with a measure per bar", () => {
        const xml = buildScore({ title: "Test", fifths: 0, beatsPerBar: 2, treble });
        expect(xml).toContain("<score-partwise");
        expect(xml.match(/<measure /g)).toHaveLength(2); // four notes, two per bar
        expect(xml).not.toContain("<staves>");
    });

    it("renders an accidental from the alter", () => {
        const xml = buildScore({ title: "T", fifths: 1, beatsPerBar: 1, treble: [pitch("F", 4, 1)] });
        expect(xml).toContain("<step>F</step><alter>1</alter><octave>4</octave>");
    });

    it("builds a grand staff with a backup between hands", () => {
        const xml = buildScore({
            title: "T",
            fifths: 0,
            beatsPerBar: 2,
            treble: [pitch("C", 5), pitch("D", 5)],
            bass: [pitch("C", 3), pitch("D", 3)],
        });
        expect(xml).toContain("<staves>2</staves>");
        expect(xml).toContain("<backup><duration>2</duration></backup>");
        expect(xml).toContain("<staff>1</staff>");
        expect(xml).toContain("<staff>2</staff>");
    });

    it("escapes a title that contains markup characters", () => {
        const xml = buildScore({ title: "A & B", fifths: 0, beatsPerBar: 1, treble: [pitch("C", 4)] });
        expect(xml).toContain("<work-title>A &amp; B</work-title>");
    });
});
