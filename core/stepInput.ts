// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { quartersMs } from "./elapsed";
import type { RecordedNote } from "./composition";

// Writing a piece down one note at a time, instead of playing it.
//
// Compose records a performance: what was pressed, when, and for how long, in
// milliseconds. That is the right model for an improvisation and the wrong one for
// somebody who knows the tune they want and cannot play it up to speed — their rhythm
// ends up being whatever their hands managed, and the staff shows it. Step entry writes
// the note the player asked for: a value is chosen, a key names the pitch, and the note
// lands exactly that long at exactly the next position.
//
// The notes it produces are ordinary recorded notes, so everything downstream — the
// staff sketch, playback, the exports, the share link — needs to know nothing about it.
// The lengths are exact multiples of the beat, which is also why a stepped passage
// engraves cleanly where a played one needs quantizing.
//
// A chord is what it is at a keyboard: keys pressed together. Each key down while
// another is still held joins the same step, and the position only advances once the
// last of them is released — so a triad is three notes at one position, not three steps.

// What a step is worth, as a fraction of a whole note. Dotted values are a flag rather
// than more entries, since every one of these can be dotted and doubling the list to say
// so would read as ten unrelated choices.
export type StepValue = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

export const STEP_VALUES: readonly StepValue[] = [
    "whole",
    "half",
    "quarter",
    "eighth",
    "sixteenth",
];

const QUARTERS: Record<StepValue, number> = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    sixteenth: 0.25,
};

export function stepDurationMs(value: StepValue, tempo: number, dotted = false): number {
    // quartersMs floors the tempo at one: a tempo of zero or less would divide to Infinity
    // and poison every onset after it, and tempo arrives from a text field and from links.
    const beatMs = quartersMs(1, tempo);
    return QUARTERS[value] * beatMs * (dotted ? 1.5 : 1);
}

export type StepState = {
    notes: readonly RecordedNote[];
    // Where the next step lands, in milliseconds from the start of the take.
    atMs: number;
    // How many keys are down in the step being entered. The position advances when this
    // returns to zero, which is what makes a chord one step.
    holding: number;
    // How long the step in progress is, so releasing advances by what was placed rather
    // than by whatever value happens to be selected when the key comes up.
    stepMs: number;
};

export const EMPTY_STEP: StepState = { notes: [], atMs: 0, holding: 0, stepMs: 0 };

// Begin or extend a step. The first key down fixes how far this step will advance; the
// rest join it as a chord.
export function stepDown(
    state: StepState,
    note: { pitch: number; velocity: number },
    durationMs: number,
): StepState {
    const stepMs = state.holding === 0 ? durationMs : state.stepMs;
    return {
        notes: [
            ...state.notes,
            {
                pitch: note.pitch,
                startMs: state.atMs,
                durationMs: stepMs,
                velocity: note.velocity,
            },
        ],
        atMs: state.atMs,
        holding: state.holding + 1,
        stepMs,
    };
}

// A key up. Only the last one moves the position on.
export function stepUp(state: StepState): StepState {
    if (state.holding <= 1) {
        return { ...state, atMs: state.atMs + state.stepMs, holding: 0, stepMs: 0 };
    }
    return { ...state, holding: state.holding - 1 };
}

// Silence of the chosen length. Refused mid-chord, where it would leave the keys still
// down writing into the bar after the gap.
export function stepRest(state: StepState, durationMs: number): StepState {
    return state.holding > 0 ? state : { ...state, atMs: state.atMs + durationMs };
}

// Take back the last step — every note of it, chord and all — and stand where it began.
export function stepBack(state: StepState): StepState {
    if (state.holding > 0 || state.notes.length === 0) {
        return state;
    }
    const lastStart = Math.max(...state.notes.map((note) => note.startMs));
    const kept = state.notes.filter((note) => note.startMs < lastStart);
    return { notes: kept, atMs: lastStart, holding: 0, stepMs: 0 };
}

// Pick the entry up from an existing take — a loaded file, a shared link, or a passage
// played live that the player now wants to continue a note at a time. The position is
// the end of the last note rather than its start, so the next step follows the music
// instead of landing on top of it.
export function stepFrom(notes: readonly RecordedNote[]): StepState {
    if (notes.length === 0) {
        return EMPTY_STEP;
    }
    const end = Math.max(...notes.map((note) => note.startMs + note.durationMs));
    return { notes, atMs: end, holding: 0, stepMs: 0 };
}
