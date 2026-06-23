// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { exercises, findExercise } from "./exercises";

describe("findExercise", () => {
    it("finds an exercise by id", () => {
        expect(findExercise("c-major-scale")?.title).toBe("C major scale");
    });

    it("returns undefined for an unknown id", () => {
        expect(findExercise("does-not-exist")).toBeUndefined();
    });

    it("returns undefined when no id is given", () => {
        expect(findExercise(undefined)).toBeUndefined();
    });
});

describe("exercise data", () => {
    it("has unique ids", () => {
        const ids = exercises.map((exercise) => exercise.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("gives every exercise a tempo, meter, key, and copy", () => {
        for (const exercise of exercises) {
            expect(exercise.tempo).toBeGreaterThan(0);
            expect(exercise.beatsPerBar).toBeGreaterThan(0);
            expect(exercise.abc).toContain("K:");
            expect(exercise.title.length).toBeGreaterThan(0);
            expect(exercise.description.length).toBeGreaterThan(0);
        }
    });
});
