// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type KeepUpState,
    closeKeepUpStep,
    keepUpProgress,
    openKeepUpStep,
    startKeepUp,
    strikeKeepUp,
} from "./keepUp";

// Run a sequence of strikes through an open step and close it.
function playStep(state: KeepUpState, expected: number[], strikes: number[]): ReturnType<typeof closeKeepUpStep> {
    let current = openKeepUpStep(state, expected);
    for (const note of strikes) {
        current = strikeKeepUp(current, note).state;
    }
    return closeKeepUpStep(current);
}

describe("keep-up reducer", () => {
    it("scores a step as a hit once every expected pitch is struck, in any order", () => {
        const { state, hit } = playStep(startKeepUp(), [60, 64, 67], [67, 60, 64]);
        expect(hit).toBe(true);
        expect(state.hits).toEqual([true]);
    });

    it("scores a step as a miss when an expected pitch is still outstanding", () => {
        const { hit, state } = playStep(startKeepUp(), [60, 64], [60]);
        expect(hit).toBe(false);
        expect(state.hits).toEqual([false]);
    });

    it("records nothing for an unscored position, so the other hand's turns don't count", () => {
        const { hit, state } = playStep(startKeepUp(), [], [60, 62]);
        expect(hit).toBeNull();
        expect(state.hits).toEqual([]);
    });

    it("flags the strike that completes the chord so the step can turn green early", () => {
        let state = openKeepUpStep(startKeepUp(), [60, 64]);
        const first = strikeKeepUp(state, 60);
        expect(first.expected).toBe(true);
        expect(first.caught).toBe(false);
        const second = strikeKeepUp(first.state, 64);
        expect(second.caught).toBe(true);
    });

    it("ignores a strike the step does not expect", () => {
        const state = openKeepUpStep(startKeepUp(), [60]);
        const { state: after, expected, caught } = strikeKeepUp(state, 99);
        expect(expected).toBe(false);
        expect(caught).toBe(false);
        expect(after).toBe(state);
    });

    it("scores nothing for a strike landing between steps", () => {
        const closed = playStep(startKeepUp(), [60], [60]).state;
        const { state, expected } = strikeKeepUp(closed, 60);
        expect(expected).toBe(false);
        expect(state.hits).toEqual([true]);
    });

    it("reports progress as beats caught out of beats closed", () => {
        let state = playStep(startKeepUp(), [60], [60]).state;
        state = playStep(state, [62], []).state;
        state = playStep(state, [], []).state;
        expect(keepUpProgress(state)).toEqual({ inTime: 1, done: 2 });
    });
});

const pitches = fc.uniqueArray(fc.integer({ min: 21, max: 108 }), { minLength: 1, maxLength: 6 });

describe("keep-up reducer properties", () => {
    it("hits exactly when the strikes cover the expected pitches, whatever the order or noise", () => {
        fc.assert(
            fc.property(
                pitches,
                fc.array(fc.integer({ min: 21, max: 108 }), { maxLength: 20 }),
                (expected, strikes) => {
                    const { hit } = playStep(startKeepUp(), expected, strikes);
                    const covered = expected.every((pitch) => strikes.includes(pitch));
                    return hit === covered;
                },
            ),
        );
    });

    it("unexpected strikes never change the step's outcome", () => {
        fc.assert(
            fc.property(
                pitches,
                fc.array(fc.integer({ min: 21, max: 108 }), { maxLength: 10 }),
                fc.array(fc.integer({ min: 21, max: 108 }), { maxLength: 10 }),
                (expected, strikes, noise) => {
                    const clean = playStep(startKeepUp(), expected, strikes);
                    const noisy = playStep(startKeepUp(), expected, [
                        ...noise.filter((note) => !expected.includes(note)),
                        ...strikes,
                    ]);
                    return clean.hit === noisy.hit;
                },
            ),
        );
    });

    it("duplicate strikes are idempotent", () => {
        fc.assert(
            fc.property(pitches, (expected) => {
                const doubled = expected.flatMap((pitch) => [pitch, pitch]);
                const { state, hit } = playStep(startKeepUp(), expected, doubled);
                return hit === true && state.hits.length === 1;
            }),
        );
    });

    it("progress always matches the recorded hits", () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({ expected: pitches, catchIt: fc.boolean() }), {
                    maxLength: 12,
                }),
                (steps) => {
                    let state = startKeepUp();
                    for (const step of steps) {
                        state = playStep(state, step.expected, step.catchIt ? step.expected : [])
                            .state;
                    }
                    const { inTime, done } = keepUpProgress(state);
                    return (
                        done === steps.length &&
                        inTime === steps.filter((step) => step.catchIt).length
                    );
                },
            ),
        );
    });
});
