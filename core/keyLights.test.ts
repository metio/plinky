// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    depthFor,
    diffLights,
    isLit,
    litKeys,
    NOTHING_LIT,
    TEST_CHORD,
    type UpcomingPosition,
} from "./keyLights";

const RIGHT: UpcomingPosition = { pitches: [60, 64], staves: [0] };
const LEFT: UpcomingPosition = { pitches: [48], staves: [1] };
const BOTH: UpcomingPosition = { pitches: [36, 72], staves: [0, 1] };

describe("litKeys", () => {
    it("lights nothing at depth zero, which is how every aid-off case is said", () => {
        expect(litKeys([RIGHT, LEFT], 0)).toEqual(NOTHING_LIT);
        expect(litKeys([RIGHT], -1)).toEqual(NOTHING_LIT);
    });

    it("splits the picture by hand", () => {
        expect(litKeys([LEFT], 1)).toEqual({ left: [48], right: [] });
        expect(litKeys([RIGHT], 1)).toEqual({ left: [], right: [60, 64] });
    });

    it("shows a chord spanning the grand staff on both hands", () => {
        expect(litKeys([BOTH], 1)).toEqual({ left: [36, 72], right: [36, 72] });
    });

    it("reads a position on no staff at all as the right hand", () => {
        // A single-staff piece is read in the right hand, and a staff-less note must
        // still light somewhere rather than vanishing.
        expect(litKeys([{ pitches: [67], staves: [] }], 1)).toEqual({ left: [], right: [67] });
    });

    it("takes only as many positions as the depth allows", () => {
        expect(litKeys([RIGHT, LEFT], 1)).toEqual({ left: [], right: [60, 64] });
        expect(litKeys([RIGHT, LEFT], 2)).toEqual({ left: [48], right: [60, 64] });
        // Asking for more positions than there are is the end of a piece, not an error.
        expect(litKeys([RIGHT], 8)).toEqual({ left: [], right: [60, 64] });
    });

    it("sorts and deduplicates, so the same keys compare equal however they arrived", () => {
        const once = litKeys([{ pitches: [64, 60], staves: [0] }], 1);
        const twice = litKeys([{ pitches: [60], staves: [0] }, { pitches: [64, 60], staves: [0] }], 2);
        expect(once).toEqual(twice);
    });
});

describe("depthFor", () => {
    it("lights when hints are always on", () => {
        expect(depthFor("always", false, false)).toBe(1);
    });

    it("waits for a slip when hints only follow one", () => {
        expect(depthFor("miss", false, false)).toBe(0);
        expect(depthFor("miss", true, false)).toBe(1);
    });

    it("stays dark when hints are off", () => {
        expect(depthFor("never", true, false)).toBe(0);
    });

    it("stays dark through a sight-read whatever the setting says", () => {
        // Lighting a key is a reading aid, and a sight-read suppresses every aid.
        expect(depthFor("always", true, true)).toBe(0);
        expect(depthFor("miss", true, true)).toBe(0);
    });

    it("carries a wider depth through, for a run whose timing separates positions", () => {
        expect(depthFor("always", false, false, 3)).toBe(3);
        expect(depthFor("never", false, false, 3)).toBe(0);
    });
});

describe("diffLights", () => {
    it("says nothing about a key already lit", () => {
        const same = { left: [48], right: [60] };
        expect(diffLights(same, same)).toEqual({ on: NOTHING_LIT, off: NOTHING_LIT });
    });

    it("names only what changed", () => {
        const change = diffLights({ left: [48], right: [60] }, { left: [48], right: [64] });
        expect(change).toEqual({
            on: { left: [], right: [64] },
            off: { left: [], right: [60] },
        });
    });

    it("moves a key that changed hands off one channel and on to the other", () => {
        // Without the off, the old channel keeps a light nothing will take back.
        const change = diffLights({ left: [60], right: [] }, { left: [], right: [60] });
        expect(change).toEqual({
            on: { left: [], right: [60] },
            off: { left: [60], right: [] },
        });
    });

    it("puts everything out when the next picture is empty", () => {
        const change = diffLights({ left: [48], right: [60, 64] }, NOTHING_LIT);
        expect(change.on).toEqual(NOTHING_LIT);
        expect(change.off).toEqual({ left: [48], right: [60, 64] });
    });
});

describe("isLit", () => {
    it("is false only when nothing at all is showing", () => {
        expect(isLit(NOTHING_LIT)).toBe(false);
        expect(isLit({ left: [], right: [60] })).toBe(true);
        expect(isLit({ left: [48], right: [] })).toBe(true);
    });
});

describe("TEST_CHORD", () => {
    it("sits inside the range every 61-key lighted instrument covers", () => {
        // 61 keys run C2 (36) to C7 (96); the test chord must be visible on all of them.
        for (const note of [...TEST_CHORD.left, ...TEST_CHORD.right]) {
            expect(note).toBeGreaterThanOrEqual(36);
            expect(note).toBeLessThanOrEqual(96);
        }
        expect(isLit(TEST_CHORD)).toBe(true);
    });
});
