// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    KEEP_UP_EARLY_MS,
    KEEP_UP_LATE_MS,
    type KeepUpState,
    closeKeepUpStep,
    keepUpProgress,
    openKeepUpStep,
    settleKeepUp,
    startKeepUp,
    strikeKeepUp,
} from "./keepUp";

// Run a sequence of strikes through an open beat, close it and let its window pass.
function playStep(
    state: KeepUpState,
    expected: number[],
    strikes: number[],
): ReturnType<typeof settleKeepUp> {
    let current = openKeepUpStep(state, expected);
    for (const note of strikes) {
        current = strikeKeepUp(current, note).state;
    }
    return settleKeepUp(closeKeepUpStep(current).state);
}

describe("keep-up reducer", () => {
    it("scores a beat as a hit once every expected pitch is struck, in any order", () => {
        const { state, hit } = playStep(startKeepUp(), [60, 64, 67], [67, 60, 64]);
        expect(hit).toBe(true);
        expect(state.hits).toEqual([true]);
    });

    it("scores a beat as a miss when an expected pitch is still outstanding", () => {
        const { state, hit } = playStep(startKeepUp(), [60, 64], [60]);
        expect(hit).toBe(false);
        expect(state.hits).toEqual([false]);
    });

    it("records nothing for an unscored position, so the other hand's turns don't count", () => {
        const { state, hit } = playStep(startKeepUp(), [], [60]);
        expect(hit).toBeNull();
        expect(state.hits).toEqual([]);
    });

    it("flags the strike that completes the chord so the step can turn green early", () => {
        let state = openKeepUpStep(startKeepUp(), [60, 64]);
        const first = strikeKeepUp(state, 60);
        expect(first.caught).toBe(false);
        state = first.state;
        expect(strikeKeepUp(state, 64).caught).toBe(true);
    });

    it("ignores a strike the step does not expect", () => {
        const state = openKeepUpStep(startKeepUp(), [60]);
        const { state: after, expected, caught } = strikeKeepUp(state, 61);
        expect(expected).toBe(false);
        expect(caught).toBe(false);
        expect(after).toBe(state);
    });

    it("scores nothing for a strike landing between steps", () => {
        const state = closeKeepUpStep(openKeepUpStep(startKeepUp(), [])).state;
        const { expected } = strikeKeepUp(state, 60);
        expect(expected).toBe(false);
        expect(state.hits).toEqual([]);
    });

    it("reports progress as beats caught out of beats closed", () => {
        let state = playStep(startKeepUp(), [60], [60]).state;
        state = playStep(state, [62], []).state;
        state = playStep(state, [64], [64]).state;
        expect(keepUpProgress(state)).toEqual({ inTime: 2, done: 3 });
    });
});

describe("the beat's window", () => {
    const timing = { at: 1000, dwellMs: 500, next: [62] };

    it("credits the next beat's pitch struck a hair before its beat", () => {
        let state = openKeepUpStep(startKeepUp(), [60], timing);
        state = strikeKeepUp(state, 60, 1010).state;
        const early = strikeKeepUp(state, 62, 1500 - KEEP_UP_EARLY_MS + 10);
        expect(early.expected).toBe(true);
        state = closeKeepUpStep(early.state, 1500).state;
        state = openKeepUpStep(state, [62], { at: 1500, dwellMs: 500, next: [] });
        expect(state.struck).toEqual([62]);
        expect(settleKeepUp(closeKeepUpStep(state, 2000).state).hit).toBe(true);
    });

    it("reads the next beat's pitch struck well before its beat as a wrong note", () => {
        const state = openKeepUpStep(startKeepUp(), [60], timing);
        const { expected } = strikeKeepUp(state, 62, 1500 - KEEP_UP_EARLY_MS - 10);
        expect(expected).toBe(false);
    });

    it("credits a beat's pitch struck a hair after the beat has closed", () => {
        let state = openKeepUpStep(startKeepUp(), [60], timing);
        state = closeKeepUpStep(state, 1500).state;
        state = openKeepUpStep(state, [62], { at: 1500, dwellMs: 500, next: [] });
        const late = strikeKeepUp(state, 60, 1500 + KEEP_UP_LATE_MS - 10);
        expect(late.expected).toBe(true);
        const settled = settleKeepUp(late.state);
        expect(settled.hit).toBe(true);
        expect(settled.state.hits).toEqual([true]);
    });

    it("reads a beat's pitch struck long after it closed as a wrong note", () => {
        let state = openKeepUpStep(startKeepUp(), [60], timing);
        state = closeKeepUpStep(state, 1500).state;
        state = openKeepUpStep(state, [62], { at: 1500, dwellMs: 500, next: [] });
        expect(strikeKeepUp(state, 60, 1500 + KEEP_UP_LATE_MS + 10).expected).toBe(false);
    });

    it("settles a beat still closing when the next one closes, keeping the verdicts in order", () => {
        let state = openKeepUpStep(startKeepUp(), [60], timing);
        state = strikeKeepUp(state, 60, 1100).state;
        state = closeKeepUpStep(state, 1500).state;
        state = openKeepUpStep(state, [62], { at: 1500, dwellMs: 50, next: [] });
        const closed = closeKeepUpStep(state, 1550);
        expect(closed.settled).toBe(true);
        expect(closed.state.hits).toEqual([true]);
        expect(settleKeepUp(closed.state).state.hits).toEqual([true, false]);
    });

    it("gives a repeated pitch to the beat still owed it, then to the open one", () => {
        let state = openKeepUpStep(startKeepUp(), [60], { at: 1000, dwellMs: 500, next: [60] });
        state = closeKeepUpStep(state, 1500).state;
        state = openKeepUpStep(state, [60], { at: 1500, dwellMs: 500, next: [] });
        state = strikeKeepUp(state, 60, 1520).state;
        expect(state.closing?.struck).toEqual([60]);
        expect(state.struck).toEqual([]);
        state = strikeKeepUp(state, 60, 1540).state;
        expect(state.struck).toEqual([60]);
    });

    it("gives a repeated pitch struck a hair early to the beat that asks for it next", () => {
        let state = openKeepUpStep(startKeepUp(), [60], { at: 1000, dwellMs: 500, next: [60] });
        state = strikeKeepUp(state, 60, 1010).state;
        const early = strikeKeepUp(state, 60, 1500 - KEEP_UP_EARLY_MS + 60);
        expect(early.expected).toBe(true);
        expect(early.caught).toBe(false);
        state = closeKeepUpStep(early.state, 1500).state;
        state = openKeepUpStep(state, [60], { at: 1500, dwellMs: 500, next: [] });
        expect(state.struck).toEqual([60]);
        const settled = settleKeepUp(closeKeepUpStep(state, 2000).state);
        expect(settled.state.hits).toEqual([true, true]);
    });

    it("keeps a repeated pitch for the open beat while that beat still owes it", () => {
        let state = openKeepUpStep(startKeepUp(), [60], { at: 1000, dwellMs: 500, next: [60] });
        const owed = strikeKeepUp(state, 60, 1500 - KEEP_UP_EARLY_MS + 60);
        expect(owed.caught).toBe(true);
        state = closeKeepUpStep(owed.state, 1500).state;
        state = openKeepUpStep(state, [60], { at: 1500, dwellMs: 500, next: [] });
        expect(state.struck).toEqual([]);
        expect(state.closing?.struck).toEqual([60]);
    });

    it("reads a re-strike of a repeated pitch well before the next beat as the same note", () => {
        let state = openKeepUpStep(startKeepUp(), [60], { at: 1000, dwellMs: 500, next: [60] });
        state = strikeKeepUp(state, 60, 1010).state;
        state = strikeKeepUp(state, 60, 1500 - KEEP_UP_EARLY_MS - 10).state;
        expect(state.early).toEqual([]);
        state = closeKeepUpStep(state, 1500).state;
        state = openKeepUpStep(state, [60], { at: 1500, dwellMs: 500, next: [] });
        expect(state.struck).toEqual([]);
    });
});

