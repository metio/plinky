// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    type ClearedEvent,
    currentBar,
    expectedPitches,
    type MatchStep,
    matchNote,
    isPracticedHand,
    STAFF_FOR,
    startMatch,
    stepRange,
    upcomingSteps,
} from "./matcher";

const step = (pitches: number[], overrides: Partial<MatchStep> = {}): MatchStep => ({
    pitches,
    staves: [0],
    whole: 0,
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
        expect(isPracticedHand(STAFF_FOR.right, "right")).toBe(true);
        expect(isPracticedHand(STAFF_FOR.left, "right")).toBe(false);
        expect(isPracticedHand(STAFF_FOR.left, "left")).toBe(true);
        expect(isPracticedHand(STAFF_FOR.right, "left")).toBe(false);
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
            step([60], { staves: [0] }),
            step([48], { staves: [1] }),
            step([64, 67], { staves: [0] }),
        ]);
        expect(upcomingSteps(state, 2)).toEqual([
            { index: 0, pitches: [60], staves: [0] },
            { index: 1, pitches: [48], staves: [1] },
        ]);
    });

    it("advances its window and its indices as the run progresses", () => {
        const start = startMatch([step([60]), step([62]), step([64])]);
        const { state: next } = matchNote(start, 60);
        expect(upcomingSteps(next, 6)).toEqual([
            { index: 1, pitches: [62], staves: [0] },
            { index: 2, pitches: [64], staves: [0] },
        ]);
    });

    it("is empty once the run is complete", () => {
        const state = startMatch([step([60])]);
        const { state: done } = matchNote(state, 60);
        expect(upcomingSteps(done, 6)).toEqual([]);
    });
});

describe("matchNote", () => {
    it("clears single-note positions in order and completes", () => {
        let state = startMatch([step([60]), step([62])]);
        let result = matchNote(state, 60);
        expect(cleared(result.events)).toHaveLength(1);
        expect(cleared(result.events)[0]?.ordinal).toBe(0);
        state = result.state;
        expect(expectedPitches(state)).toEqual([62]);
        result = matchNote(state, 62);
        expect(result.state.complete).toBe(true);
        expect(cleared(result.events)[0]?.ordinal).toBe(1);
    });

    it("assembles a chord pitch by pitch in any order", () => {
        let state = startMatch([step([60, 64, 67])]);
        let result = matchNote(state, 67);
        expect(result.events).toEqual([{ kind: "hit", note: 67 }]);
        state = result.state;
        result = matchNote(state, 60);
        expect(result.events).toEqual([{ kind: "hit", note: 60 }]);
        state = result.state;
        result = matchNote(state, 64);
        expect(cleared(result.events)[0]?.playedPitches).toEqual([60, 64, 67]);
        expect(result.state.complete).toBe(true);
    });

    it("does not clear a chord from a repeated pitch", () => {
        let state = startMatch([step([60, 64])]);
        state = matchNote(state, 60).state;
        const result = matchNote(state, 60);
        expect(cleared(result.events)).toHaveLength(0);
        expect(result.state.complete).toBe(false);
    });

    it("counts a wrong note and reports it, without advancing", () => {
        const state = startMatch([step([60])]);
        const result = matchNote(state, 61);
        expect(result.events).toEqual([{ kind: "wrong", note: 61 }]);
        expect(result.state.wrong).toBe(1);
        expect(expectedPitches(result.state)).toEqual([60]);
    });

    it("reports how many wrong notes came before each clear, resetting per position", () => {
        let state = startMatch([step([60]), step([62])]);
        state = matchNote(state, 59).state;
        state = matchNote(state, 61).state;
        let result = matchNote(state, 60);
        expect(cleared(result.events)[0]?.wrongBefore).toBe(2);
        result = matchNote(result.state, 62);
        expect(cleared(result.events)[0]?.wrongBefore).toBe(0);
    });

    it("treats a next-position note as wrong when not forgiving", () => {
        const state = startMatch([step([60]), step([62])]);
        const result = matchNote(state, 62, false);
        expect(result.events).toEqual([{ kind: "wrong", note: 62 }]);
        expect(expectedPitches(result.state)).toEqual([60]);
    });

    it("forgiving: skips ahead crediting only what was played, and clears a single-note next", () => {
        let state = startMatch([step([60, 64]), step([62]), step([65])]);
        state = matchNote(state, 60, true).state; // half the chord
        const result = matchNote(state, 62, true); // the NEXT position's note
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
        const result = matchNote(state, 62, true);
        expect(cleared(result.events)).toHaveLength(1); // only the forgiven position
        state = result.state;
        expect(state.hit).toEqual([62]); // the note counts toward the new chord
        const finish = matchNote(state, 65, true);
        expect(cleared(finish.events)[0]?.playedPitches).toEqual([62, 65]);
        expect(finish.state.complete).toBe(true);
    });

    it("ignores input once complete", () => {
        let state = startMatch([step([60])]);
        state = matchNote(state, 60).state;
        expect(state.complete).toBe(true);
        const result = matchNote(state, 62);
        expect(result.events).toEqual([]);
        expect(result.state).toBe(state);
    });
});

describe("helpers", () => {
    it("currentBar follows the position and rests on the final bar once complete", () => {
        const steps = [step([60], { bar: 0 }), step([62], { bar: 3 })];
        let state = startMatch(steps);
        expect(currentBar(state)).toBe(0);
        state = matchNote(state, 60).state;
        expect(currentBar(state)).toBe(3);
        state = matchNote(state, 62).state;
        expect(currentBar(state)).toBe(3);
    });

    it("stepRange pads the pitch extremes by a whole tone each side", () => {
        expect(stepRange([step([60, 72]), step([55])])).toEqual({ from: 53, to: 74 });
        expect(stepRange([])).toBeNull();
    });
});

describe("matcher constants and edges", () => {
    it("maps each single hand to its staff index", () => {
        expect(STAFF_FOR).toEqual({ right: 0, left: 1 });
    });

    it("expects no pitches and rests on bar 0 with no steps, and empties once complete", () => {
        const empty = startMatch([]);
        expect(expectedPitches(empty)).toEqual([]);
        expect(currentBar(empty)).toBe(0);
        const done = matchNote(startMatch([step([60])]), 60).state;
        expect(expectedPitches(done)).toEqual([]);
    });

    it("resets the assembled pitches to empty when a position clears", () => {
        const result = matchNote(startMatch([step([60]), step([62])]), 60);
        expect(result.state.hit).toEqual([]);
    });

    it("defaults to non-forgiving, so a next-position note counts as wrong", () => {
        // No third argument: the default must be strict, not forgiving.
        const state = startMatch([step([60]), step([62])]);
        expect(matchNote(state, 62).events).toEqual([{ kind: "wrong", note: 62 }]);
    });

    it("forgiving into a chord emits the carried note as its own hit event", () => {
        const result = matchNote(startMatch([step([60]), step([62, 65])]), 62, true);
        expect(result.events).toContainEqual({ kind: "hit", note: 62 });
    });
});
