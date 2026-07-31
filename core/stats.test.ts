// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { maxOf, median, minOf } from "./stats";

describe("median", () => {
    it("returns 0 for an empty list", () => {
        expect(median([])).toBe(0);
    });

    it("takes the middle value of an odd-length list, regardless of order", () => {
        expect(median([5, 1, 3])).toBe(3);
        expect(median([9])).toBe(9);
    });

    it("averages the two middle values of an even-length list", () => {
        expect(median([1, 2, 3, 4])).toBe(2.5);
        expect(median([10, 20])).toBe(15);
    });

    it("does not mutate the input", () => {
        const input = [3, 1, 2];
        median(input);
        expect(input).toEqual([3, 1, 2]);
    });
});

describe("minOf / maxOf", () => {
    it("reports the extremes of a list", () => {
        expect(minOf([3, 1, 2], 0)).toBe(1);
        expect(maxOf([3, 1, 2], 0)).toBe(3);
    });

    it("uses the fallback only for an empty list", () => {
        expect(minOf([], 60)).toBe(60);
        expect(maxOf([], 60)).toBe(60);
        // A list whose every value sits above the fallback still reports its own
        // minimum — the fallback is a stand-in for nothing, never a seed.
        expect(minOf([70, 80], 60)).toBe(70);
        expect(maxOf([10, 20], 60)).toBe(20);
    });

    it("folds a list too long to spread into an argument list", () => {
        // Math.min(...values) overflows the call stack around 125,000 arguments; a
        // piece imported from a large MIDI file reaches that.
        const many = Array.from({ length: 200_000 }, (_, i) => i);
        expect(minOf(many, 0)).toBe(0);
        expect(maxOf(many, 0)).toBe(199_999);
    });
});
