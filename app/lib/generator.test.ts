// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { generatePhrase } from "./generator";
import { hashString, seededRandom } from "./random";

// rng always 0 picks the first scale degree, so the phrase is deterministic.
const zero = () => 0;
const noteCount = (xml: string) => (xml.match(/<note>/g) ?? []).length;

describe("generatePhrase", () => {
    it("emits a titled score-partwise document", () => {
        const xml = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, zero);
        expect(xml).toContain("<score-partwise");
        expect(xml).toContain("<work-title>Sprint</work-title>");
    });

    it("writes one quarter note per beat", () => {
        const xml = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, zero);
        expect(noteCount(xml)).toBe(8);
        expect(xml).toContain("<type>quarter</type>");
    });

    it("carries the chosen key's signature", () => {
        const xml = generatePhrase({ bars: 1, beatsPerBar: 2, twoHands: false, key: "G" }, zero);
        expect(xml).toContain("<fifths>1</fifths>");
        expect(xml).toContain("<step>G</step><octave>4</octave>"); // G major starts on G4
    });

    it("adds a bass staff and backup for two hands", () => {
        const xml = generatePhrase({ bars: 1, beatsPerBar: 3, twoHands: true }, zero);
        expect(xml).toContain("<staves>2</staves>");
        expect(xml).toContain("<backup>");
        expect(noteCount(xml)).toBe(6); // three treble + three bass
    });

    it("is deterministic for a given seed", () => {
        const options = { bars: 4, beatsPerBar: 4, twoHands: false };
        const a = generatePhrase(options, seededRandom(hashString("seed")));
        const b = generatePhrase(options, seededRandom(hashString("seed")));
        expect(a).toBe(b);
    });

    it("stays within the five-finger position", () => {
        // rng→0.99 always picks the top of the scale: G5 in C major.
        const xml = generatePhrase({ bars: 1, beatsPerBar: 2, twoHands: false }, () => 0.99);
        expect(xml).toContain("<step>G</step><octave>5</octave>");
    });

    it("falls back to C major for an unknown key", () => {
        const xml = generatePhrase(
            { bars: 1, beatsPerBar: 2, twoHands: false, key: "Z" as never },
            zero,
        );
        expect(xml).toContain("<fifths>0</fifths>");
    });
});
