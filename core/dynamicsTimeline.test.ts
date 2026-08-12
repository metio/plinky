// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type DynamicPoint, volumeAt } from "./dynamics";

const at = (whole: number, volume: number, ramp = false): DynamicPoint => ({
    whole,
    volume,
    ramp,
});

describe("volumeAt", () => {
    it("asks for nothing before the first mark", () => {
        expect(volumeAt([], 0)).toBeNull();
        expect(volumeAt([at(2, 76)], 1)).toBeNull();
    });

    it("holds a mark until the next one", () => {
        const marks = [at(0, 28), at(4, 108)];
        expect(volumeAt(marks, 0)).toBe(28);
        expect(volumeAt(marks, 3.99)).toBe(28);
        expect(volumeAt(marks, 4)).toBe(108);
        expect(volumeAt(marks, 40)).toBe(108);
    });

    it("slides across a hairpin instead of stepping at its end", () => {
        // p at bar 1 swelling to f at bar 5: halfway through, halfway between them.
        const marks = [at(0, 28, true), at(4, 108)];
        expect(volumeAt(marks, 0)).toBe(28);
        expect(volumeAt(marks, 2)).toBe(68);
        expect(volumeAt(marks, 3)).toBe(88);
        expect(volumeAt(marks, 4)).toBe(108);
    });

    it("holds a hairpin's own level when nothing follows it", () => {
        // A wedge the score never resolves has no target to swell toward.
        expect(volumeAt([at(0, 28, true)], 8)).toBe(28);
    });

    it("takes the last of two marks written at one position", () => {
        expect(volumeAt([at(0, 28), at(0, 108)], 0)).toBe(108);
    });

    it("gives a hairpin with nowhere to travel the mark that closes it", () => {
        // Both written at one position: there is no span to slide across, and the later
        // mark is the one in force.
        expect(volumeAt([at(0, 28, true), at(0, 108)], 0)).toBe(108);
    });

    it("reads a mark written at a triplet's rounded onset", () => {
        const third = 1 / 3;
        expect(volumeAt([at(third, 76)], third)).toBe(76);
    });
});
