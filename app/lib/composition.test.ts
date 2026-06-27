// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
    type Composition,
    decodeComposition,
    encodeComposition,
    quantize,
    type RecordedNote,
    toMidiNotes,
    toMusicXml,
    truncateTo,
} from "./composition";
import { packToCode } from "./shareCode";

function note(partial: Partial<RecordedNote>): RecordedNote {
    return { pitch: 60, startMs: 0, durationMs: 500, velocity: 90, ...partial };
}

const composition = (notes: RecordedNote[], tempo = 120, beatsPerBar = 4): Composition => ({
    notes,
    tempo,
    beatsPerBar,
});

describe("quantize", () => {
    it("snaps onsets and lengths to the nearest grid cell", () => {
        // At 120bpm a beat is 500ms; with four subdivisions the grid is 125ms.
        const snapped = quantize([note({ startMs: 130, durationMs: 240 })], 120, 4);
        expect(snapped[0]!.startMs).toBe(125);
        expect(snapped[0]!.durationMs).toBe(250);
    });

    it("never rounds a length below one grid cell", () => {
        const snapped = quantize([note({ startMs: 0, durationMs: 5 })], 120, 4);
        expect(snapped[0]!.durationMs).toBe(125);
    });

    it("leaves pitch and velocity untouched", () => {
        const snapped = quantize([note({ pitch: 67, velocity: 40 })], 120, 4);
        expect(snapped[0]!.pitch).toBe(67);
        expect(snapped[0]!.velocity).toBe(40);
    });
});

describe("truncateTo", () => {
    it("keeps only the first count notes", () => {
        const comp = composition([note({ pitch: 60 }), note({ pitch: 62 }), note({ pitch: 64 })]);
        expect(truncateTo(comp, 2).notes.map((n) => n.pitch)).toEqual([60, 62]);
    });

    it("clamps a negative count to empty", () => {
        const comp = composition([note({})]);
        expect(truncateTo(comp, -3).notes).toEqual([]);
    });
});

describe("toMidiNotes", () => {
    it("converts millisecond timings to quarter-note units", () => {
        // 120bpm: one quarter is 500ms.
        const midi = toMidiNotes(
            composition([note({ startMs: 1000, durationMs: 500, pitch: 64 })]),
        );
        expect(midi).toEqual([{ midi: 64, startQuarters: 2, durationQuarters: 1, velocity: 90 }]);
    });
});

describe("encode/decode round-trip", () => {
    it("restores a composition through the share codec", () => {
        const comp = composition(
            [
                note({ pitch: 60, startMs: 0, durationMs: 480, velocity: 88 }),
                note({ pitch: 64, startMs: 500, durationMs: 240, velocity: 70 }),
                note({ pitch: 67, startMs: 1000, durationMs: 1000, velocity: 110 }),
            ],
            96,
            3,
        );
        const decoded = decodeComposition(encodeComposition(comp));
        expect(decoded).toEqual(comp);
    });

    it("rounds fractional timings to whole milliseconds", () => {
        const comp = composition([note({ startMs: 100.6, durationMs: 249.4 })]);
        const decoded = decodeComposition(encodeComposition(comp));
        expect(decoded!.notes[0]!.startMs).toBe(101);
        expect(decoded!.notes[0]!.durationMs).toBe(249);
    });

    it("round-trips an empty composition", () => {
        const decoded = decodeComposition(encodeComposition(composition([])));
        expect(decoded).toEqual(composition([]));
    });

    it("returns null for a malformed code", () => {
        expect(decodeComposition("not-a-real-code")).toBeNull();
        expect(decodeComposition("")).toBeNull();
    });

    it("rejects a payload whose columns disagree in length", () => {
        // Shape is valid JSON for the codec but the pitch column is short.
        const code = packToCode([120, 4, [0, 100], [100, 100], [60], [90, 90]]);
        expect(decodeComposition(code)).toBeNull();
    });
});

