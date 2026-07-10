// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { moveTo, rowAt } from "./reorder";

describe("moveTo", () => {
    it("moves an element down and up to a final position", () => {
        expect(moveTo(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
        expect(moveTo(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
    });

    it("returns the original array for a no-op or out-of-range move", () => {
        const items = ["a", "b", "c"];
        expect(moveTo(items, 1, 1)).toBe(items);
        expect(moveTo(items, -1, 2)).toBe(items);
        expect(moveTo(items, 0, 3)).toBe(items);
        expect(moveTo(items, 0.5, 1)).toBe(items);
    });
});

describe("rowAt", () => {
    const midpoints = [10, 30, 50];

    it("maps a pointer position to the row whose band it falls in", () => {
        expect(rowAt(0, midpoints)).toBe(0);
        expect(rowAt(15, midpoints)).toBe(1);
        expect(rowAt(35, midpoints)).toBe(2);
    });

    it("clamps below the last row and handles an empty list", () => {
        expect(rowAt(999, midpoints)).toBe(2);
        expect(rowAt(5, [])).toBe(0);
    });
});
