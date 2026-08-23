// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    EMPTY_STEP,
    type StepState,
    stepBack,
    stepDown,
    stepDurationMs,
    STEP_VALUES,
    stepRest,
    stepUp,
} from "./stepInput";

// Step entry is a state machine a player drives with two hands and a mind elsewhere —
// keys down and up in any order, a rest mid-chord, an undo at the wrong moment. What has
// to hold through any such sequence is that the written notes and the place the next one
// goes never disagree: nothing is written past the cursor, and the cursor never runs
// backwards except when something is taken back.

const value = fc.constantFrom(...STEP_VALUES);
const pitch = fc.integer({ min: 21, max: 108 });

type Op =
    | { kind: "down"; pitch: number; ms: number }
    | { kind: "up" }
    | { kind: "rest"; ms: number }
    | { kind: "back" };

const op: fc.Arbitrary<Op> = fc.oneof(
    fc.record({
        kind: fc.constant("down" as const),
        pitch,
        ms: value.map((v) => stepDurationMs(v, 120)),
    }),
    fc.record({ kind: fc.constant("up" as const) }),
    fc.record({ kind: fc.constant("rest" as const), ms: value.map((v) => stepDurationMs(v, 120)) }),
    fc.record({ kind: fc.constant("back" as const) }),
);

function run(ops: readonly Op[]): StepState {
    let state = EMPTY_STEP;
    for (const one of ops) {
        if (one.kind === "down") {
            state = stepDown(state, { pitch: one.pitch, velocity: 80 }, one.ms);
        } else if (one.kind === "up") {
            state = stepUp(state);
        } else if (one.kind === "rest") {
            state = stepRest(state, one.ms);
        } else {
            state = stepBack(state);
        }
    }
    return state;
}

describe("step entry, driven any which way", () => {
    it("never writes a note past where the next one goes", () => {
        fc.assert(
            fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
                const state = run(ops);
                if (state.holding > 0) {
                    return; // mid-chord the cursor has not moved on yet, by design
                }
                for (const note of state.notes) {
                    expect(note.startMs + note.durationMs).toBeLessThanOrEqual(state.atMs);
                }
            }),
        );
    });

    it("keeps the held count honest", () => {
        fc.assert(
            fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
                const state = run(ops);
                expect(state.holding).toBeGreaterThanOrEqual(0);
                expect(Number.isFinite(state.atMs)).toBe(true);
                expect(state.atMs).toBeGreaterThanOrEqual(0);
            }),
        );
    });

    it("puts a completed step back exactly as it was before it", () => {
        fc.assert(
            fc.property(
                fc.array(op, { maxLength: 20 }),
                fc.array(pitch, { minLength: 1, maxLength: 4 }),
                value,
                (before, chord, v) => {
                    const settled = run([
                        ...before,
                        { kind: "up" },
                        { kind: "up" },
                        { kind: "up" },
                        { kind: "up" },
                    ]);
                    fc.pre(settled.holding === 0);
                    const ms = stepDurationMs(v, 120);
                    let entered = settled;
                    for (const one of chord) {
                        entered = stepDown(entered, { pitch: one, velocity: 80 }, ms);
                    }
                    for (const _ of chord) {
                        entered = stepUp(entered);
                    }
                    expect(stepBack(entered)).toEqual(settled);
                },
            ),
        );
    });
});
