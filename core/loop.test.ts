// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { loopClick } from "./loop";

describe("loopClick", () => {
    it("leaves the click to the caller while the loop is off", () => {
        expect(loopClick({ on: false, anchor: null, bar: 4 })).toEqual({ kind: "bare", bar: 4 });
    });

    it("leaves the click to the caller even with an anchor still held", () => {
        // Turning the loop off strands any half-built selection; the tap sets the
        // play position rather than completing a range the player has abandoned.
        expect(loopClick({ on: false, anchor: 2, bar: 4 })).toEqual({ kind: "bare", bar: 4 });
    });

    it("drops the anchor as a one-bar loop on the first click", () => {
        expect(loopClick({ on: true, anchor: null, bar: 3 })).toEqual({
            kind: "range",
            from: 3,
            to: 3,
            anchor: 3,
        });
    });

    it("extends the range to a second click after the anchor", () => {
        expect(loopClick({ on: true, anchor: 3, bar: 7 })).toEqual({
            kind: "range",
            from: 3,
            to: 7,
            anchor: null,
        });
    });

    it("extends the range to a second click before the anchor", () => {
        // Clicking backwards up the staff selects the same passage as clicking
        // forwards down it — the range is the pair, not the order.
        expect(loopClick({ on: true, anchor: 7, bar: 3 })).toEqual({
            kind: "range",
            from: 3,
            to: 7,
            anchor: null,
        });
    });

    it("keeps a range of one bar when both clicks land on it", () => {
        expect(loopClick({ on: true, anchor: 5, bar: 5 })).toEqual({
            kind: "range",
            from: 5,
            to: 5,
            anchor: null,
        });
    });

    it("starts a fresh selection once a range is complete", () => {
        // A completed range releases its anchor, so the next click drops a new one
        // rather than stretching the range that is already built.
        const first = loopClick({ on: true, anchor: null, bar: 2 });
        const complete = loopClick({ on: true, anchor: 2, bar: 6 });
        expect(complete).toMatchObject({ anchor: null });
        const third = loopClick({ on: true, anchor: null, bar: 9 });
        expect(third).toEqual({ kind: "range", from: 9, to: 9, anchor: 9 });
        expect(first).toMatchObject({ anchor: 2 });
    });
});
