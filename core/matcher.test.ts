// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Hand2 } from "./matcher";
import { describe, expect, it } from "vitest";
import {
    askedFor,
    currentBar,
    expectedPitches,
    isPracticedHand,
    matchNote,
    staffArrivals,
    staffFor,
    startMatch,
    stepRange,
    type ClearedEvent,
    type MatchStep,
    upcomingSteps,
    jumpsBack,
    previewIndex,
} from "./matcher";
import { GRAND_STAFF, partsOf } from "./parts";

const step = (pitches: number[], overrides: Partial<MatchStep> = {}): MatchStep => ({
    pitches,
    pitchStaves: [0],
    pitchHands: ["right"],
    staves: [0],
    whole: 0,
    elapsedMs: 0,
    holdMs: 0,
    advancesCursor: true,
    slackMs: 0,
    pedalled: false,
    bar: 0,
    holdQuarters: 0,
    ...overrides,
});

const cleared = (events: ReturnType<typeof matchNote>["events"]): ClearedEvent[] =>
    events.filter((event): event is ClearedEvent => event.kind === "cleared");

describe("isPracticedHand", () => {
    it("owns every note in a both-hands run, whatever its staff", () => {
        expect(isPracticedHand(0, "both")).toBe(true);
        expect(isPracticedHand(1, "both")).toBe(true);
        expect(isPracticedHand(undefined, "both")).toBe(true);
    });

    it("owns only its own staff for a single hand", () => {
        expect(isPracticedHand(0, "right")).toBe(true);
        expect(isPracticedHand(1, "right")).toBe(false);
        expect(isPracticedHand(1, "left")).toBe(true);
        expect(isPracticedHand(0, "left")).toBe(false);
    });

    it("disowns a staff-less note for a single hand — it is the other hand's", () => {
        expect(isPracticedHand(undefined, "right")).toBe(false);
        expect(isPracticedHand(undefined, "left")).toBe(false);
    });
});

describe("startMatch", () => {
    it("is complete immediately for an empty score", () => {
        expect(startMatch([]).complete).toBe(true);
    });

    it("expects the first step's pitches", () => {
        const state = startMatch([step([60]), step([62])]);
        expect(expectedPitches(state)).toEqual([60]);
    });
});

describe("upcomingSteps", () => {
    it("returns the next positions from the current one with run indices and staves", () => {
        const state = startMatch([
            step([60], { pitchStaves: [0], staves: [0] }),
            step([48], { pitchStaves: [1], staves: [1] }),
            step([64, 67], { pitchStaves: [0], staves: [0] }),
        ]);
        expect(upcomingSteps(state, 2)).toEqual([
            {
                index: 0,
                pitches: [60],
                pitchStaves: [0],
                pitchHands: ["right"],
                staves: [0],
                atMs: 0,
                pitchHoldsMs: [0],
            },
            {
                index: 1,
                pitches: [48],
                pitchStaves: [1],
                pitchHands: ["right"],
                staves: [1],
                atMs: 0,
                pitchHoldsMs: [0],
            },
        ]);
    });

    it("advances its window and its indices as the run progresses", () => {
        const start = startMatch([step([60]), step([62]), step([64])]);
        const { state: next } = matchNote(start, 60, 0);
        expect(upcomingSteps(next, 6)).toEqual([
            {
                index: 1,
                pitches: [62],
                pitchStaves: [0],
                pitchHands: ["right"],
                staves: [0],
                atMs: 0,
                pitchHoldsMs: [0],
            },
            {
                index: 2,
                pitches: [64],
                pitchStaves: [0],
                pitchHands: ["right"],
                staves: [0],
                atMs: 0,
                pitchHoldsMs: [0],
            },
        ]);
    });

    it("is empty once the run is complete", () => {
        const state = startMatch([step([60])]);
        const { state: done } = matchNote(state, 60, 0);
        expect(upcomingSteps(done, 6)).toEqual([]);
    });

    it("carries when each position sounds, so a look-ahead can space by the music", () => {
        const state = startMatch([
            step([60], { elapsedMs: 0 }),
            step([62], { elapsedMs: 250 }),
            step([64], { elapsedMs: 2000 }),
        ]);
        expect(upcomingSteps(state, 3).map((one) => one.atMs)).toEqual([0, 250, 2000]);
    });

    it("carries each pitch's own written length, not the position's longest note", () => {
        // A whole note under a quaver is the ordinary case. Reading the position off
        // holdMs — its longest note — draws the quaver as long as the note held under it.
        const state = startMatch([
            step([48, 72], {
                holdMs: 2000,
                expected: [
                    { velocity: null, holdMs: 2000, writtenHoldMs: 2000 },
                    { velocity: null, holdMs: 200, writtenHoldMs: 250 },
                ],
            }),
        ]);
        expect(upcomingSteps(state, 1)[0]?.pitchHoldsMs).toEqual([2000, 250]);
    });

    it("takes the written length rather than the sounded one", () => {
        // Articulation shortens what you do with a note, not what is printed: a staccato
        // crotchet drawn as a semiquaver would teach the touch as the value.
        const state = startMatch([
            step([60], {
                holdMs: 500,
                expected: [{ velocity: null, holdMs: 125, writtenHoldMs: 500 }],
            }),
        ]);
        expect(upcomingSteps(state, 1)[0]?.pitchHoldsMs).toEqual([500]);
    });

    it("falls back to the position's length on a step model carrying no per-key detail", () => {
        // The duet's other hand and the fingering walk lift steps without `expected`.
        const state = startMatch([step([60, 64], { holdMs: 750 })]);
        expect(upcomingSteps(state, 1)[0]?.pitchHoldsMs).toEqual([750, 750]);
    });
});

