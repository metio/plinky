// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { buildExerciseId, EXERCISE_TILES, generateExercise, parseExerciseId } from "./exerciseGen";

describe("exercise ids", () => {
    it("round-trips canonical base ids unchanged", () => {
        for (const id of [
            "scale-c-major",
            "scale-a-minor",
            "scale-a-harmonic-minor",
            "scale-csharp-minor",
            "scale-c-chromatic",
            "arpeggio-c-major",
            "arpeggio-c-dom7",
        ]) {
            const config = parseExerciseId(id);
            expect(config, id).not.toBeNull();
            expect(buildExerciseId(config!)).toBe(id);
        }
    });

    it("encodes and parses an inversion form variant", () => {
        const config = {
            type: "major-arpeggio" as const,
            key: "c",
            octaves: 2 as const,
            hands: "both" as const,
            inversion: 1 as const,
            interval: "single" as const,
        };
        const id = buildExerciseId(config);
        expect(id).toBe("arpeggio-c-major.2bi1");
        expect(parseExerciseId(id)).toEqual(config);
    });

    it("encodes and parses an interval (thirds/sixths) form variant", () => {
        const config = {
            type: "major-scale" as const,
            key: "c",
            octaves: 2 as const,
            hands: "right" as const,
            inversion: 0 as const,
            interval: "thirds" as const,
        };
        const id = buildExerciseId(config);
        expect(id).toBe("scale-c-major.2rt");
        expect(parseExerciseId(id)).toEqual(config);
    });

    it("rejects non-exercise ids", () => {
        expect(parseExerciseId("twinkle-twinkle")).toBeNull();
        expect(parseExerciseId("QmAbc123")).toBeNull();
    });

    it("has 108 tiles that all round-trip", () => {
        expect(EXERCISE_TILES).toHaveLength(108);
        for (const tile of EXERCISE_TILES) {
            expect(parseExerciseId(buildExerciseId(tile))).toEqual(tile);
        }
    });
});

// Pitches in document order from a generated single-hand exercise, as MIDI-ish
// numbers, read straight from the MusicXML so no DOM is needed.
function pitchSequence(xml: string): number[] {
    const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const out: number[] = [];
    for (const match of xml.matchAll(/<pitch>(.*?)<\/pitch>/gs)) {
        const block = match[1]!;
        const step = block.match(/<step>([A-G])<\/step>/)![1]!;
        const alter = Number(block.match(/<alter>(-?\d+)<\/alter>/)?.[1] ?? 0);
        const octave = Number(block.match(/<octave>(\d+)<\/octave>/)![1]!);
        out.push((octave + 1) * 12 + STEP[step]! + alter);
    }
    return out;
}

describe("arpeggio inversions", () => {
    for (const octaves of [1, 2] as const) {
        for (const inversion of [1, 2] as const) {
            it(`ascends without a duplicate note (${octaves}-octave inversion ${inversion})`, () => {
                const xml = generateExercise({
                    type: "major-arpeggio",
                    key: "c",
                    octaves,
                    hands: "right",
                    inversion,
                    interval: "single",
                });
                const pitches = pitchSequence(xml);
                // No note repeats back-to-back — the old rotation duplicated the tonic.
                for (let i = 1; i < pitches.length; i++) {
                    expect(pitches[i]).not.toBe(pitches[i - 1]);
                }
                // It's a single mountain: one apex, climbed strictly, then descended.
                // The old rotation put the closing tonic mid-run, so the top note
                // recurred and the line dipped before the real turn.
                const top = Math.max(...pitches);
                expect(pitches.filter((p) => p === top)).toHaveLength(1);
                const apex = pitches.indexOf(top);
                for (let i = 1; i <= apex; i++) {
                    expect(pitches[i]!).toBeGreaterThan(pitches[i - 1]!);
                }
                // An inversion starts above the tonic, on a higher chord tone.
                expect(pitches[0]!).toBeGreaterThan(60);
            });
        }
    }
});

describe("generateExercise", () => {
    it("generates valid MusicXML for the canonical form", () => {
        const xml = generateExercise(parseExerciseId("scale-c-major")!);
        expect(xml).toContain("score-partwise");
        expect(xml).toContain("<step>C</step>");
    });

    it("spells a dominant 7th with a flat 7th (C7 has B♭)", () => {
        const xml = generateExercise(parseExerciseId("arpeggio-c-dom7")!);
        expect(xml).toContain("<step>B</step><alter>-1</alter>");
    });

    it("spells a diminished 7th with a double-flat (C°7 has B𝄫)", () => {
        const xml = generateExercise(parseExerciseId("arpeggio-c-dim7")!);
        expect(xml).toContain("<step>B</step><alter>-2</alter>");
        expect(xml).toContain("<step>E</step><alter>-1</alter>");
    });

    it("raises the 7th in harmonic minor (A harmonic minor has G♯)", () => {
        const xml = generateExercise(parseExerciseId("scale-a-harmonic-minor")!);
        expect(xml).toContain("<step>G</step><alter>1</alter>");
    });

    it("emits two parts for both hands", () => {
        const both = generateExercise({
            type: "major-scale",
            key: "c",
            octaves: 1,
            hands: "both",
            inversion: 0,
            interval: "single",
        });
        expect((both.match(/<part id=/g) ?? []).length).toBe(2);
    });

    it("sounds two notes per position in a scale in thirds (C+E)", () => {
        const xml = generateExercise(parseExerciseId("scale-c-major.1rt")!);
        // The double stop prints the upper note as a <chord/>.
        expect(xml).toContain("<chord/>");
        expect(xml).toContain("<step>E</step>");
    });
});
