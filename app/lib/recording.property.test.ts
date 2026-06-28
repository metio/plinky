// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decodeGhost, encodeGhost, ghostReached } from "./recording";

// A ghost's onsets ascend (notes are played in order); building them as a running
// sum of non-negative integer gaps mirrors a real run while covering the empty,
// long, and repeated-onset cases.
const ascendingOnsets = fc.array(fc.nat({ max: 4000 }), { maxLength: 200 }).map((gaps) => {
    let running = 0;
    return gaps.map((gap) => {
        running += gap;
        return running;
    });
});

describe("recording (ghost) properties", () => {
    it("recovers ascending onsets through encode → decode", () => {
        fc.assert(
            fc.property(ascendingOnsets, (onsets) => {
                expect(decodeGhost(encodeGhost(onsets))).toEqual(onsets);
            }),
        );
    });

    it("returns null rather than throwing on an arbitrary code", () => {
        fc.assert(
            fc.property(fc.string(), (code) => {
                expect(() => decodeGhost(code)).not.toThrow();
            }),
        );
    });

    it("counts a number of reached notes that is in bounds and grows with time", () => {
        fc.assert(
            fc.property(
                ascendingOnsets,
                fc.integer({ min: -1000, max: 12000 }),
                fc.nat({ max: 12000 }),
                (onsets, elapsed, extra) => {
                    const reached = ghostReached(onsets, elapsed);
                    expect(reached).toBeGreaterThanOrEqual(0);
                    expect(reached).toBeLessThanOrEqual(onsets.length);
                    // More elapsed time can only reach the same or more notes.
                    expect(ghostReached(onsets, elapsed + extra)).toBeGreaterThanOrEqual(reached);
                    // Given unbounded time the whole run is reached.
                    expect(ghostReached(onsets, Number.POSITIVE_INFINITY)).toBe(onsets.length);
                },
            ),
        );
    });
});