describe("matchNote", () => {
    it("clears single-note positions in order and completes", () => {
        let state = startMatch([step([60]), step([62])]);
        let result = matchNote(state, 60, 0);
        expect(cleared(result.events)).toHaveLength(1);
        expect(cleared(result.events)[0]?.ordinal).toBe(0);
        state = result.state;
        expect(expectedPitches(state)).toEqual([62]);
        result = matchNote(state, 62, 0);
        expect(result.state.complete).toBe(true);
        expect(cleared(result.events)[0]?.ordinal).toBe(1);
    });

    it("assembles a chord pitch by pitch in any order", () => {
        let state = startMatch([step([60, 64, 67])]);
        let result = matchNote(state, 67, 0);
        expect(result.events).toEqual([{ kind: "hit", note: 67 }]);
        state = result.state;
        result = matchNote(state, 60, 0);
        expect(result.events).toEqual([{ kind: "hit", note: 60 }]);
        state = result.state;
        result = matchNote(state, 64, 0);
        expect(cleared(result.events)[0]?.playedPitches).toEqual([60, 64, 67]);
        expect(result.state.complete).toBe(true);
    });

    it("does not clear a chord from a repeated pitch", () => {
        let state = startMatch([step([60, 64])]);
        state = matchNote(state, 60, 0).state;
        const result = matchNote(state, 60, 0);
        expect(cleared(result.events)).toHaveLength(0);
        expect(result.state.complete).toBe(false);
    });

    it("counts a wrong note and reports it, without advancing", () => {
        const state = startMatch([step([60])]);
        const result = matchNote(state, 61, 0);
        expect(result.events).toEqual([{ kind: "wrong", note: 61 }]);
        expect(result.state.wrong).toBe(1);
        expect(expectedPitches(result.state)).toEqual([60]);
    });

    it("reports how many wrong notes came before each clear, resetting per position", () => {
        let state = startMatch([step([60]), step([62])]);
        state = matchNote(state, 59, 0).state;
        state = matchNote(state, 61, 0).state;
        let result = matchNote(state, 60, 0);
        expect(cleared(result.events)[0]?.wrongBefore).toBe(2);
        result = matchNote(result.state, 62, 0);
        expect(cleared(result.events)[0]?.wrongBefore).toBe(0);
    });

    it("treats a next-position note as wrong when not forgiving", () => {
        const state = startMatch([step([60]), step([62])]);
        const result = matchNote(state, 62, 0, false);
        expect(result.events).toEqual([{ kind: "wrong", note: 62 }]);
        expect(expectedPitches(result.state)).toEqual([60]);
    });

    it("forgiving: skips ahead crediting only what was played, and clears a single-note next", () => {
        let state = startMatch([step([60, 64]), step([62]), step([65])]);
        state = matchNote(state, 60, 0, true).state; // half the chord
        const result = matchNote(state, 62, 0, true); // the NEXT position's note
        const clears = cleared(result.events);
        expect(clears).toHaveLength(2);
        // The forgiven position credits only the pitch actually played…
        expect(clears[0]?.playedPitches).toEqual([60]);
        expect(clears[0]?.ordinal).toBe(0);
        // …and the note itself completes the single-note next position.
        expect(clears[1]?.playedPitches).toEqual([62]);
        expect(clears[1]?.ordinal).toBe(1);
        expect(expectedPitches(result.state)).toEqual([65]);
    });

    it("forgiving: a note starting a multi-pitch next position carries into its chord", () => {
        let state = startMatch([step([60]), step([62, 65])]);
        const result = matchNote(state, 62, 0, true);
        expect(cleared(result.events)).toHaveLength(1); // only the forgiven position
        state = result.state;
        // The note counts toward the new chord, and keeps the moment it landed.
        expect(state.hit).toEqual([{ note: 62, at: 0, velocity: 0 }]);
        const finish = matchNote(state, 65, 0, true);
        expect(cleared(finish.events)[0]?.playedPitches).toEqual([62, 65]);
        expect(finish.state.complete).toBe(true);
    });

    it("ignores input once complete", () => {
        let state = startMatch([step([60])]);
        state = matchNote(state, 60, 0).state;
        expect(state.complete).toBe(true);
        const result = matchNote(state, 62, 0);
        expect(result.events).toEqual([]);
        expect(result.state).toBe(state);
    });
});