describe("toMusicXml", () => {
    const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

    it("produces well-formed MusicXML", () => {
        const comp = composition([note({ pitch: 60, startMs: 0, durationMs: 500 })]);
        const doc = parse(toMusicXml(comp));
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.querySelector("score-partwise")).not.toBeNull();
    });

    it("splits notes across the two staves at the split point", () => {
        const comp = composition([
            note({ pitch: 72, startMs: 0, durationMs: 500 }), // treble
            note({ pitch: 48, startMs: 0, durationMs: 500 }), // bass
        ]);
        const doc = parse(toMusicXml(comp));
        const staves = [...doc.querySelectorAll("note > staff")].map((s) => s.textContent);
        expect(staves).toContain("1");
        expect(staves).toContain("2");
        // The high note carries the treble pitch, the low note the bass pitch.
        const octaves = [...doc.querySelectorAll("note > pitch > octave")].map(
            (o) => o.textContent,
        );
        expect(octaves).toContain("5"); // C5 = 72
        expect(octaves).toContain("3"); // C3 = 48
    });

    it("each measure's voice fills exactly one bar of divisions", () => {
        const comp = composition(
            [
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 62, startMs: 500, durationMs: 500 }),
                note({ pitch: 64, startMs: 1000, durationMs: 1000 }),
            ],
            120,
            4,
        );
        const doc = parse(toMusicXml(comp));
        // Four divisions per quarter, four quarters per bar.
        const barDivisions = 16;
        for (const measure of doc.querySelectorAll("measure")) {
            let trebleSum = 0;
            let backupSeen = false;
            for (const child of measure.children) {
                if (child.tagName === "backup") {
                    backupSeen = true;
                }
                // Chord notes sound atop the first and don't advance time, so they
                // don't count toward the bar's filled duration.
                if (child.tagName === "note" && !backupSeen && !child.querySelector("chord")) {
                    trebleSum += Number(child.querySelector("duration")?.textContent ?? 0);
                }
            }
            expect(trebleSum).toBe(barDivisions);
        }
    });

    it("ties a note that crosses a barline rather than re-striking it", () => {
        // A two-bar-long note at 120bpm/4-4: 4 seconds spans two whole bars.
        const comp = composition([note({ pitch: 60, startMs: 0, durationMs: 4000 })], 120, 4);
        const doc = parse(toMusicXml(comp));
        expect(doc.querySelector('tie[type="start"]')).not.toBeNull();
        expect(doc.querySelector('tie[type="stop"]')).not.toBeNull();
    });

    it("renders an empty composition as a single resting bar", () => {
        const doc = parse(toMusicXml(composition([])));
        expect(doc.querySelectorAll("measure").length).toBe(1);
        expect(doc.querySelector("rest")).not.toBeNull();
    });

    it("renders simultaneous notes on one staff as a block chord", () => {
        // A C-major triad struck together in the right hand.
        const comp = composition([
            note({ pitch: 60, startMs: 0, durationMs: 500 }),
            note({ pitch: 64, startMs: 0, durationMs: 500 }),
            note({ pitch: 67, startMs: 0, durationMs: 500 }),
        ]);
        const doc = parse(toMusicXml(comp));
        // Three notes at the onset, the upper two flagged as chord members.
        const chordNotes = doc.querySelectorAll("note > chord");
        expect(chordNotes.length).toBe(2);
        const octaves = [...doc.querySelectorAll("note > pitch")].map(
            (p) =>
                `${p.querySelector("step")?.textContent}${p.querySelector("octave")?.textContent}`,
        );
        expect(octaves).toEqual(["C4", "E4", "G4"]);
    });

    it("spells a black key with a sharp accidental", () => {
        const comp = composition([note({ pitch: 61, startMs: 0, durationMs: 500 })]); // C#4
        const doc = parse(toMusicXml(comp));
        expect(doc.querySelector("accidental")?.textContent).toBe("sharp");
        expect(doc.querySelector("alter")?.textContent).toBe("1");
    });
});
