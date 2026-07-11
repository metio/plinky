// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { attributionFor } from "./attribution";
import {
    creditLine,
    playedStepCount,
    sceneKeys,
    sceneRange,
    scoreWindowTop,
    stepCenterAt,
} from "./videoScene";

describe("sceneRange", () => {
    it("snaps outward to whole octaves around the take's pitches", () => {
        // D4 (62) to G5 (79) → C4 (60) to B5 (83).
        expect(sceneRange([62, 79])).toEqual({ from: 60, to: 83 });
    });

    it("widens a narrow take to at least two octaves", () => {
        const { from, to } = sceneRange([60]);
        expect(to - from).toBeGreaterThanOrEqual(23);
        expect(from % 12).toBe(0);
        expect(to % 12).toBe(11);
    });
});

describe("sceneKeys", () => {
    const keys = sceneKeys(60, 71); // one octave, C4..B4

    it("lays seven even white keys and five straddling black keys per octave", () => {
        expect(keys.filter((k) => !k.black)).toHaveLength(7);
        expect(keys.filter((k) => k.black)).toHaveLength(5);
        const whites = keys.filter((k) => !k.black);
        for (const key of whites) {
            expect(key.width).toBeCloseTo(1 / 7);
        }
        // E–F and B–C have no black key between them.
        expect(keys.some((k) => k.pitch === 64 + 1 && k.black)).toBe(false);
    });

    it("keeps every key inside the unit strip", () => {
        for (const key of sceneKeys(36, 96)) {
            expect(key.x).toBeGreaterThanOrEqual(0);
            expect(key.x + key.width).toBeLessThanOrEqual(1.0001);
        }
    });
});

describe("creditLine", () => {
    it("carries title, composer, source and licence", () => {
        const line = creditLine(
            "Menuet",
            attributionFor({ composer: "J. S. Bach", license: "cc0-1.0", source: "mutopia" }),
        );
        expect(line).toContain("Menuet");
        expect(line).toContain("J. S. Bach");
        expect(line.split(" · ").length).toBeGreaterThanOrEqual(3);
    });

    it("omits what a piece doesn't have rather than printing blanks", () => {
        expect(creditLine("Étude", attributionFor({}))).toBe("Étude");
    });
});

describe("scoreWindowTop", () => {
    it("centres on the step and clamps to the image edges", () => {
        expect(scoreWindowTop(500, 400, 2000)).toBe(300);
        expect(scoreWindowTop(50, 400, 2000)).toBe(0);
        expect(scoreWindowTop(1950, 400, 2000)).toBe(1600);
    });

    it("pins to the top when the image is shorter than the window", () => {
        expect(scoreWindowTop(100, 400, 300)).toBe(0);
    });
});

describe("playedStepCount", () => {
    it("counts the onsets that have sounded, none before the first", () => {
        expect(playedStepCount([0, 500, 1000], null)).toBe(0);
        expect(playedStepCount([0, 500, 1000], 0)).toBe(1);
        expect(playedStepCount([0, 500, 1000], 700)).toBe(2);
        expect(playedStepCount([0, 500, 1000], 1000)).toBe(3);
    });
});

describe("stepCenterAt", () => {
    it("glides between step centres and clamps at the ends", () => {
        const onsets = [0, 1000];
        const centers = [100, 300];
        expect(stepCenterAt(onsets, centers, -50)).toBe(100);
        expect(stepCenterAt(onsets, centers, 500)).toBe(200);
        expect(stepCenterAt(onsets, centers, 2000)).toBe(300);
        expect(stepCenterAt([], [], 0)).toBe(0);
    });
});
