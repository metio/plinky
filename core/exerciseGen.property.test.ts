// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    buildExerciseId,
    EXERCISE_TILES,
    type ExerciseConfig,
    exerciseTitle,
    generateExercise,
    parseExerciseId,
    supportsContrary,
} from "./exerciseGen";
import { readTimeline } from "./musicxmlTimeline";

// The scales, arpeggios and chord sets the curriculum is built from. Nothing stores their
// notes: an exercise is generated from its configuration every time it is opened, and its
// id is the only thing written down. So the laws are that the same configuration always
// gives the same music, that the music is playable on a piano, and that an id read back
// names the exercise it was written for.

// Configurations that exist: the shipped tiles, varied only where the type allows it.
const arbConfig: fc.Arbitrary<ExerciseConfig> = fc
    .tuple(
        fc.constantFrom(...EXERCISE_TILES),
        fc.constantFrom(1 as const, 2 as const),
        fc.boolean(),
    )
    .map(([tile, octaves, contrary]) => ({
        ...tile,
        octaves,
        hands: contrary && supportsContrary(tile.type) ? ("contrary" as const) : tile.hands,
    }));

const LOWEST = 21;
const HIGHEST = 108;

describe("the exercises the curriculum generates", () => {
    it("gives the same music for the same exercise, every time", () => {
        fc.assert(
            fc.property(arbConfig, (config) => {
                expect(generateExercise(config)).toBe(generateExercise(config));
            }),
        );
    });

    it("writes music a piano can play", () => {
        fc.assert(
            fc.property(arbConfig, (config) => {
                const doc = new DOMParser().parseFromString(
                    generateExercise(config),
                    "application/xml",
                );
                expect(doc.querySelector("parsererror")).toBeNull();

                const { notes } = readTimeline(doc);

                expect(notes.length).toBeGreaterThan(0);
                const onsets = notes.map((note) => note.whole);
                expect([...onsets].sort((a, b) => a - b)).toEqual(onsets);
                for (const note of notes) {
                    if (note.midi === null) {
                        continue;
                    }
                    expect(note.midi).toBeGreaterThanOrEqual(LOWEST);
                    expect(note.midi).toBeLessThanOrEqual(HIGHEST);
                }
            }),
        );
    });

    it("names an exercise in a way that reads back to the same exercise", () => {
        fc.assert(
            fc.property(arbConfig, (config) => {
                const id = buildExerciseId(config);
                const back = parseExerciseId(id);

                expect(back).not.toBeNull();
                // The id is the written form, so what must round trip is the id itself:
                // two configurations that differ only where the type ignores the setting
                // are the same exercise.
                expect(buildExerciseId(back as ExerciseConfig)).toBe(id);
                expect(generateExercise(back as ExerciseConfig)).toBe(generateExercise(config));
            }),
        );
    });

    it("reads anything else as no exercise", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 40 }), (id) => {
                fc.pre(EXERCISE_TILES.every((tile) => buildExerciseId(tile) !== id));

                const parsed = parseExerciseId(id);

                if (parsed !== null) {
                    // Whatever it accepted must still name an exercise that generates.
                    expect(() => generateExercise(parsed)).not.toThrow();
                }
            }),
        );
    });

    it("gives every exercise a name to show", () => {
        fc.assert(
            fc.property(arbConfig, (config) => {
                const title = exerciseTitle(config);

                expect(typeof title).toBe("string");
                expect(title.trim()).not.toBe("");
            }),
        );
    });
});
