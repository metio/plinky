// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { median } from "./stats";

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