describe("helpers", () => {
    it("currentBar follows the position and rests on the final bar once complete", () => {
        const steps = [step([60], { bar: 0 }), step([62], { bar: 3 })];
        let state = startMatch(steps);
        expect(currentBar(state)).toBe(0);
        state = matchNote(state, 60, 0).state;
        expect(currentBar(state)).toBe(3);
        state = matchNote(state, 62, 0).state;
        expect(currentBar(state)).toBe(3);
    });

    it("stepRange pads the pitch extremes by a whole tone each side", () => {
        expect(stepRange([step([60, 72]), step([55])])).toEqual({ from: 53, to: 74 });
        expect(stepRange([])).toBeNull();
    });
});

describe("matcher constants and edges", () => {
    it("maps each single hand to its staff index", () => {
        expect(staffFor("right", GRAND_STAFF)).toBe(0);
        expect(staffFor("left", GRAND_STAFF)).toBe(1);
    });

    it("expects no pitches and rests on bar 0 with no steps, and empties once complete", () => {
        const empty = startMatch([]);
        expect(expectedPitches(empty)).toEqual([]);
        expect(currentBar(empty)).toBe(0);
        const done = matchNote(startMatch([step([60])]), 60, 0).state;
        expect(expectedPitches(done)).toEqual([]);
    });

    it("resets the assembled pitches to empty when a position clears", () => {
        const result = matchNote(startMatch([step([60]), step([62])]), 60, 0);
        expect(result.state.hit).toEqual([]);
    });

    it("defaults to non-forgiving, so a next-position note counts as wrong", () => {
        // No forgiving argument: the default must be strict, not forgiving.
        const state = startMatch([step([60]), step([62])]);
        expect(matchNote(state, 62, 0).events).toEqual([{ kind: "wrong", note: 62 }]);
    });

    it("forgiving into a chord emits the carried note as its own hit event", () => {
        const result = matchNote(startMatch([step([60]), step([62, 65])]), 62, 0, true);
        expect(result.events).toContainEqual({ kind: "hit", note: 62 });
    });
});

describe("the staff of each pitch", () => {
    it("travels with the position, one entry per note", () => {
        // 41% of catalogue positions carry notes on both staves, so which hand plays
        // which key is the common question, not an edge case.
        const step = {
            pitches: [48, 64],
            pitchStaves: [1, 0],
            pitchHands: ["left", "right"] as Hand2[],
            staves: [0, 1],
            whole: 0,
            elapsedMs: 0,
            holdMs: 0,
            advancesCursor: true,
            slackMs: 0,
            pedalled: false,
            bar: 0,
            holdQuarters: 1,
        };
        const state = startMatch([step]);
        const [upcoming] = upcomingSteps(state, 1);
        expect(upcoming?.pitchStaves).toEqual([1, 0]);
        expect(upcoming?.pitches).toHaveLength(upcoming?.pitchStaves.length ?? 0);
    });
});

