// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { keybed } from "../../core/keybed.ts";
import { type Picks, replay, tracesIn } from "./itf.mts";

// The on-screen keyboard's input protocol, checked against the model in keybed.qnt: the
// model explores interleavings of pointers, the roved computer key and a screen reader's
// synthesized click, and every run it produces is replayed here against the real keybed.
// What it is looking for is the one failure a player would hear — a note still sounding
// when nothing is holding it — and the states it reaches are ones a hand-written scenario
// would not think to combine: a glide that begins off the keys, a second finger landing
// on the note the first is leaving, an unmount mid-chord.
//
// This file is the whole cost of adding the model: the harness does the decoding,
// dispatch and reporting. What it says is which call each of the model's actions makes.

// The model names pointers "p1" and "p2"; the real API takes the browser's pointerId.
const pointerId = (p: unknown) => Number(String(p).slice(1));
const NO_NOTE = -1;

const actions: Record<string, (bed: ReturnType<typeof keybed>, picks: Picks) => void> = {
    pointerDown: (bed, { p, n }) => {
        bed.pointerDown(pointerId(p), Number(n));
    },
    pointerGlide: (bed, { p, n }) => {
        bed.pointerTo(pointerId(p), Number(n));
    },
    pointerOff: (bed, { p }) => {
        bed.pointerTo(pointerId(p), null);
    },
    pointerUp: (bed, { p }) => {
        bed.pointerEnd(pointerId(p));
    },
    keyDown: (bed, { n }) => {
        bed.press("key", Number(n));
    },
    keyUp: (bed) => {
        bed.releaseSource("key");
    },
    clickPress: (bed, { n }) => {
        bed.press("click", Number(n));
    },
    clickAutoRelease: (bed) => {
        bed.releaseSource("click");
    },
    unmount: (bed) => {
        bed.releaseAll();
    },
};

// The model's own variables, read back off the real keybed: which notes sound, which
// pointers are being tracked, and where each of them is.
const agrees = (bed: ReturnType<typeof keybed>, state: Record<string, unknown>) => {
    const heldBy = state.heldBy as Map<number, Set<string>>;
    const at = state.at as Map<string, number>;
    const down = state.down as Set<string>;

    const shouldSound = [...heldBy]
        .filter(([, holders]) => holders.size > 0)
        .map(([note]) => note)
        .sort((a, b) => a - b);
    expect([...bed.sounding()].sort((a, b) => a - b)).toEqual(shouldSound);

    for (const [pointer, note] of at) {
        expect(bed.tracks(pointerId(pointer))).toBe(down.has(pointer));
        expect(bed.noteOf(pointerId(pointer))).toBe(note === NO_NOTE ? null : note);
    }
};

const TRACES = fileURLToPath(new URL("traces/keybed", import.meta.url));

describe("the keyboard, against every run the model explored", () => {
    const traces = tracesIn(TRACES);

    it("has runs to replay", () => {
        // A directory that quietly emptied would otherwise report a clean sweep over
        // nothing at all.
        expect(traces.length).toBeGreaterThan(0);
        expect(traces.every((trace) => trace.steps.length > 1)).toBe(true);
    });

    for (const trace of traces) {
        it(`agrees with the model through ${trace.name}`, () => {
            replay(trace, { start: keybed, actions, agrees });
        });
    }
});
