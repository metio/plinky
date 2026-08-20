// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type Box, descendantBounds, holds, union } from "./storyCrop";

const box = (left: number, top: number, width: number, height: number): Box => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
});

describe("union", () => {
    it("reaches around both", () => {
        expect(union(box(0, 0, 10, 10), box(20, 5, 10, 10))).toEqual({
            left: 0,
            top: 0,
            right: 30,
            bottom: 15,
        });
    });

    it("reaches around something that left its parent's box", () => {
        // An open menu hanging below its trigger: the union has to grow downwards, which
        // is what stops the crop landing on the trigger alone.
        expect(union(box(0, 0, 100, 40), box(0, 40, 120, 200)).bottom).toBe(240);
    });
});

describe("holds", () => {
    it("accepts a frame the drawing sits inside", () => {
        expect(holds(box(0, 0, 100, 100), box(10, 10, 20, 20))).toBe(true);
    });

    it("rejects a frame that would crop something away on any side", () => {
        const frame = box(0, 0, 100, 100);
        expect(holds(frame, box(-1, 10, 20, 20))).toBe(false);
        expect(holds(frame, box(10, -1, 20, 20))).toBe(false);
        expect(holds(frame, box(90, 10, 20, 20))).toBe(false);
        expect(holds(frame, box(10, 90, 20, 20))).toBe(false);
    });

    it("allows half a pixel, because two ways of measuring a box disagree in the last bit", () => {
        expect(holds(box(0, 0, 100, 100), box(-0.4, -0.4, 100.8, 100.8))).toBe(true);
        expect(holds(box(0, 0, 100, 100), box(-2, 0, 100, 100))).toBe(false);
    });
});

describe("descendantBounds", () => {
    it("is nothing when nothing was drawn below", () => {
        expect(descendantBounds([])).toBeNull();
    });

    it("reaches around every box it is given", () => {
        expect(descendantBounds([box(0, 0, 10, 10), box(90, 0, 10, 10)])).toEqual({
            left: 0,
            top: 0,
            right: 100,
            bottom: 10,
        });
    });

    it("excludes the element's own box, or nothing could ever escape", () => {
        // Fold the parent in and "did anything escape this container" can never answer
        // yes, because the union always sits inside itself.
        const parent = box(0, 0, 800, 40);
        const child = box(380, 60, 40, 40);
        expect(holds(parent, descendantBounds([child])!)).toBe(false);
        expect(holds(parent, union(parent, child))).toBe(false);
        expect(holds(parent, descendantBounds([box(10, 10, 20, 20)])!)).toBe(true);
    });
});
