// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
    flawlessDone,
    isFirstS,
    isFlawless,
    reachedGrade,
    recordFlawless,
    recordReachedGrade,
} from "./milestones";

afterEach(() => localStorage.clear());

describe("isFirstS", () => {
    it("fires when an S run beats a sub-S best", () => {
        expect(isFirstS(95, 94)).toBe(true);
        expect(isFirstS(100, 0)).toBe(true);
    });

    it("does not fire when the song already sat at S", () => {
        expect(isFirstS(96, 95)).toBe(false);
        expect(isFirstS(95, 100)).toBe(false);
    });

    it("does not fire below the S cutoff", () => {
        expect(isFirstS(94, 0)).toBe(false);
    });
});

describe("isFlawless", () => {
    it("fires only on a perfect aggregate", () => {
        expect(isFlawless(100)).toBe(true);
        expect(isFlawless(99)).toBe(false);
    });
});

describe("reachedGrade", () => {
    it("starts at zero", () => {
        expect(reachedGrade()).toBe(0);
    });

    it("remembers the highest grade reached", () => {
        recordReachedGrade(3);
        expect(reachedGrade()).toBe(3);
        recordReachedGrade(5);
        expect(reachedGrade()).toBe(5);
    });

    it("never moves backward, so a later run at a lower grade can't re-fire it", () => {
        recordReachedGrade(5);
        recordReachedGrade(2);
        expect(reachedGrade()).toBe(5);
    });
});

describe("flawlessDone", () => {
    it("is one-time: false until recorded, then stays true", () => {
        expect(flawlessDone()).toBe(false);
        recordFlawless();
        expect(flawlessDone()).toBe(true);
    });
});
