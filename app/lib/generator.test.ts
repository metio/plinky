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

// The duration of every note in each measure, so a measure can be checked to fill
// a barful. Divisions are 2 per quarter, so a 4/4 bar is 8.
function measureDurations(xml: string): number[][] {
    return [...xml.matchAll(/<measure [\s\S]*?<\/measure>/g)].map((measure) =>
        [...measure[0].matchAll(/<duration>(\d+)<\/duration>/g)].map((d) => Number(d[1])),
    );
}

describe("generatePhrase varied rhythm", () => {
    const options = { bars: 4, beatsPerBar: 4, twoHands: false, rhythm: "varied" as const };

    it("declares two divisions per quarter so eighths stay whole numbers", () => {
        expect(generatePhrase(options, zero)).toContain("<divisions>2</divisions>");
    });

    it("fills every measure to exactly a barful", () => {
        for (const measure of measureDurations(
            generatePhrase(options, seededRandom(hashString("r"))),
        )) {
            expect(measure.reduce((sum, d) => sum + d, 0)).toBe(8); // 4 beats × 2 divisions
        }
    });

    it("keeps the requested bar count whatever the rhythm", () => {
        expect(measureDurations(generatePhrase(options, () => 0))).toHaveLength(4);
        expect(measureDurations(generatePhrase(options, () => 0.3))).toHaveLength(4);
    });

    it("uses half notes when the roll favours them", () => {
        // rng→0 takes the half-note branch every beat it can.
        const xml = generatePhrase(options, () => 0);
        expect(xml).toContain("<type>half</type>");
        expect(xml).not.toContain("<type>eighth</type>");
    });

    it("uses on-beat eighth pairs when the roll favours them", () => {
        // rng→0.3 misses the half branch but takes the eighth branch.
        const xml = generatePhrase(options, () => 0.3);
        expect(xml).toContain("<type>eighth</type>");
        // Eighths come two at a time, so their count is always even.
        expect((xml.match(/<type>eighth<\/type>/g) ?? []).length % 2).toBe(0);
    });

    it("is deterministic for a given seed", () => {
        const a = generatePhrase(options, seededRandom(hashString("seed")));
        const b = generatePhrase(options, seededRandom(hashString("seed")));
        expect(a).toBe(b);
    });
});
