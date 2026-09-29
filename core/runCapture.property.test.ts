// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    captureCleared,
    capturePedal,
    captureRelease,
    flushHolds,
    type RunCapture,
    startCapture,
} from "./runCapture";

// What a run records while it is played: positions clearing, keys lifting, the pedal
// going down and up, and the flush that ends it. The grade, the share grid, the saved
// take and the ghost are all read off the finished capture, so what these pin is the
// laws it must obey whatever order those events arrive in — not a second copy of how it
// computes them.
//
// Events are generated on one clock that only moves forward, because that is the
// contract the play surface honours: wall-clock timestamps from real input. A run where
// a release precedes its own strike is not a run.

type Event =
    | { kind: "clear"; pitches: number[]; velocity: number }
    | { kind: "release"; pitch: number }
    | { kind: "pedal"; down: boolean };

const PITCHES = [60, 62, 64, 67];

const arbEvent: fc.Arbitrary<Event> = fc.oneof(
    fc
        .tuple(
            fc.uniqueArray(fc.constantFrom(...PITCHES), { minLength: 1, maxLength: 3 }),
            fc.integer({ min: 1, max: 127 }),
        )
        .map(([pitches, velocity]) => ({ kind: "clear" as const, pitches, velocity })),
    fc.constantFrom(...PITCHES).map((pitch) => ({ kind: "release" as const, pitch })),
    fc.boolean().map((down) => ({ kind: "pedal" as const, down })),
);

// The clock: each event lands a little after the one before it, so time never runs
// backwards. The gaps vary so holds have different lengths.
const arbRun = fc
    .array(fc.tuple(arbEvent, fc.integer({ min: 0, max: 400 })), { maxLength: 40 })
    .map((steps) => {
        let at = 1000;
        return steps.map(([event, gap]) => {
            at += gap;
            return { event, at };
        });
    });

const play = (steps: { event: Event; at: number }[]) => {
    const capture = startCapture();
    let ordinal = 0;
    for (const { event, at } of steps) {
        if (event.kind === "clear") {
            captureCleared(capture, {
                pitches: event.pitches,
                ordinal,
                timestamp: at,
                // The notated clock runs at its own pace; what matters here is that the
                // first note sets the zero.
                timeMs: ordinal * 500,
                velocity: event.velocity,
                wrongBefore: 0,
                staves: [1],
            });
            ordinal += 1;
        } else if (event.kind === "release") {
            captureRelease(capture, event.pitch, at);
        } else {
            capturePedal(capture, event.down, at);
        }
    }
    return { capture, endedAt: (steps.at(-1)?.at ?? 1000) + 500 };
};

const holdsOf = (capture: RunCapture) => capture.notes.map((note) => note.heldMs ?? 0);

describe("runCapture, over a run played on a clock that only moves forward", () => {
    it("closes every hold on the flush, and a second flush finds nothing left", () => {
        fc.assert(
            fc.property(arbRun, (steps) => {
                const { capture, endedAt } = play(steps);

                flushHolds(capture, endedAt);

                expect(capture.holds.size).toBe(0);
                expect(capture.pedalHeld.size).toBe(0);

                const after = holdsOf(capture);
                flushHolds(capture, endedAt + 1000);
                expect(holdsOf(capture)).toEqual(after);
            }),
        );
    });

    it("records no negative length, and a note rings at least as long as its key was down", () => {
        fc.assert(
            fc.property(arbRun, (steps) => {
                const { capture, endedAt } = play(steps);
                flushHolds(capture, endedAt);

                for (const note of capture.notes) {
                    expect(note.heldMs ?? 0).toBeGreaterThanOrEqual(0);
                    expect(note.keyHeldMs ?? 0).toBeGreaterThanOrEqual(0);
                    // One length per pitch, index-aligned, so a chord's clipped note and
                    // its held one are read apart rather than as the longest of the two.
                    expect(note.keyHoldsMs?.length).toBe(note.pitches.length);
                    for (const held of note.keyHoldsMs ?? []) {
                        expect(held).toBeGreaterThanOrEqual(0);
                    }
                    // The damper: a note rings until the pedal lifts, which is at or after
                    // the key came up.
                    expect(note.heldMs ?? 0).toBeGreaterThanOrEqual(
                        Math.max(0, ...(note.keyHoldsMs ?? [])),
                    );
                }
            }),
        );
    });

    it("counts the run from its first note, and keeps the order it was played in", () => {
        fc.assert(
            fc.property(arbRun, (steps) => {
                const { capture, endedAt } = play(steps);
                flushHolds(capture, endedAt);

                if (capture.notes.length === 0) {
                    return;
                }
                expect(capture.notes[0]?.playedMs).toBe(0);
                expect(capture.notes[0]?.targetMs).toBe(0);
                const played = capture.notes.map((note) => note.playedMs);
                expect([...played].sort((a, b) => a - b)).toEqual(played);
            }),
        );
    });

    it("ignores a key that was never struck", () => {
        fc.assert(
            fc.property(arbRun, fc.integer({ min: 21, max: 108 }), (steps, stray) => {
                fc.pre(!PITCHES.includes(stray));
                const { capture, endedAt } = play(steps);
                const before = JSON.stringify(capture.notes);

                captureRelease(capture, stray, endedAt);

                expect(JSON.stringify(capture.notes)).toBe(before);
                flushHolds(capture, endedAt);
                expect(capture.holds.size).toBe(0);
            }),
        );
    });
});
