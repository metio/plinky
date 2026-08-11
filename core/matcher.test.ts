// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    type ClearedEvent,
    currentBar,
    expectedPitches,
    type MatchStep,
    matchNote,
    isPracticedHand,
    staffFor,
    startMatch,
    stepRange,
    upcomingSteps,
} from "./matcher";
import { GRAND_STAFF, partsOf } from "./parts";

const step = (pitches: number[], overrides: Partial<MatchStep> = {}): MatchStep => ({
    pitches,
    pitchStaves: [0], staves: [0],
    whole: 0,
    elapsed: 0,
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
            { index: 0, pitches: [60], pitchStaves: [0], staves: [0] },
            { index: 1, pitches: [48], pitchStaves: [1], staves: [1] },
        ]);
    });

    it("advances its window and its indices as the run progresses", () => {
        const start = startMatch([step([60]), step([62]), step([64])]);
        const { state: next } = matchNote(start, 60, 0);
        expect(upcomingSteps(next, 6)).toEqual([
            { index: 1, pitches: [62], pitchStaves: [0], staves: [0] },
            { index: 2, pitches: [64], pitchStaves: [0], staves: [0] },
        ]);
    });

    it("is empty once the run is complete", () => {
        const state = startMatch([step([60])]);
        const { state: done } = matchNote(state, 60, 0);
        expect(upcomingSteps(done, 6)).toEqual([]);
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
        expect(state.hit).toEqual([{ note: 62, at: 0 }]);
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
            staves: [0, 1],
            whole: 0,
            elapsed: 0,
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
