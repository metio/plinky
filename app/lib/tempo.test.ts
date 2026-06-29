// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { findHotspots, instantaneousBpm, median, tempoSeries, type TempoPoint } from "./tempo";

describe("instantaneousBpm", () => {
    it("returns the reference tempo when played exactly on time", () => {
        expect(instantaneousBpm(100, 600, 600)).toBe(100);
    });

    it("reads faster playing as a higher bpm", () => {
        // Half the time for the same notated gap doubles the tempo.
        expect(instantaneousBpm(100, 600, 300)).toBe(200);
    });

    it("reads slower playing as a lower bpm", () => {
        expect(instantaneousBpm(100, 600, 1200)).toBe(50);
    });

    it("guards against a zero or negative gap", () => {
        expect(instantaneousBpm(100, 600, 0)).toBe(0);
    });
});

describe("tempoSeries", () => {
    it("emits one point per gap, starting at the second note", () => {
        // Notated quarter notes at 100 bpm are 600 ms apart.
        const notated = [0, 600, 1200, 1800];
        // Played steadily at 120 bpm: 500 ms apart.
        const actual = [0, 500, 1000, 1500];
        const series = tempoSeries(100, notated, actual);
        expect(series.map((p) => p.index)).toEqual([1, 2, 3]);
        expect(series.every((p) => p.bpm === 120)).toBe(true);
    });

    it("skips a chord or out-of-order gap instead of emitting a 0 bpm point", () => {
        // The third onset repeats the second (a chord), and notated index 3 also
        // repeats: both gaps are non-positive and would otherwise score 0 bpm.
        const notated = [0, 600, 600, 1200];
        const actual = [0, 500, 500, 1000];
        const series = tempoSeries(100, notated, actual);
        // Only the two real gaps survive; no 0-bpm point sneaks in.
        expect(series.map((p) => p.index)).toEqual([1, 3]);
        expect(series.some((p) => p.bpm === 0)).toBe(false);
    });
});

describe("median", () => {
    it("returns 0 for an empty list", () => {
        expect(median([])).toBe(0);
    });

    it("averages the two middle values for an even count", () => {
        expect(median([10, 20, 30, 40])).toBe(25);
    });

    it("takes the middle value for an odd count", () => {
        expect(median([30, 10, 20])).toBe(20);
    });
});

describe("findHotspots", () => {
    function points(bpms: number[]): TempoPoint[] {
        return bpms.map((bpm, i) => ({ index: i + 1, bpm }));
    }

    it("flags a sustained slow stretch", () => {
        const hotspots = findHotspots(points([100, 70, 70, 100]), 100);
        expect(hotspots).toEqual([{ startIndex: 2, endIndex: 3 }]);
    });

    it("ignores a single slow hiccup below the minimum run", () => {
        expect(findHotspots(points([100, 60, 100, 100]), 100)).toEqual([]);
    });

    it("finds a slow stretch that runs to the end", () => {
        const hotspots = findHotspots(points([100, 100, 60, 60]), 100);
        expect(hotspots).toEqual([{ startIndex: 3, endIndex: 4 }]);
    });

    it("returns nothing for a steady performance", () => {
        expect(findHotspots(points([100, 98, 102, 99]), 100)).toEqual([]);
    });
});
