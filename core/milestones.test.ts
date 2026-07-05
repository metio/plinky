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
    it("fires only on a perfect aggregate", () => {
        expect(isFlawless(100)).toBe(true);
        expect(isFlawless(99)).toBe(false);
    });
});
