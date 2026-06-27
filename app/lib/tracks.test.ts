// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRACKS, trackSteps } from "./tracks";

// Track steps reference bundled demo pieces (scores/) and finger exercises (the
// generated exercise manifest), so both feed the set of ids a step may point at.
const modules = import.meta.glob("../../scores/*.musicxml", {
    query: "?raw",
    import: "default",
    eager: true,
});
const exerciseManifest = JSON.parse(
    readFileSync("public/exercises/manifest.json", "utf8"),
) as { id: string }[];
const catalogIds = new Set([
    ...Object.keys(modules).map((path) => (path.split("/").pop() ?? "").replace(/\.musicxml$/, "")),
    ...exerciseManifest.map((exercise) => exercise.id),
]);

describe("trackSteps", () => {
    it("marks the first not-done step current, the rest upcoming", () => {
        const steps = trackSteps(["a", "b", "c"], () => false);
        expect(steps.map((step) => step.status)).toEqual(["current", "upcoming", "upcoming"]);
    });

    it("skips done steps and advances the current marker", () => {
        const steps = trackSteps(["a", "b", "c"], (id) => id === "a");
        expect(steps.map((step) => step.status)).toEqual(["done", "current", "upcoming"]);
    });

    it("marks everything done when the track is complete", () => {
        expect(trackSteps(["a"], () => true).map((step) => step.status)).toEqual(["done"]);
    });
});

describe("TRACKS", () => {
    it("every step references a real catalog score", () => {
        for (const track of TRACKS) {
            for (const scoreId of track.scoreIds) {
                expect(catalogIds.has(scoreId), `${track.id} → ${scoreId}`).toBe(true);
            }
        }
    });
});
