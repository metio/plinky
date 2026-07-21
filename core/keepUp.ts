// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The tempo-locked play-along scorer: a pure reducer over the steps the clock
// opens and closes. The rendering surface walks the cursor on its timer, feeds
// each step's expected pitches in as it opens and the player's strikes as they
// land, and closes the step when the cursor moves on; everything about what
// counts as catching a beat lives here, testable without a score renderer.
// (The self-paced twin is core/matcher.ts, where the player's input drives the
// advance; here the clock does.)

// One position on the play-along timeline, in cursor order — collected once when
// a run starts so the clock reads its beats off this model, not the live cursor.
// Every position appears, rests and the silent hand included (empty `play`), so a
// step's index stays lock-step with the visual cursor the surface still advances.
export type KeepUpStep = {
    // The pitches to catch here, narrowed to the practised hand, each with its
    // written length in quarter notes so the guide can sound it for that long.
    // Empty at a rest or the other hand's turn (an unscored position).
    play: { pitch: number; quarters: number }[];
    // The other hand's pitches here — the ones you are NOT catching this run. Empty for a
    // both-hands run (nothing is left over). A duet sounds these on the clock so the app
    // plays the accompanying hand while you play yours; a plain run ignores them.
    accompany: { pitch: number; quarters: number }[];
    // Every note's written length here in quarter notes, both hands and rests —
    // the beat's duration comes from the shortest, so the clock advances in step
    // with the notation regardless of which hand is being practised.
    lengths: number[];
};

export type KeepUpState = {
    // The pitches expected at the currently-open step, and which of them have
    // been struck so far. Empty between steps, so a strike landing in the gap
    // (or after the run ends) scores nothing.
    expected: number[];
    struck: number[];
    // Each closed scoreable step in order: true = every expected pitch was
    // struck before the cursor moved on. Unscored positions (rests, the other
    // hand's turn) never appear — closing an empty step records nothing.
    hits: boolean[];
};

export function startKeepUp(): KeepUpState {
    return { expected: [], struck: [], hits: [] };
}

// The clock reaches a new step: what must be caught before it closes. The
// surface collects the pitches from the cursor (already narrowed to the
// practised hand), so the reducer is hand-agnostic like the matcher.
export function openKeepUpStep(state: KeepUpState, pitches: number[]): KeepUpState {
    return { ...state, expected: [...pitches], struck: [] };
}

// A played note lands while a step is open. `expected` says whether it counted
// toward the step at all; `caught` turns true on the strike that completes the
// set — the surface's cue to turn the step green before the clock closes it.
export function strikeKeepUp(
    state: KeepUpState,
    note: number,
): { state: KeepUpState; expected: boolean; caught: boolean } {
    if (!state.expected.includes(note)) {
        return { state, expected: false, caught: false };
    }
    const struck = state.struck.includes(note) ? state.struck : [...state.struck, note];
    const caught = state.expected.every((pitch) => struck.includes(pitch));
    return { state: { ...state, struck }, expected: true, caught };
}

// The clock moves on: resolve the open step as a hit or a miss. `hit` is null
// for an unscored position (nothing was expected), which records nothing — the
// guard that keeps a hands-separate run from counting the other hand's turns.
export function closeKeepUpStep(state: KeepUpState): {
    state: KeepUpState;
    hit: boolean | null;
} {
    if (state.expected.length === 0) {
        return { state, hit: null };
    }
    const hit = state.expected.every((pitch) => state.struck.includes(pitch));
    return {
        state: { expected: [], struck: [], hits: [...state.hits, hit] },
        hit,
    };
}

// How the run stands: beats caught in time out of beats closed so far.
export function keepUpProgress(state: KeepUpState): { inTime: number; done: number } {
    return {
        inTime: state.hits.filter(Boolean).length,
        done: state.hits.length,
    };
}
