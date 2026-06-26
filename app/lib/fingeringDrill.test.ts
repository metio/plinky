// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { generateDrill } from "./fingeringDrill";

const POOL = new Set([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]);

describe("generateDrill", () => {
    it("yields the requested number of positions of in-key notes", () => {
        const line = generateDrill(() => 0.5, 8);
        expect(line).toHaveLength(8);
        for (const position of line) {
            expect(position.length).toBeGreaterThanOrEqual(1);
            expect(position.every((pitch) => POOL.has(pitch))).toBe(true);
            // Each position is sorted ascending with distinct pitches.
            expect([...position].sort((a, b) => a - b)).toEqual(position);
            expect(new Set(position).size).toBe(position.length);
        }
    });

    it("thickens a position into a chord when the rolls allow it", () => {
        // First roll picks a starting index of 2 (room below); the next roll is
        // under the chord chance — so the first position stacks into a chord.
        let call = 0;
        const rng = () => (call++ === 0 ? 0.6 : 0);
        const line = generateDrill(rng, 4);
        expect(line[0]!.length).toBeGreaterThan(1);
    });

    it("is deterministic for a given rng", () => {
        expect(generateDrill(mulberry(42), 8)).toEqual(generateDrill(mulberry(42), 8));
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
