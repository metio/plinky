// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { generateDrill } from "./fingeringDrill";

const POOL = new Set([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]);

describe("generateDrill", () => {
    it("yields the requested number of in-key notes", () => {
        const line = generateDrill(() => 0.5, 8);
        expect(line).toHaveLength(8);
        expect(line.every((pitch) => POOL.has(pitch))).toBe(true);
    });

    it("is deterministic for a given rng", () => {
        const rng = mulberry(42);
        const a = generateDrill(rng, 8);
        expect(generateDrill(mulberry(42), 8)).toEqual(a);
    });

    it("stays within the keyboard range it draws from", () => {
        const line = generateDrill(mulberry(7), 16);
        expect(Math.min(...line)).toBeGreaterThanOrEqual(60);
        expect(Math.max(...line)).toBeLessThanOrEqual(84);
    });
});

// A tiny seeded PRNG so two runs with the same seed produce the same line.
function mulberry(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
