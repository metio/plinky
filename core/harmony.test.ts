// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type ChordSpan, type HarmonyNote, readHarmony } from "./harmony";

const FOUR_FOUR = (bars: number) =>
    Array.from({ length: bars }, (_, index) => ({ from: index, beats: 4, beatType: 4 }));

// A note of `quarters` starting `at` quarters into the piece.
const note = (midi: number | null, at: number, quarters = 1): HarmonyNote => ({
    whole: at / 4,
    wholes: quarters / 4,
    midi,
});

// A chord held as block for a bar, or spelled out as an Alberti bass.
const block = (pitches: number[], at: number, quarters = 4) =>
    pitches.map((midi) => note(midi, at, quarters));
const alberti = (low: number, mid: number, high: number, at: number) =>
    [low, high, mid, high, low, high, mid, high].map((midi, index) =>
        note(midi, at + index / 2, 0.5),
    );

const read = (notes: HarmonyNote[], bars = 1, fifths = 0) =>
    readHarmony({ notes, bars: FOUR_FOUR(bars), keys: [{ whole: 0, fifths }], end: bars });

const summary = (span: ChordSpan) => `${span.numeral}@${span.from}-${span.to}`;

describe("readHarmony", () => {
    it("names a block chord with full confidence and its place in the key", () => {
        const [span] = read(block([48, 52, 55], 0));
        expect(span).toMatchObject({
            root: 0,
            quality: "major",
            numeral: "I",
            bass: 0,
            inversion: 0,
            key: { tonic: 0, mode: "major" },
            confidence: 1,
            from: 0,
            to: 1,
        });
    });

    it("hears one chord under an Alberti bass", () => {
        const spans = read(alberti(48, 52, 55, 0));
        expect(spans.map(summary)).toEqual(["I@0-1"]);
        expect(spans[0]?.confidence).toBe(1);
    });

    it("keeps the chord under a melody with passing notes, at a lower confidence", () => {
        // C major held; the tune walks C D E F over it. D and F are not in the chord.
        const notes = [
            ...block([48, 52, 55], 0),
            note(72, 0),
            note(74, 1),
            note(76, 2),
            note(77, 3),
        ];
        const [span] = read(notes);
        expect(span?.numeral).toBe("I");
        expect(span?.confidence).toBeGreaterThan(0.6);
        expect(span?.confidence).toBeLessThan(1);
    });

    it("reads the key off the signature, so the same shape is V in G", () => {
        const [span] = read(block([50, 54, 57], 0), 1, 1);
        expect(span).toMatchObject({ root: 2, numeral: "V", key: { tonic: 7, mode: "major" } });
    });

    it("hears a minor piece as minor, with the harmonic-minor dominant", () => {
        // A minor, E major, A minor: no sharps in the signature, but the music says minor.
        const notes = [
            ...block([45, 48, 52], 0),
            ...block([40, 44, 47], 4),
            ...block([45, 48, 52], 8),
        ];
        const spans = read(notes, 3);
        expect(spans.map((span) => span.numeral)).toEqual(["i", "V", "i"]);
        expect(spans[0]?.key).toEqual({ tonic: 9, mode: "minor", fifths: 0 });
    });

    it("joins beats that agree and splits where the chord changes", () => {
        const notes = [...block([48, 52, 55], 0, 2), ...block([43, 47, 50], 2, 2)];
        expect(read(notes).map(summary)).toEqual(["I@0-0.5", "V@0.5-1"]);
    });

    it("reads two notes as the chord whose root is underneath", () => {
        // In D major, B under D fits B minor and G major alike; the bass decides, as a
        // musician does — B minor, not G with its root missing.
        // A bar of D first, so the mode reads as major rather than as B minor's own.
        const [, span] = read([...block([50, 54, 57], 0), ...block([47, 62], 4)], 2, 2);
        expect(span).toMatchObject({ root: 11, quality: "minor", numeral: "vi" });
    });

    it("names the seventh and the inversion from the bass", () => {
        const [span] = read(block([47, 50, 53, 55], 0));
        expect(span).toMatchObject({
            root: 7,
            quality: "dominant-seventh",
            numeral: "V7",
            inversion: 1,
        });
    });

    it("beats in threes under a compound metre", () => {
        const spans = readHarmony({
            notes: [...block([48, 52, 55], 0, 1.5), ...block([43, 47, 50], 1.5, 1.5)],
            bars: [{ from: 0, beats: 6, beatType: 8 }],
            keys: [{ whole: 0, fifths: 0 }],
            end: 0.75,
        });
        expect(spans.map(summary)).toEqual(["I@0-0.375", "V@0.375-0.75"]);
    });

    it("leaves silence without a chord", () => {
        expect(read([note(null, 0, 4)])).toEqual([]);
        expect(read([])).toEqual([]);
    });

    it("prefers to stay on the chord in force through one ambiguous beat", () => {
        // C major all bar; on beat three only the shared E and G sound, which fit C and
        // E minor equally on their own.
        const notes = [
            ...block([48, 52, 55], 0, 2),
            note(52, 2),
            note(55, 2),
            ...block([48, 52, 55], 3),
        ];
        expect(read(notes).map(summary)).toEqual(["I@0-1"]);
    });
});

describe("readHarmony properties", () => {
    const anyNotes = fc.array(
        fc.record({
            whole: fc.double({ min: 0, max: 3.9, noNaN: true }),
            wholes: fc.double({ min: 0, max: 1, noNaN: true }),
            midi: fc.option(fc.integer({ min: 21, max: 108 }), { nil: null }),
        }),
        { maxLength: 40 },
    );

    it("returns ordered, non-overlapping spans inside the piece, each confident within 0..1", () => {
        fc.assert(
            fc.property(anyNotes, fc.integer({ min: -6, max: 6 }), (notes, fifths) => {
                const spans = read(notes, 4, fifths);
                let last = 0;
                for (const span of spans) {
                    expect(span.from).toBeGreaterThanOrEqual(last - 1e-9);
                    expect(span.to).toBeGreaterThan(span.from);
                    expect(span.to).toBeLessThanOrEqual(4 + 1e-9);
                    expect(span.confidence).toBeGreaterThanOrEqual(0);
                    expect(span.confidence).toBeLessThanOrEqual(1);
                    last = span.to;
                }
            }),
        );
    });
});
