// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    type Box,
    boxArea,
    descendantBounds,
    holds,
    mayDescend,
    MIN_CROP_PX,
    union,
} from "./storyCrop";

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

describe("mayDescend", () => {
    const all = box(0, 0, 40, 40);

    it("steps into a small control sitting in a full-width row", () => {
        // The case the crop exists for: the allowance is a fraction of the frame, and a
        // 960-wide row spends nearly all of it on empty margin.
        expect(mayDescend(box(0, 0, 960, 40), box(0, 0, 40, 40), all)).toBe(true);
    });

    it("refuses to step past something drawn outside the child", () => {
        // The defect this pins: an open menu and a closed one cropped to the same trigger
        // render byte-identical baselines, so the story compares nothing.
        const drawn = union(box(0, 0, 40, 40), box(0, 40, 200, 180));
        expect(mayDescend(box(0, 0, 960, 40), box(0, 0, 40, 40), drawn)).toBe(false);
    });

    it("refuses to shrink below the smallest frame worth comparing", () => {
        // An icon's outline is ~100% ink and says nothing about the control around it —
        // change the button's radius, ground or padding and the outline is untouched.
        const glyph = box(8, 8, 12, 12);
        expect(mayDescend(box(0, 0, 40, 40), glyph, glyph)).toBe(false);
        expect(MIN_CROP_PX).toBeGreaterThan(12);
    });

    it("refuses a child that saves nothing", () => {
        const same = box(0, 0, 40, 40);
        expect(mayDescend(same, same, all)).toBe(false);
    });

    it("accepts a child exactly at the floor", () => {
        const child = box(0, 0, MIN_CROP_PX, MIN_CROP_PX);
        expect(mayDescend(box(0, 0, 200, 200), child, child)).toBe(true);
    });
});

describe("boxArea", () => {
    it("is zero for a box with no extent, so an undrawn element never looks smaller", () => {
        expect(boxArea(box(5, 5, 0, 20))).toBe(0);
        expect(boxArea(box(5, 5, 10, 20))).toBe(200);
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

    it("makes a descent possible, which folding the parent in does not", () => {
        // The bug this pins, and it was invisible: with the parent's own box folded into
        // the union, `mayDescend` asks whether a child contains its own parent. Nothing
        // can, so the crop silently stopped descending and every frame came out at the
        // full-width container it started from — while these very rules stayed green,
        // because the tests fed them a union the caller never built.
        const parent = box(0, 0, 800, 40);
        const child = box(380, 0, 40, 40);
        const below = descendantBounds([child]);
        expect(mayDescend(parent, child, below!)).toBe(true);

        const foldingTheParentIn = union(parent, child);
        expect(mayDescend(parent, child, foldingTheParentIn)).toBe(false);
    });
});