describe("the early window, as a property", () => {
    // A narrow range, so the beats share pitches as often as repeated notes and held
    // chord tones make them share in music.
    const pitch = fc.integer({ min: 60, max: 64 });
    const pitches = fc.uniqueArray(pitch, { maxLength: 4 });

    // Rushing is the mirror of dragging: a strike inside a beat's early window reaches
    // the beat, whatever the beat before it asked for or already had.
    it("never loses a strike inside a beat's early window", () => {
        fc.assert(
            fc.property(
                pitches,
                pitches,
                pitches,
                pitch,
                fc.integer({ min: 0, max: KEEP_UP_EARLY_MS }),
                (before, struckBefore, following, extra, ahead) => {
                    const next = [...new Set([...following, extra])];
                    const note = next[next.length - 1] ?? extra;
                    let state = openKeepUpStep(startKeepUp(), before, {
                        at: 1000,
                        dwellMs: 500,
                        next,
                    });
                    for (const earlier of struckBefore) {
                        state = strikeKeepUp(state, earlier, 1010).state;
                    }
                    const owedBefore = before.includes(note) && !state.struck.includes(note);
                    const strike = strikeKeepUp(state, note, 1500 - ahead);
                    expect(strike.expected).toBe(true);
                    state = closeKeepUpStep(strike.state, 1500).state;
                    state = openKeepUpStep(state, next, { at: 1500, dwellMs: 500, next: [] });
                    if (owedBefore) {
                        expect(state.closing?.struck).toContain(note);
                    } else {
                        expect(state.struck).toContain(note);
                    }
                },
            ),
        );
    });
});

describe("keep-up reducer properties", () => {
    const pitches = fc.uniqueArray(fc.integer({ min: 21, max: 108 }), { maxLength: 6 });

    it("hits exactly when the strikes cover the expected pitches, whatever the order or noise", () => {
        fc.assert(
            fc.property(pitches, pitches, (expected, strikes) => {
                const { hit } = playStep(startKeepUp(), expected, strikes);
                const covered = expected.every((pitch) => strikes.includes(pitch));
                expect(hit).toBe(expected.length === 0 ? null : covered);
            }),
        );
    });

    it("unexpected strikes never change the step's outcome", () => {
        fc.assert(
            fc.property(pitches, pitches, (expected, noise) => {
                const stray = noise.filter((pitch) => !expected.includes(pitch));
                const clean = playStep(startKeepUp(), expected, expected);
                const noisy = playStep(startKeepUp(), expected, [...stray, ...expected, ...stray]);
                expect(noisy.hit).toBe(clean.hit);
            }),
        );
    });

    it("duplicate strikes are idempotent", () => {
        fc.assert(
            fc.property(pitches, (expected) => {
                const once = playStep(startKeepUp(), expected, expected);
                const twice = playStep(startKeepUp(), expected, [...expected, ...expected]);
                expect(twice.state.hits).toEqual(once.state.hits);
            }),
        );
    });

    it("progress always matches the recorded hits", () => {
        fc.assert(
            fc.property(fc.array(fc.tuple(pitches, pitches), { maxLength: 12 }), (beats) => {
                let state = startKeepUp();
                for (const [expected, strikes] of beats) {
                    state = playStep(state, expected, strikes).state;
                }
                const { inTime, done } = keepUpProgress(state);
                expect(done).toBe(state.hits.length);
                expect(inTime).toBe(state.hits.filter(Boolean).length);
            }),
        );
    });
});
