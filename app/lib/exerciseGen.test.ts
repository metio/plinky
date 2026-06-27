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

    it("encodes and parses a form variant", () => {
        const config = {
            type: "major-arpeggio" as const,
            key: "c",
            octaves: 2 as const,
            hands: "both" as const,
            inversion: 1 as const,
        };
        const id = buildExerciseId(config);
        expect(id).toBe("arpeggio-c-major.2bi1");
        expect(parseExerciseId(id)).toEqual(config);
    });

    it("rejects non-exercise ids", () => {
        expect(parseExerciseId("twinkle-twinkle")).toBeNull();
        expect(parseExerciseId("QmAbc123")).toBeNull();
    });

    it("has 96 tiles that all round-trip", () => {
        expect(EXERCISE_TILES).toHaveLength(96);
        for (const tile of EXERCISE_TILES) {
            expect(parseExerciseId(buildExerciseId(tile))).toEqual(tile);
        }
    });
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

    it("raises the 7th in harmonic minor (A harmonic minor has G♯)", () => {
        const xml = generateExercise(parseExerciseId("scale-a-harmonic-minor")!);
        expect(xml).toContain("<step>G</step><alter>1</alter>");
    });

    it("emits two parts for both hands and contrary motion", () => {
        const both = generateExercise({
            type: "major-scale",
            key: "c",
            octaves: 1,
            hands: "both",
            inversion: 0,
        });
        expect((both.match(/<part id=/g) ?? []).length).toBe(2);
    });
});
