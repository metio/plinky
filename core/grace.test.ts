// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { GRACE_MAX_SHARE, graceOnsetsMs } from "./grace";

describe("graceOnsetsMs", () => {
    it("has nothing to place when the note carries no ornament", () => {
        expect(graceOnsetsMs(1000, 0, [])).toEqual([]);
    });

    it("puts a single grace note its own length before the principal", () => {
        // A quarter of a second of ornament, two seconds of room: it fits as written.
        expect(graceOnsetsMs(2000, 0, [250])).toEqual([1750]);
    });

    it("plays several in the order they are written, each after the last", () => {
        const onsets = graceOnsetsMs(2000, 0, [100, 100, 100]);
        expect(onsets).toEqual([1700, 1800, 1900]);
    });

    it("squeezes an ornament too long for the space before it", () => {
        // A second of ornament with only 200 ms of room — half the gap from the previous
        // note. It is compressed rather than reaching back over the note before it.
        const onsets = graceOnsetsMs(1400, 1000, [500, 500]);
        const room = (1400 - 1000) * GRACE_MAX_SHARE;
        expect(onsets[0]).toBe(1400 - room);
        expect(onsets[1]).toBe(1400 - room / 2);
    });

    it("never reaches back over the note before it", () => {
        for (const gap of [0, 1, 10, 250, 4000]) {
            const previous = 1000;
            const onsets = graceOnsetsMs(previous + gap, previous, [500, 500, 500]);
            for (const onset of onsets) {
                expect(onset).toBeGreaterThanOrEqual(previous);
                expect(onset).toBeLessThanOrEqual(previous + gap);
            }
        }
    });

    it("stacks an ornament on the beat when there is no room at all", () => {
        // The principal falls at the same moment as the note before it: nothing can be
        // placed earlier, so the ornament is struck there and the order is all that
        // remains of it.
        expect(graceOnsetsMs(1000, 1000, [250, 250])).toEqual([1000, 1000]);
    });

    it("tolerates a length the score gives as zero", () => {
        expect(graceOnsetsMs(1000, 0, [0])).toEqual([1000]);
    });
});
