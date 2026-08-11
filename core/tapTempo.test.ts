// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { bpmOf, MAX_BPM, MIN_BPM, NO_TAPS, RESET_AFTER_MS, tap, tapCount } from "./tapTempo";

function tapEvery(gapMs: number, count: number, from = 1000) {
    let state = NO_TAPS;
    for (let index = 0; index < count; index++) {
        state = tap(state, from + index * gapMs);
    }
    return state;
}

describe("bpmOf", () => {
    it("says nothing until there are two taps to measure between", () => {
        expect(bpmOf(NO_TAPS)).toBeNull();
        expect(bpmOf(tap(NO_TAPS, 1000))).toBeNull();
    });

    it("reads the tempo from an even tap", () => {
        expect(bpmOf(tapEvery(500, 5))).toBe(120);
        expect(bpmOf(tapEvery(1000, 5))).toBe(60);
    });

    it("steadies an uneven hand rather than following every wobble", () => {
        let state = NO_TAPS;
        for (const at of [0, 500, 990, 1510, 2000, 2495]) {
            state = tap(state, at);
        }
        expect(bpmOf(state)).toBe(120);
    });

    it("stays inside the band the metronome accepts", () => {
        expect(bpmOf(tapEvery(10, 5))).toBe(MAX_BPM);
        // The slow end is bounded by the pause reset before the clamp ever bites: a gap
        // wide enough to read below the floor is a gap wide enough to have been a stop.
        // The clamp still guards a state that did not come from tapping.
        expect(bpmOf({ taps: [0, 60_000] })).toBe(MIN_BPM);
    });
});

describe("tap", () => {
    it("starts over after a pause instead of dragging the reading down", () => {
        const settled = tapEvery(500, 4);
        const resumed = tap(settled, (settled.taps.at(-1) as number) + RESET_AFTER_MS + 1);
        expect(tapCount(resumed)).toBe(1);
        expect(bpmOf(resumed)).toBeNull();
    });

    it("starts over on a tap that arrives before the one before it", () => {
        // A clock corrected mid-tap would otherwise contribute a negative gap.
        const settled = tapEvery(500, 4);
        const backwards = tap(settled, 0);
        expect(tapCount(backwards)).toBe(1);
    });

    it("keeps only a recent window, so speeding up shows within a beat or two", () => {
        const many = tapEvery(500, 40);
        expect(tapCount(many)).toBeLessThanOrEqual(7);
        expect(bpmOf(many)).toBe(120);
    });

    it("follows a change of pace", () => {
        let state = tapEvery(1000, 4);
        expect(bpmOf(state)).toBe(60);
        for (let index = 0; index < 8; index++) {
            state = tap(state, (state.taps.at(-1) as number) + 500);
        }
        expect(bpmOf(state)).toBe(120);
    });
});
