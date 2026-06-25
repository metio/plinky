// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { fingerLine, fingerSteps } from "./fingering";

describe("fingerLine", () => {
    it("plays a right-hand five-finger position 1–5 in place", () => {
        // C D E F G — fits under one hand with no shift.
        expect(fingerLine([60, 62, 64, 65, 67], "right")).toEqual([1, 2, 3, 4, 5]);
    });

    it("mirrors the left hand, lowest note on the pinky", () => {
        expect(fingerLine([60, 62, 64, 65, 67], "left")).toEqual([5, 4, 3, 2, 1]);
    });

    it("returns a finger in 1..5 for every note of a longer run", () => {
        const scale = [60, 62, 64, 65, 67, 69, 71, 72];
        const fingers = fingerLine(scale, "right");
        expect(fingers).toHaveLength(scale.length);
        expect(fingers.every((finger) => finger >= 1 && finger <= 5)).toBe(true);
        // A line wider than five notes must pass the thumb to shift position.
        expect(fingers.filter((finger) => finger === 1).length).toBeGreaterThan(1);
    });

    it("handles an empty line", () => {
        expect(fingerLine([], "right")).toEqual([]);
    });
});

describe("fingerSteps", () => {
    it("fingers each step by its melody note", () => {
        const steps = [{ pitches: [60] }, { pitches: [62] }, { pitches: [64] }];
        expect(fingerSteps(steps, "right")).toEqual([1, 2, 3]);
    });

    it("uses the lowest note of a chord for the left hand", () => {
        const steps = [{ pitches: [48, 55] }, { pitches: [50, 57] }];
        expect(fingerSteps(steps, "left")).toHaveLength(2);
    });

    it("handles a repeated note without crashing", () => {
        const fingers = fingerLine([60, 60, 60], "right");
        expect(fingers).toHaveLength(3);
        expect(fingers.every((finger) => finger >= 1 && finger <= 5)).toBe(true);
    });

    it("skips empty steps instead of emitting Infinity-driven fingers", () => {
        const steps = [{ pitches: [60] }, { pitches: [] }, { pitches: [64] }];
        const fingers = fingerSteps(steps, "right");
        expect(fingers).toHaveLength(2);
        expect(fingers.every((finger) => finger >= 1 && finger <= 5)).toBe(true);
    });
});
