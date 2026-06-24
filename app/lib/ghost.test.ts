// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { plotTimeline, type PlottedNote } from "./ghost";

function at(notes: PlottedNote[], index: number): PlottedNote {
    const note = notes[index];
    if (!note) {
        throw new Error(`no plotted note at ${index}`);
    }
    return note;
}

describe("plotTimeline", () => {
    it("places a perfectly-timed note at the same x for ghost and you", () => {
        const second = at(
            plotTimeline(
                [
                    { ordinal: 0, targetMs: 0, playedMs: 0 },
                    { ordinal: 1, targetMs: 500, playedMs: 500 },
                ],
                1000,
            ),
            1,
        );
        expect(second.ghostX).toBe(second.youX);
        expect(second.rating).toBe("perfect");
        expect(second.deltaMs).toBe(0);
    });

    it("places a late note to the right of its ghost", () => {
        const second = at(
            plotTimeline(
                [
                    { ordinal: 0, targetMs: 0, playedMs: 0 },
                    { ordinal: 1, targetMs: 500, playedMs: 700 },
                ],
                1000,
            ),
            1,
        );
        expect(second.youX).toBeGreaterThan(second.ghostX);
        expect(second.deltaMs).toBe(200);
        expect(second.rating).toBe("off");
    });

    it("places an early note to the left of its ghost", () => {
        const second = at(
            plotTimeline(
                [
                    { ordinal: 0, targetMs: 0, playedMs: 0 },
                    { ordinal: 1, targetMs: 500, playedMs: 460 },
                ],
                1000,
            ),
            1,
        );
        expect(second.youX).toBeLessThan(second.ghostX);
        expect(second.deltaMs).toBe(-40);
        expect(second.rating).toBe("perfect");
    });

    it("scales the last note to the full width", () => {
        const second = at(
            plotTimeline(
                [
                    { ordinal: 0, targetMs: 0, playedMs: 0 },
                    { ordinal: 1, targetMs: 1000, playedMs: 1000 },
                ],
                1000,
            ),
            1,
        );
        expect(second.ghostX).toBe(1000);
    });
});
