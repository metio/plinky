// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ExerciseMeta } from "./exercises";

// Pins the shipped exercise catalogue's contract: every exercise carries a difficulty
// cost (so the skill rating reads songs and exercises uniformly) and the catalogue is
// ordered easiest-first within each grade, the order the library renders.
const manifest: ExerciseMeta[] = JSON.parse(readFileSync("public/exercises/manifest.json", "utf8"));

describe("exercise manifest", () => {
    it("gives every exercise a finite numeric cost", () => {
        expect(manifest.length).toBeGreaterThan(0);
        expect(
            manifest.every((item) => typeof item.cost === "number" && Number.isFinite(item.cost)),
        ).toBe(true);
    });

    it("orders exercises by grade then cost, so each grade climbs gently", () => {
        for (let i = 1; i < manifest.length; i++) {
            const prev = manifest[i - 1]!;
            const curr = manifest[i]!;
            const ordered =
                curr.grade > prev.grade || (curr.grade === prev.grade && curr.cost >= prev.cost);
            expect(ordered).toBe(true);
        }
    });
});
