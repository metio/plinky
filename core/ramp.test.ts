// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { rampAt } from "./ramp";

const POINTS = [
    { whole: 0, value: 100, ramp: false },
    { whole: 1, value: 60, ramp: true },
    { whole: 2, value: 120, ramp: false },
];
const read = (point: { value: number }) => point.value;

describe("rampAt", () => {
    it("is null before the first mark", () => {
        expect(rampAt(POINTS, -0.5, read)).toBeNull();
    });

    it("holds a value until the next mark", () => {
        expect(rampAt(POINTS, 0.5, read)).toBe(100);
    });

    it("slides toward the next mark where the score writes a ramp", () => {
        expect(rampAt(POINTS, 1.5, read)).toBe(90);
        expect(rampAt(POINTS, 2, read)).toBe(120);
    });

    it("holds the last mark past the end", () => {
        expect(rampAt(POINTS, 5, read)).toBe(120);
    });

    it("tolerates an onset rounding moved by a hair", () => {
        expect(rampAt(POINTS, 1 - 1e-12, read)).toBe(60);
    });
});
