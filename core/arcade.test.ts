// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { arcadeConfig, currentArcadeLevel } from "./arcade";
import { buildExerciseId, generateExercise, parseExerciseId } from "./exerciseGen";

describe("arcadeConfig", () => {
    it("starts on a one-octave right-hand C major scale", () => {
        expect(arcadeConfig(1)).toMatchObject({
            type: "major-scale",
            key: "c",
            octaves: 1,
            hands: "right",
        });
    });

    it("steps through the keys within a stage, then advances the shape", () => {
        // Level 13 wraps past the twelve keys into the second stage (left hand).
        expect(arcadeConfig(13)).toMatchObject({ type: "major-scale", key: "c", hands: "left" });
    });

    it("never runs out — a far level still yields a valid, generatable exercise", () => {
        for (const level of [1, 7, 25, 60, 200]) {
            const config = arcadeConfig(level);
            // The config round-trips through the exercise id and generates real MusicXML.
            expect(parseExerciseId(buildExerciseId(config))).toEqual(config);
            expect(generateExercise(config)).toContain("<score-partwise");
        }
    });
});

describe("currentArcadeLevel", () => {
    it("is the first level not yet cleared", () => {
        // Levels 1-3 cleared, 4 not.
        expect(currentArcadeLevel((level) => level <= 3)).toBe(4);
    });

    it("is level 1 when nothing has been cleared", () => {
        expect(currentArcadeLevel(() => false)).toBe(1);
    });

    it("stops at the cap rather than looping forever", () => {
        expect(currentArcadeLevel(() => true, 10)).toBe(10);
    });
});
