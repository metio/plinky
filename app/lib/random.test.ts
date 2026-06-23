// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { hashString, seededRandom } from "./random";

describe("seededRandom", () => {
    it("is deterministic for a given seed", () => {
        const a = seededRandom(42);
        const b = seededRandom(42);
        const first = [a(), a(), a()];
        const second = [b(), b(), b()];
        expect(first).toEqual(second);
    });

    it("differs across seeds", () => {
        expect(seededRandom(1)()).not.toBe(seededRandom(2)());
    });

    it("stays within [0, 1)", () => {
        const next = seededRandom(7);
        for (let i = 0; i < 100; i++) {
            const value = next();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });
});

describe("hashString", () => {
    it("is stable and differs by input", () => {
        expect(hashString("2026-06-23")).toBe(hashString("2026-06-23"));
        expect(hashString("2026-06-23")).not.toBe(hashString("2026-06-24"));
    });
});
