// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { initialMatchState, type MatchState, matchNote } from "./matching";

// Multi-cursor matching for two-handed play: one cursor per hand, advancing
// independently. Reuses the single-hand chord reducer per hand, with a routing
// front-end that decides which hand a played note belongs to.

type StepPitches = { pitches: number[] };
type HandSteps = { steps: StepPitches[] };

export type HandsState = {
    hands: MatchState[];
    wrongNote: number | null;
};

export type HandsEvent =
    | { kind: "ignored" }
    | { kind: "wrong"; note: number }
    | { kind: "progress"; hand: number }
    | { kind: "correct"; hand: number; index: number; complete: boolean };

export function initialHandsState(handCount: number): HandsState {
    return {
        hands: Array.from({ length: handCount }, () => ({ ...initialMatchState })),
        wrongNote: null,
    };
}

// A hand's register: the mean of all its pitches. Used only to break ties when
// more than one hand expects the same note (hand-crossing or a shared pitch),
// routing it to the hand it sits closest to.
function register(hand: HandSteps): number {
    const pitches = hand.steps.flatMap((step) => step.pitches);
    return pitches.length === 0 ? 0 : pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
}

export function matchHands(
    state: HandsState,
    hands: HandSteps[],
    note: number,
): { state: HandsState; event: HandsEvent } {
    // Greedy by expectation: a hand is a candidate when its current step expects
    // the note. The common case is a single candidate.
    const candidates = hands
        .map((hand, index) => ({ index, step: hand.steps[state.hands[index].cursor] }))
        .filter((entry) => entry.step?.pitches.includes(note));

    if (candidates.length === 0) {
        return { state: { ...state, wrongNote: note }, event: { kind: "wrong", note } };
    }

    const chosen = candidates.reduce((best, candidate) => {
        const closer = Math.abs(note - register(hands[candidate.index]));
        const bestCloser = Math.abs(note - register(hands[best.index]));
        return closer < bestCloser || (closer === bestCloser && candidate.index < best.index)
            ? candidate
            : best;
    });

    const { state: handState, event } = matchNote(
        state.hands[chosen.index],
        hands[chosen.index].steps,
        note,
    );
    const nextHands = state.hands.map((hand, index) => (index === chosen.index ? handState : hand));
    const nextState: HandsState = { hands: nextHands, wrongNote: null };

    if (event.kind === "correct") {
        const complete = hands.every((hand, index) => nextHands[index].cursor >= hand.steps.length);
        return {
            state: nextState,
            event: { kind: "correct", hand: chosen.index, index: event.index, complete },
        };
    }
    return { state: nextState, event: { kind: "progress", hand: chosen.index } };
}

// The pitches each hand expects next — one entry per hand, for the display.
export function handsNextPitches(state: HandsState, hands: HandSteps[]): number[][] {
    return hands.map((hand, index) => hand.steps[state.hands[index].cursor]?.pitches ?? []);
}
