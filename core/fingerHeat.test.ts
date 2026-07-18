// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { absoluteHeat, barCosts, barHeat, normalizeHeat } from "./fingerHeat";

// A comfortable stepwise bar versus a bar of wide leaps: the leaps must cost
// more, whatever the exact cost-model numbers are.
const EASY = [[60], [62], [64], [65]];
const HARD = [[60], [79], [55], [84]];

describe("barCosts", () => {
    it("prices a leapy bar above a stepwise one and an empty bar at zero", () => {
        const costs = barCosts([EASY, [], HARD], "right");
        expect(costs[1]).toBe(0);
        expect(costs[2]!).toBeGreaterThan(costs[0]!);
    });

    it("averages per position so a long bar isn't hard just for being long", () => {
        const [short, long] = barCosts([EASY, [...EASY, ...EASY, ...EASY]], "right");
        expect(long!).toBeLessThanOrEqual(short! * 1.5);
    });
});

describe("normalizeHeat", () => {
    it("maps the range to 0..1 with the coldest bar at zero", () => {
        expect(normalizeHeat([2, 0, 6])).toEqual([1 / 3, 0, 1]);
    });

    it("yields all zeros when nothing stands out", () => {
        expect(normalizeHeat([3, 3, 3])).toEqual([0, 0, 0]);
        expect(normalizeHeat([0, 0])).toEqual([0, 0]);
        expect(normalizeHeat([])).toEqual([]);
    });
});

describe("absoluteHeat", () => {
    it("maps cost to 0..1 on a fixed scale, clamped", () => {
        // ABSOLUTE_HOT_COST is 8: half of it reads half-hot, at/over it reads full.
        expect(absoluteHeat([0, 4, 8, 100])).toEqual([0, 0.5, 1, 1]);
    });
});

describe("barHeat", () => {
    it("heats the hardest bar to 1 and keeps a comfortable bar cold", () => {
        const heat = barHeat([EASY, [], HARD], "right");
        expect(heat[1]).toBe(0);
        expect(heat[2]).toBe(1);
        // EASY costs ~0, so it stays cold even with the absolute floor.
        expect(heat[0]!).toBeLessThan(0.5);
    });

    it("stays cold for a uniformly easy piece", () => {
        // A nursery-melody shape: every bar equally, trivially fingerable.
        const heat = barHeat([EASY, EASY, EASY], "right");
        expect(heat).toEqual([0, 0, 0]);
    });

    it("still glows for a uniformly HARD piece instead of washing to zero", () => {
        // Every bar equally hard: relative normalization alone would blank it,
        // but the absolute floor keeps it hot — the whole point of the floor.
        const heat = barHeat([HARD, HARD], "right");
        expect(heat[0]!).toBeGreaterThan(0.5);
        expect(heat[1]!).toBeGreaterThan(0.5);
    });
});
