// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type MatcherState,
    type MatchEvent,
    type MatchStep,
    expectedPitches,
    gradedTally,
    matchNote,
    resumeIndex,
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
            pitchStaves: [0],
            pitchHands: ["right"] as const,
            staves: [0],
            whole: index,
            elapsedMs: index * 1000,
            holdMs: 1000,
            advancesCursor: true,
            position: 0,
            slackMs: 0,
            pedalled: false,
            bar: index >> 2,
            holdQuarters: 1,
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
        const result: Played = matchNote(state, note, 0, forgiving);
        state = result.state;
        events.push(...result.events);
    }
    return { state, events };
}

describe("matcher properties", () => {
    it("moves the index forward only, one step per cleared event", () => {
        fc.assert(
            fc.property(
                stepsArb,
                fc.array(pitch, { maxLength: 40 }),
                fc.boolean(),
                (steps, notes, forgiving) => {
                    let state = startMatch(steps);
                    for (const note of notes) {
                        const before = state.index;
                        const result = matchNote(state, note, 0, forgiving);
                        const cleared = result.events.filter((e) => e.kind === "cleared").length;
                        expect(result.state.index).toBe(before + cleared);
                        expect(result.state.index).toBeGreaterThanOrEqual(before);
                        state = result.state;
                    }
                },
            ),
        );
    });

    it("clears at most every position, and is complete exactly when all are cleared", () => {
        fc.assert(
            fc.property(
                stepsArb,
                fc.array(pitch, { maxLength: 40 }),
                fc.boolean(),
                (steps, notes, forgiving) => {
                    const { state, events } = play(steps, notes, forgiving);
                    const cleared = events.filter((e) => e.kind === "cleared");
                    expect(cleared.length).toBeLessThanOrEqual(steps.length);
                    expect(state.complete).toBe(cleared.length === steps.length);
                    // Each position is cleared once, in order.
                    expect(cleared.map((e) => (e.kind === "cleared" ? e.ordinal : -1))).toEqual(
                        cleared.map((_, i) => i),
                    );
                },
            ),
        );
    });

    it("tallies as right only the positions played in full", () => {
        fc.assert(
            fc.property(
                stepsArb,
                fc.array(pitch, { maxLength: 40 }),
                fc.boolean(),
                (steps, notes, forgiving) => {
                    const { state, events } = play(steps, notes, forgiving);
                    const cleared = events.filter((e) => e.kind === "cleared");
                    const short = cleared.filter(
                        (e) => !e.step.pitches.every((p) => e.playedPitches.includes(p)),
                    );
                    // A strict run never moves on without the notes, so it never misses.
                    expect(state.missed).toBe(forgiving ? short.length : 0);
                    const tally = gradedTally({
                        positions: cleared.length,
                        wrong: state.wrong,
                        missed: state.missed,
                    });
                    expect(tally.correct).toBe(cleared.length - short.length);
                    expect(tally.wrong).toBe(state.wrong + short.length);
                    // No position short of its notes reads as a clean first try.
                    for (const e of short) {
                        expect(e.wrongBefore).toBeGreaterThan(0);
                    }
                },
            ),
        );
    });

    it("counts exactly one wrong per wrong event", () => {
        fc.assert(
            fc.property(
                stepsArb,
                fc.array(pitch, { maxLength: 40 }),
                fc.boolean(),
                (steps, notes, forgiving) => {
                    const { state, events } = play(steps, notes, forgiving);
                    expect(state.wrong).toBe(events.filter((e) => e.kind === "wrong").length);
                },
            ),
        );
    });

    it("never freezes: playing what is expected always finishes, noise or not", () => {
        fc.assert(
            fc.property(
                stepsArb,
                fc.array(pitch, { maxLength: 10 }),
                fc.boolean(),
                (steps, noise, forgiving) => {
                    let state = startMatch(steps);
                    const totalPitches = steps.reduce((sum, step) => sum + step.pitches.length, 0);
                    let plays = 0;
                    let noiseAt = 0;
                    while (!state.complete) {
                        // Interleave arbitrary noise, then play the next expected pitch;
                        // the run must still advance to the end.
                        if (noiseAt < noise.length) {
                            state = matchNote(
                                state,
                                noise[noiseAt++] as number,
                                0,
                                forgiving,
                            ).state;
                        }
                        // The first pitch of the position not yet sounded — replaying an
                        // already-hit chord note would not advance the run.
                        const next = expectedPitches(state).find(
                            (p) => !state.hit.some((arrival) => arrival.note === p),
                        );
                        if (next === undefined) {
                            break; // the noise itself completed the run (forgiving skip)
                        }
                        state = matchNote(state, next, 0, forgiving).state;
                        plays++;
                        expect(plays).toBeLessThanOrEqual(totalPitches + noise.length + 1);
                    }
                    expect(state.complete).toBe(true);
                },
            ),
        );
    });

    it("prefers matching the current position over skipping to a same-pitch next one", () => {
        // A repeated single note [[60],[60]] in forgiving mode: the first 60 clears
        // position 0 only — the match branch wins over the forgiving skip, so the
        // run does not jump two positions on one keypress.
        const steps: MatchStep[] = [
            {
                pitches: [60],
                pitchStaves: [0],
                pitchHands: ["right"],
                staves: [0],
                whole: 0,
                elapsedMs: 0,
                holdMs: 1000,
                bar: 0,
                holdQuarters: 1,
                advancesCursor: true,
                position: 0,
                slackMs: 0,
                pedalled: false,
            },
            {
                pitches: [60],
                pitchStaves: [0],
                pitchHands: ["right"],
                staves: [0],
                whole: 1,
                elapsedMs: 1000,
                holdMs: 1000,
                bar: 0,
                holdQuarters: 1,
                advancesCursor: true,
                position: 0,
                slackMs: 0,
                pedalled: false,
            },
        ];
        const first = matchNote(startMatch(steps), 60, 0, true);
        expect(first.events.map((e) => e.kind)).toEqual(["cleared"]);
        expect(first.state.index).toBe(1);
        expect(first.state.complete).toBe(false);
        const second = matchNote(first.state, 60, 0, true);
        expect(second.state.complete).toBe(true);
    });
});

