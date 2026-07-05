// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isFirstS, isFlawless } from "./milestones";

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
    it("fires when all three dimensions are perfect", () => {
        expect(isFlawless({ accuracy: 100, timing: 100, flow: 100 })).toBe(true);
    });

    it("does not fire when any dimension is short of 100", () => {
        expect(isFlawless({ accuracy: 100, timing: 100, flow: 99 })).toBe(false);
        expect(isFlawless({ accuracy: 99, timing: 100, flow: 100 })).toBe(false);
        expect(isFlawless({ accuracy: 100, timing: 98, flow: 100 })).toBe(false);
    });

    it("does not fire on a run that only rounds up to a perfect score", () => {
        // 100/100/99 averages to 99.67, which Math.round lifts to a score of 100 —
        // the aggregate the milestone must not be fooled by.
        const grade = { accuracy: 100, timing: 100, flow: 99 };
        expect(Math.round((grade.accuracy + grade.timing + grade.flow) / 3)).toBe(100);
        expect(isFlawless(grade)).toBe(false);
    });
});
