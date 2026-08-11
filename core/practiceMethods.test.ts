// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { METHODS, methodById, methodsWithin } from "./practiceMethods";

describe("practiceMethods", () => {
    it("gives every method a dose and somewhere to try it", () => {
        for (const method of METHODS) {
            expect(method.minutes).toBeGreaterThan(0);
            expect(method.href.startsWith("/")).toBe(true);
            expect(method.href.endsWith("/")).toBe(true);
        }
    });

    it("has no duplicate ids, so the label lookups stay total", () => {
        expect(new Set(METHODS.map((method) => method.id)).size).toBe(METHODS.length);
    });

    it("finds a method by id, and nothing for one that does not exist", () => {
        expect(methodById("chunking")?.minutes).toBe(10);
        expect(methodById("nonsense")).toBeNull();
    });

    it("offers only what fits in the time available, shortest first", () => {
        const fits = methodsWithin(10);
        expect(fits.every((method) => method.minutes <= 10)).toBe(true);
        expect(fits.map((method) => method.minutes)).toEqual(
            [...fits.map((method) => method.minutes)].sort((left, right) => left - right),
        );
        expect(methodsWithin(1)).toEqual([]);
    });
});
