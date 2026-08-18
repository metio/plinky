// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    EMPTY_STEP,
    type StepState,
    stepBack,
    stepDown,
    stepDurationMs,
    stepFrom,
    stepRest,
    stepUp,
} from "./stepInput";

const QUARTER = stepDurationMs("quarter", 120); // 500ms
const key = (pitch: number) => ({ pitch, velocity: 80 });

// One key pressed and released.
const step = (state: StepState, pitch: number, ms = QUARTER) =>
    stepUp(stepDown(state, key(pitch), ms));

describe("stepDurationMs", () => {
    it("measures a value against the beat", () => {
        expect(stepDurationMs("quarter", 120)).toBe(500);
        expect(stepDurationMs("half", 120)).toBe(1000);
        expect(stepDurationMs("eighth", 120)).toBe(250);
        expect(stepDurationMs("whole", 60)).toBe(4000);
    });

    it("adds half again for a dot", () => {
        expect(stepDurationMs("quarter", 120, true)).toBe(750);
    });

    it("refuses to divide by a tempo of zero", () => {
        // Tempo reaches here from a text field and from shared links; dividing by it
        // would make every onset after this one Infinity.
        expect(Number.isFinite(stepDurationMs("quarter", 0))).toBe(true);
        expect(Number.isFinite(stepDurationMs("quarter", -20))).toBe(true);
    });
});

describe("entering notes one at a time", () => {
    it("places a note where the cursor stands and moves on by its length", () => {
        const one = step(EMPTY_STEP, 60);
        expect(one.notes).toEqual([
            { pitch: 60, startMs: 0, durationMs: 500, velocity: 80 },
        ]);
        expect(one.atMs).toBe(500);

        const two = step(one, 62);
        expect(two.notes[1]).toMatchObject({ pitch: 62, startMs: 500, durationMs: 500 });
        expect(two.atMs).toBe(1000);
    });

    it("writes exactly the length asked for, whatever the hands did", () => {
        // The whole point against recording: the note is as long as the value chosen,
        // not as long as the key was held.
        const held = stepUp(stepDown(EMPTY_STEP, key(60), stepDurationMs("half", 120)));
        expect(held.notes[0]?.durationMs).toBe(1000);
    });

    it("keeps the player's touch", () => {
        const soft = stepUp(stepDown(EMPTY_STEP, { pitch: 60, velocity: 30 }, QUARTER));
        expect(soft.notes[0]?.velocity).toBe(30);
    });
});

describe("chords", () => {
    it("puts keys pressed together at one position, and advances once", () => {
        let state = stepDown(EMPTY_STEP, key(60), QUARTER);
        state = stepDown(state, key(64), QUARTER);
        state = stepDown(state, key(67), QUARTER);
        expect(state.atMs).toBe(0);
        state = stepUp(stepUp(stepUp(state)));

        expect(state.notes.map((n) => n.startMs)).toEqual([0, 0, 0]);
        expect(state.atMs).toBe(500);
    });

    it("takes its length from the key that began it", () => {
        // Changing the value mid-chord must not leave one note of it a different length
        // from the others, nor advance by a value the chord was not written with.
        let state = stepDown(EMPTY_STEP, key(60), stepDurationMs("half", 120));
        state = stepDown(state, key(64), stepDurationMs("sixteenth", 120));
        state = stepUp(stepUp(state));
        expect(state.notes.map((n) => n.durationMs)).toEqual([1000, 1000]);
        expect(state.atMs).toBe(1000);
    });
});

describe("rests", () => {
    it("moves the cursor on without writing a note", () => {
        const after = stepRest(step(EMPTY_STEP, 60), QUARTER);
        expect(after.notes).toHaveLength(1);
        expect(after.atMs).toBe(1000);
    });

    it("is refused while keys are still down", () => {
        // Mid-chord it would leave the held keys writing into the bar past the gap.
        const holding = stepDown(EMPTY_STEP, key(60), QUARTER);
        expect(stepRest(holding, QUARTER)).toEqual(holding);
    });
});

describe("taking a step back", () => {
    it("removes the last note and stands where it was", () => {
        const back = stepBack(step(step(EMPTY_STEP, 60), 62));
        expect(back.notes.map((n) => n.pitch)).toEqual([60]);
        expect(back.atMs).toBe(500);
    });

    it("removes a whole chord, not one note of it", () => {
        let state = stepDown(step(EMPTY_STEP, 60), key(64), QUARTER);
        state = stepDown(state, key(67), QUARTER);
        state = stepUp(stepUp(state));
        expect(stepBack(state).notes.map((n) => n.pitch)).toEqual([60]);
        expect(stepBack(state).atMs).toBe(500);
    });

    it("does nothing on an empty take, or mid-chord", () => {
        expect(stepBack(EMPTY_STEP)).toEqual(EMPTY_STEP);
        const holding = stepDown(EMPTY_STEP, key(60), QUARTER);
        expect(stepBack(holding)).toEqual(holding);
    });
});

describe("picking up an existing take", () => {
    it("stands after the last note rather than on top of it", () => {
        const played = [
            { pitch: 60, startMs: 0, durationMs: 400, velocity: 80 },
            { pitch: 62, startMs: 700, durationMs: 300, velocity: 80 },
        ];
        expect(stepFrom(played).atMs).toBe(1000);
        expect(stepFrom(played).notes).toEqual(played);
    });

    it("starts at the beginning for an empty one", () => {
        expect(stepFrom([])).toEqual(EMPTY_STEP);
    });

    it("follows the longest note, not the last one entered", () => {
        // A held bass note under a run ends after the run does.
        const overlapping = [
            { pitch: 36, startMs: 0, durationMs: 2000, velocity: 80 },
            { pitch: 72, startMs: 500, durationMs: 250, velocity: 80 },
        ];
        expect(stepFrom(overlapping).atMs).toBe(2000);
    });
});

// What the staff can actually draw. The sketch engraves on a fixed sixteenth grid, so a
// value that is not a whole number of sixteenths is rounded to one that is — and the
// player is shown a note they did not write.
describe("what the engraving can hold", () => {
    const SIXTEENTH = stepDurationMs("sixteenth", 120);

    it("gives every offered value a whole number of sixteenths", () => {
        for (const value of ["whole", "half", "quarter", "eighth", "sixteenth"] as const) {
            const cells = stepDurationMs(value, 120) / SIXTEENTH;
            expect(Number.isInteger(cells)).toBe(true);
        }
    });

    it("gives every dotted value a whole number too, except the shortest", () => {
        for (const value of ["whole", "half", "quarter", "eighth"] as const) {
            const cells = stepDurationMs(value, 120, true) / SIXTEENTH;
            expect(Number.isInteger(cells)).toBe(true);
        }
        // The one the panel refuses to offer: a dotted sixteenth is a cell and a half.
        expect(stepDurationMs("sixteenth", 120, true) / SIXTEENTH).toBe(1.5);
    });
});
