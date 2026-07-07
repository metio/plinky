// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type CursorLike, cursorWhole, seekToBar, seekToWhole, stepLengths } from "./scoreCursor";

// A stub cursor over a fixed list of positions, each a (bar, whole-note onset)
// pair — the slice of OSMD's cursor the helpers read.
function stubCursor(positions: { bar: number; whole: number }[], at = 0): CursorLike {
    let index = at;
    return {
        reset() {
            index = 0;
        },
        next() {
            index += 1;
        },
        get iterator() {
            const position = positions[index];
            return {
                EndReached: index >= positions.length,
                CurrentMeasureIndex: position?.bar ?? 0,
                currentTimeStamp:
                    position === undefined ? undefined : { RealValue: position.whole },
            };
        },
    };
}

const positions = [
    { bar: 0, whole: 0 },
    { bar: 0, whole: 0.25 },
    { bar: 1, whole: 0.5 },
    { bar: 1, whole: 0.75 },
    { bar: 2, whole: 1 },
];

describe("scoreCursor", () => {
    it("reads the cursor's position in whole notes", () => {
        expect(cursorWhole(stubCursor(positions, 2))).toBe(0.5);
    });

    it("reads 0 for a run-off cursor or none at all — no resume point", () => {
        expect(cursorWhole(stubCursor(positions, 5))).toBe(0);
        expect(cursorWhole(null)).toBe(0);
        expect(cursorWhole(undefined)).toBe(0);
    });

    it("seeks to the first entry of a 1-based bar from wherever it stood", () => {
        const cursor = stubCursor(positions, 4);
        seekToBar(cursor, 2);
        expect(cursor.iterator.CurrentMeasureIndex).toBe(1);
        expect(cursor.iterator.currentTimeStamp?.RealValue).toBe(0.5);
    });

    it("seeks to the first entry at or after a notated onset", () => {
        const cursor = stubCursor(positions);
        seekToWhole(cursor, 0.6);
        expect(cursor.iterator.currentTimeStamp?.RealValue).toBe(0.75);
    });

    it("runs to the end when the target lies past the last entry", () => {
        const cursor = stubCursor(positions);
        seekToWhole(cursor, 99);
        expect(cursor.iterator.EndReached).toBe(true);
    });

    it("collects the notated lengths under the cursor as quarter counts", () => {
        expect(
            stepLengths([{ Length: { RealValue: 0.25 } }, { Length: { RealValue: 0.5 } }]),
        ).toEqual([1, 2]);
        expect(stepLengths([])).toEqual([]);
    });
});
