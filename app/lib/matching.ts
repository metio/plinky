// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Pure note-matching core, shared by every trainer. A chord advances only once
// all of its pitches have been pressed (in any order); a single note is just the
// one-pitch case. Kept free of React and the DOM so the rules are unit-testable.

// Only the pitches of a step matter here; callers pass their own richer Step.
type StepPitches = { pitches: number[] };

export type MatchState = {
    cursor: number;
    // Matching pitches of the current chord pressed so far, toward completing it.
    pressed: number[];
    wrongNote: number | null;
};

export type MatchEvent =
    | { kind: "ignored" } // no current step, or already complete
    | { kind: "wrong"; note: number }
    | { kind: "progress" } // a correct chord pitch, but the chord is not complete
    | { kind: "correct"; index: number; complete: boolean };

export const initialMatchState: MatchState = { cursor: 0, pressed: [], wrongNote: null };

export function matchNote(
    state: MatchState,
    steps: StepPitches[],
    note: number,
): { state: MatchState; event: MatchEvent } {
    const step = steps[state.cursor];
    if (!step) {
        return { state, event: { kind: "ignored" } };
    }

    if (!step.pitches.includes(note)) {
        return { state: { ...state, wrongNote: note }, event: { kind: "wrong", note } };
    }

    const pressed = state.pressed.includes(note) ? state.pressed : [...state.pressed, note];
    const complete = step.pitches.every((pitch) => pressed.includes(pitch));
    if (!complete) {
        return {
            state: { cursor: state.cursor, pressed, wrongNote: null },
            event: { kind: "progress" },
        };
    }

    const next = state.cursor + 1;
    return {
        state: { cursor: next, pressed: [], wrongNote: null },
        event: { kind: "correct", index: state.cursor, complete: next >= steps.length },
    };
}