describe("resumeIndex properties", () => {
    // Cursor positions in play order: never decreasing, and shared by an ornament and its
    // principal. A repeat adds positions rather than reusing them, so the walk rises.
    const positionsArb = fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 12 }).map((gaps) => {
        let at = 0;
        return gaps.map((gap) => {
            at += gap;
            return { position: at };
        });
    });

    it("starts on the first step at or past the cursor, skipping none after it", () => {
        fc.assert(
            fc.property(positionsArb, fc.integer({ min: 0, max: 40 }), (steps, ordinal) => {
                const index = resumeIndex(steps, ordinal);
                const ahead = steps.filter((step) => step.position >= ordinal).length;
                if (index < 0) {
                    expect(ahead).toBe(0);
                    return;
                }
                expect(steps[index]!.position).toBeGreaterThanOrEqual(ordinal);
                // Everything before it is behind the cursor, and the run it begins holds
                // every step that is not.
                expect(steps.slice(0, index).every((step) => step.position < ordinal)).toBe(true);
                expect(steps.length - index).toBe(ahead);
            }),
        );
    });
});

describe("a run with its grace notes left out", () => {
    // Positions that are either a plain chord or a single grace note ahead of the chord it
    // decorates, printed in one place. The grace is never one of its principal's keys, so
    // the principal struck over it is always the next position's note.
    const figuresArb = fc.array(
        fc.uniqueArray(pitch, { minLength: 2, maxLength: 4 }).chain(([grace, ...principal]) =>
            fc.record({
                grace: fc.constant(grace as number),
                principal: fc.constant(principal),
                ornamented: fc.boolean(),
                omitted: fc.boolean(),
            }),
        ),
        { minLength: 1, maxLength: 8 },
    );

    const stepOf = (pitches: number[], index: number, advancesCursor: boolean): MatchStep => ({
        pitches,
        pitchStaves: [0],
        pitchHands: ["right"],
        staves: [0],
        whole: index,
        elapsedMs: index * 1000,
        holdMs: 1000,
        advancesCursor,
        position: index,
        slackMs: advancesCursor ? 0 : 120,
        pedalled: false,
        bar: index >> 2,
        holdQuarters: 1,
    });

    // A grace note left out is missed in forgiving mode exactly as any position is: the run
    // goes on to its principal, and the grace is never credited as a right note.
    it("misses exactly the graces left out, and credits none of them", () => {
        fc.assert(
            fc.property(figuresArb, (figures) => {
                const steps = figures.flatMap((figure, index) =>
                    figure.ornamented
                        ? [
                              stepOf([figure.grace], index, false),
                              stepOf(figure.principal, index, true),
                          ]
                        : [stepOf(figure.principal, index, true)],
                );
                const strikes = figures.flatMap((figure) =>
                    figure.ornamented && !figure.omitted
                        ? [figure.grace, ...figure.principal]
                        : figure.principal,
                );
                const left = figures.filter((figure) => figure.ornamented && figure.omitted);

                const { state, events } = play(steps, strikes, true);
                expect(state.complete).toBe(true);
                expect(state.wrong).toBe(0);
                expect(state.missed).toBe(left.length);

                const graces = events.filter(
                    (e): e is Extract<MatchEvent, { kind: "cleared" }> =>
                        e.kind === "cleared" && !e.step.advancesCursor,
                );
                const unplayed = graces.filter((e) => e.playedPitches.length === 0);
                expect(unplayed).toHaveLength(left.length);
                for (const e of unplayed) {
                    expect(e.wrongBefore).toBe(1);
                }

                const tally = gradedTally({
                    positions: steps.length,
                    wrong: state.wrong,
                    missed: state.missed,
                });
                expect(tally).toEqual({
                    correct: steps.length - left.length,
                    wrong: left.length,
                });
                // Playing every grace is never worth fewer right notes than leaving some out.
                const whole = play(
                    steps,
                    steps.flatMap((step) => step.pitches),
                    true,
                ).state;
                expect(whole.missed).toBe(0);
                expect(tally.correct).toBeLessThanOrEqual(steps.length - whole.missed);
            }),
        );
    });
});

describe("a finished run", () => {
    // A skip needs a next position to move on to, so the last one is always played in
    // full: however much was skipped, a run that completes has cleared at least one
    // position outright, and its graded tally never reads zero right notes.
    it("clears its last position in full, however much it skipped", () => {
        fc.assert(
            fc.property(stepsArb, fc.array(pitch, { maxLength: 40 }), (steps, noise) => {
                // Arbitrary playing, then every remaining position's notes in order,
                // so each run ends complete.
                const { state } = play(
                    steps,
                    [...noise, ...steps.flatMap((step) => step.pitches)],
                    true,
                );
                expect(state.complete).toBe(true);
                expect(state.missed).toBeLessThan(steps.length);
                const tally = gradedTally({
                    positions: steps.length,
                    wrong: state.wrong,
                    missed: state.missed,
                });
                expect(tally.correct).toBeGreaterThan(0);
            }),
        );
    });
});