describe("when each pitch of a position landed", () => {
    it("records a time per pitch, not one for the whole position", () => {
        // A chord clears on its LAST note, so a single time says nothing about which
        // hand got there first — and on hands-together music that is the only evidence
        // of one hand trailing the other.
        let state = startMatch([step([48, 60])]);
        state = matchNote(state, 48, 1000, false).state;
        const finish = matchNote(state, 60, 1120, false);
        const [event] = cleared(finish.events);
        expect(event?.playedPitches).toEqual([48, 60]);
        expect(event?.arrivals).toEqual([1000, 1120]);
    });

    it("keeps a re-struck pitch's first arrival", () => {
        // The hand got there at the first strike; hitting it again while the rest of the
        // chord is still coming does not undo that.
        let state = startMatch([step([48, 60])]);
        state = matchNote(state, 48, 1000, false).state;
        state = matchNote(state, 48, 1090, false).state;
        const finish = matchNote(state, 60, 1120, false);
        expect(cleared(finish.events)[0]?.arrivals).toEqual([1000, 1120]);
    });

    it("gives a pitch credited without being played the clearing moment", () => {
        // The forgiving advance clears a position on a note belonging to the next one;
        // nothing is known to have happened for the pitches it skipped.
        const state = startMatch([step([60, 64]), step([67])]);
        const result = matchNote(state, 67, 2000, true);
        const [event] = cleared(result.events);
        expect(event?.arrivals.every((at) => at === 2000)).toBe(true);
    });
});

describe("a score whose piano is not the first instrument", () => {
    // Voice on staff 0, piano on staves 1 and 2 — the art-song shape, and 89% of the
    // catalogue's multi-part scores.
    const song = partsOf([1, 2]);

    it("gives each hand the piano's own staff", () => {
        expect(isPracticedHand(1, "right", song)).toBe(true);
        expect(isPracticedHand(2, "left", song)).toBe(true);
        // Not the singer's line, whichever hand is asked for.
        expect(isPracticedHand(0, "right", song)).toBe(false);
        expect(isPracticedHand(0, "left", song)).toBe(false);
    });

    it("keeps the sung line out of a both-hands run too", () => {
        // Otherwise the player is asked to play the melody they are meant to accompany.
        expect(isPracticedHand(0, "both", song)).toBe(false);
        expect(isPracticedHand(1, "both", song)).toBe(true);
        expect(isPracticedHand(2, "both", song)).toBe(true);
    });
});

describe("askedFor", () => {
    // Index-aligned with the pitches the PLAYER struck, not with the step's own order —
    // a chord is cleared in whatever order the hands find it.
    const step = {
        pitches: [60, 64, 67],
        expected: [
            { velocity: 80, holdMs: 400, writtenHoldMs: 500 },
            { velocity: 90, holdMs: 200, writtenHoldMs: 250 },
            null,
        ],
    } as unknown as MatchStep;

    it("reads each struck pitch's own expectation, in the order it was struck", () => {
        const read = askedFor({ step, playedPitches: [64, 60] }, 1);
        expect(read.expectedVelocities).toEqual([90, 80]);
        expect(read.expectedHoldsMs).toEqual([200, 400]);
        expect(read.writtenHoldsMs).toEqual([250, 500]);
    });

    it("divides the holds by the tempo ratio, because a slower run holds longer", () => {
        const read = askedFor({ step, playedPitches: [60] }, 2);
        expect(read.expectedHoldsMs).toEqual([200]);
        expect(read.writtenHoldsMs).toEqual([250]);
    });

    it("reports no expectation for a pitch the step never asked for", () => {
        // Forgiving mode lets a pitch through with nothing matched to it; the expressive
        // reading has to skip it rather than score it against a neighbour's mark.
        const read = askedFor({ step, playedPitches: [67, 61] }, 1);
        expect(read.expectedVelocities).toEqual([null, null]);
        expect(read.expectedHoldsMs).toEqual([0, 0]);
    });
});

describe("staffArrivals", () => {
    const step = { pitches: [48, 52, 72], pitchStaves: [1, 1, 0] } as unknown as MatchStep;

    it("gives each hand its EARLIEST arrival, not its last", () => {
        // A rolled chord finishes late; the hand's moment is when it struck.
        const times = staffArrivals({ step, playedPitches: [48, 52, 72], arrivals: [10, 45, 12] });
        expect(times).toEqual({ 1: 10, 0: 12 });
    });

    it("skips a pitch with no arrival rather than counting it as zero", () => {
        const times = staffArrivals({ step, playedPitches: [48, 52], arrivals: [] });
        expect(times).toEqual({});
    });
});

