// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type MatcherState,
    type MatchEvent,
    type MatchStep,
    expectedPitches,
    matchNote,
    startMatch,
} from "./matcher";

// The reducer scores every practice run, so its invariants — the index only
// moves forward, one cleared event per position, forgiving mode never wedges —
// are pinned over arbitrary pieces and arbitrary playing, not just the example
// runs the unit tests enumerate.

const pitch = fc.integer({ min: 21, max: 108 });

// A playable piece: 1–8 positions, each a single note or a chord of distinct
// pitches, laid out on a simple timeline.
const stepsArb: fc.Arbitrary<MatchStep[]> = fc
    .array(fc.uniqueArray(pitch, { minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 8 })
    .map((chords) =>
        chords.map((pitches, index) => ({
            pitches,
            staves: [0],
            whole: index,
            bar: index >> 2,
        })),
    );

type Played = { state: MatcherState; events: MatchEvent[] };

// Feed a whole note sequence, collecting every event along the way.
function play(
    steps: MatchStep[],
    notes: number[],
    forgiving: boolean,
): { state: MatcherState; events: MatchEvent[] } {
    let state = startMatch(steps);
    const events: MatchEvent[] = [];
    for (const note of notes) {
        const result: Played = matchNote(state, note, forgiving);
        state = result.state;
        events.push(...result.events);
    }
    return { state, events };
}

describe("matcher properties", () => {
    it("moves the index forward only, one step per cleared event", () => {
        fc.assert(
            fc.property(stepsArb, fc.array(pitch, { maxLength: 40 }), fc.boolean(), (steps, notes, forgiving) => {
                let state = startMatch(steps);
                for (const note of notes) {
                    const before = state.index;
                    const result = matchNote(state, note, forgiving);
                    const cleared = result.events.filter((e) => e.kind === "cleared").length;
                    expect(result.state.index).toBe(before + cleared);
                    expect(result.state.index).toBeGreaterThanOrEqual(before);
                    state = result.state;
                }
            }),
        );
    });

    it("clears at most every position, and is complete exactly when all are cleared", () => {
        fc.assert(
            fc.property(stepsArb, fc.array(pitch, { maxLength: 40 }), fc.boolean(), (steps, notes, forgiving) => {
                const { state, events } = play(steps, notes, forgiving);
                const cleared = events.filter((e) => e.kind === "cleared");
                expect(cleared.length).toBeLessThanOrEqual(steps.length);
                expect(state.complete).toBe(cleared.length === steps.length);
                // Each position is cleared once, in order.
                expect(cleared.map((e) => (e.kind === "cleared" ? e.ordinal : -1))).toEqual(
                    cleared.map((_, i) => i),
                );
            }),
        );
    });

    it("counts exactly one wrong per wrong event", () => {
        fc.assert(
            fc.property(stepsArb, fc.array(pitch, { maxLength: 40 }), fc.boolean(), (steps, notes, forgiving) => {
                const { state, events } = play(steps, notes, forgiving);
                expect(state.wrong).toBe(events.filter((e) => e.kind === "wrong").length);
            }),
        );
    });

    it("never freezes: playing what is expected always finishes, noise or not", () => {
        fc.assert(
            fc.property(stepsArb, fc.array(pitch, { maxLength: 10 }), fc.boolean(), (steps, noise, forgiving) => {
                let state = startMatch(steps);
                const totalPitches = steps.reduce((sum, step) => sum + step.pitches.length, 0);
                let plays = 0;
                let noiseAt = 0;
                while (!state.complete) {
                    // Interleave arbitrary noise, then play the next expected pitch;
                    // the run must still advance to the end.
                    if (noiseAt < noise.length) {
                        state = matchNote(state, noise[noiseAt++] as number, forgiving).state;
                    }
                    // The first pitch of the position not yet sounded — replaying an
                    // already-hit chord note would not advance the run.
                    const next = expectedPitches(state).find((p) => !state.hit.includes(p));
                    if (next === undefined) {
                        break; // the noise itself completed the run (forgiving skip)
                    }
                    state = matchNote(state, next, forgiving).state;
                    plays++;
                    expect(plays).toBeLessThanOrEqual(totalPitches + noise.length + 1);
                }
                expect(state.complete).toBe(true);
            }),
        );
    });

    it("prefers matching the current position over skipping to a same-pitch next one", () => {
        // A repeated single note [[60],[60]] in forgiving mode: the first 60 clears
        // position 0 only — the match branch wins over the forgiving skip, so the
        // run does not jump two positions on one keypress.
        const steps: MatchStep[] = [
            { pitches: [60], staves: [0], whole: 0, bar: 0 },
            { pitches: [60], staves: [0], whole: 1, bar: 0 },
        ];
        const first = matchNote(startMatch(steps), 60, true);
        expect(first.events.map((e) => e.kind)).toEqual(["cleared"]);
        expect(first.state.index).toBe(1);
        expect(first.state.complete).toBe(false);
        const second = matchNote(first.state, 60, true);
        expect(second.state.complete).toBe(true);
    });
});