describe("a repeat sending the run back", () => {
    // `whole` is where a position is PRINTED. It rises with the run except across a repeat
    // barline, which is the one thing that sends a reader back over bars they have already
    // played — and therefore the one thing that leaves those bars coloured from the first
    // pass while they are read a second time.
    const at = (whole: number): MatchStep => step([60], { whole, bar: Math.floor(whole) });

    it("sees the jump when the next position is printed earlier", () => {
        expect(jumpsBack(at(8), at(4))).toBe(true);
    });

    it("sees nothing in music that simply carries on", () => {
        expect(jumpsBack(at(4), at(5))).toBe(false);
    });

    it("does not read two positions printed at the same moment as a jump", () => {
        // An ornament carries the onset of the note it decorates, so it shares a value
        // rather than preceding it. Reading that as a repeat would wipe the trail on every
        // trill in the piece.
        expect(jumpsBack(at(4), at(4))).toBe(false);
    });

    it("is not fooled by the fractions whole notes accumulate in", () => {
        // A hair below, and a hair that survives: `whole` is summed from note lengths like
        // a third of a beat, so a position printed at the same moment as the one before it
        // can land a fraction under rather than exactly on. The drift has to be bigger than
        // a double can lose at this magnitude — 0.1 + 0.2 - 0.3 is not, which is how this
        // test first passed while testing nothing.
        const drift = 1e-12;
        expect(4 - drift).not.toBe(4);
        expect(jumpsBack(at(4), at(4 - drift))).toBe(false);
    });
});

describe("previewIndex", () => {
    // Three bars, the first two inside a repeat: the performance is C D C D E and the
    // PRINTED onsets rewind, because the second pass reads the same bars.
    const REPEATED = [{ whole: 0 }, { whole: 1 }, { whole: 0 }, { whole: 1 }, { whole: 2 }];

    it("finds the first position when nothing has been previewed yet", () => {
        expect(previewIndex(REPEATED, 0)).toBe(0);
        expect(previewIndex(REPEATED, 2)).toBe(4);
    });

    it("walks forward through a repeat instead of falling back to the first pass", () => {
        // Following the performance one position at a time, carrying where it last landed.
        let at = -1;
        let last = Number.NEGATIVE_INFINITY;
        const walked: number[] = [];
        for (const whole of [0, 1, 0, 1, 2]) {
            at = previewIndex(REPEATED, whole, at, last);
            last = whole;
            walked.push(at);
        }
        // Every pass gets its own position. Taking the first match printed at each onset
        // gives [0, 1, 0, 1, 4] — the second pass drawn from the first pass's place.
        expect(walked).toEqual([0, 1, 2, 3, 4]);
    });

    it("stays put when asked for the position it is already on", () => {
        // The onset has not gone backwards, so the answer is here rather than the next one.
        expect(previewIndex(REPEATED, 0, 0, 0)).toBe(0);
    });

    it("treats a jump backwards with no history as a seek", () => {
        // No anchor means no pass to be on, so the first position printed there is right.
        expect(previewIndex(REPEATED, 0, -1)).toBe(0);
    });

    it("falls back to a whole-piece search when nothing lies ahead", () => {
        // Asked for the top of the piece from the last position: there is nothing at or
        // after it, so this is a seek back rather than a step on.
        expect(previewIndex(REPEATED, 0, 4, 2)).toBe(0);
    });

    it("answers -1 when no position is printed at or after the onset", () => {
        expect(previewIndex(REPEATED, 99)).toBe(-1);
    });

    it("is unbothered by a score that never repeats", () => {
        const plain = [{ whole: 0 }, { whole: 1 }, { whole: 2 }];
        let at = -1;
        let last = Number.NEGATIVE_INFINITY;
        const walked: number[] = [];
        for (const whole of [0, 1, 2]) {
            at = previewIndex(plain, whole, at, last);
            last = whole;
            walked.push(at);
        }
        expect(walked).toEqual([0, 1, 2]);
    });
});

describe("previewIndex as a resume anchor", () => {
    const REPEATED = [{ whole: 0 }, { whole: 1 }, { whole: 0 }, { whole: 1 }, { whole: 2 }];

    it("resumes on the pass the anchor is standing on", () => {
        // Listen is on the second pass, at the bar printed at 0 — position 2, not 0. The
        // resume asks for that same onset, so the anchor holds and the run continues where
        // the listening left off rather than replaying bars just heard.
        expect(previewIndex(REPEATED, 0, 2, 0)).toBe(2);
        expect(previewIndex(REPEATED, 1, 3, 1)).toBe(3);
    });

    it("resumes on the first pass when the anchor is standing there", () => {
        expect(previewIndex(REPEATED, 0, 0, 0)).toBe(0);
    });
});
