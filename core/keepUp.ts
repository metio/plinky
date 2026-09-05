// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The keep-up reducer: a tempo-locked run where the clock, not the player, advances the
// cursor. Each beat opens with the pitches the practised hand owes it; a strike that lands
// while the beat is open counts toward it, and the beat is a hit once every pitch is in.
//
// A beat is not a knife edge. A player who is with the music strikes a hair before or
// after the beat — that is what being in time sounds like — and a strike a few tens of
// milliseconds early lands while the PREVIOUS beat is still open, one a few tens late
// after the beat has closed. So a beat accepts the next beat's pitches for a moment before
// it ends, and stays open to strikes for a moment after; what it was owed is settled only
// once that moment has passed.

// The two halves of the window, roughly the "good" rhythm tolerance the self-paced grade
// allows. Symmetric on purpose: rushing and dragging are the same size of fault.
export const KEEP_UP_EARLY_MS = 100;
export const KEEP_UP_LATE_MS = 100;

export type KeepUpStep = {
    whole: number;
    // What the practised hand strikes here, and what the other hand plays for it.
    play: { pitch: number; quarters: number }[];
    accompany: { pitch: number; quarters: number }[];
    // Every notated length at the position, for the clock to dwell the shortest of.
    lengths: number[];
    bpm: number;
    stretch: number;
    advancesCursor: boolean;
};

// A beat that has closed but whose late window has not passed: strikes still count.
type ClosingBeat = { expected: number[]; struck: number[]; until: number };

export type KeepUpState = {
    // The open beat: what it owes, what has landed.
    expected: number[];
    struck: number[];
    // When the open beat ends, and what the beat after it owes — an early strike is told
    // from a wrong one by these two.
    closesAt: number;
    next: number[];
    // The next beat's pitches struck ahead of it, credited when it opens.
    early: number[];
    closing: ClosingBeat | null;
    // One verdict per beat the practised hand owed something at, in order.
    hits: boolean[];
};

export function startKeepUp(): KeepUpState {
    return {
        expected: [],
        struck: [],
        closesAt: Number.POSITIVE_INFINITY,
        next: [],
        early: [],
        closing: null,
        hits: [],
    };
}

export type BeatTiming = {
    // When the beat opens and how long it dwells, on the strike clock.
    at: number;
    dwellMs: number;
    // The beat after this one, so a strike for it a hair early is not a wrong note.
    next: readonly number[];
};

// A beat opens with what the hand owes it, already crediting any of its pitches struck
// early in the beat before.
export function openKeepUpStep(
    state: KeepUpState,
    pitches: readonly number[],
    timing?: BeatTiming,
): KeepUpState {
    return {
        ...state,
        expected: [...pitches],
        struck: state.early.filter((note) => pitches.includes(note)),
        closesAt: timing ? timing.at + timing.dwellMs : Number.POSITIVE_INFINITY,
        next: timing ? [...timing.next] : [],
        early: [],
    };
}

function complete(expected: readonly number[], struck: readonly number[]): boolean {
    return expected.every((pitch) => struck.includes(pitch));
}

// A strike: for the beat still closing if it is owed there, else for the open beat, else
// for the next beat if it is nearly here. `expected` says the strike was owed somewhere;
// `caught` that it completed the open beat, so the step can turn green early.
export function strikeKeepUp(
    state: KeepUpState,
    note: number,
    at = 0,
): { state: KeepUpState; expected: boolean; caught: boolean } {
    const { closing } = state;
    if (
        closing !== null &&
        at <= closing.until &&
        closing.expected.includes(note) &&
        !closing.struck.includes(note)
    ) {
        return {
            state: { ...state, closing: { ...closing, struck: [...closing.struck, note] } },
            expected: true,
            caught: false,
        };
    }
    if (state.expected.includes(note)) {
        const struck = state.struck.includes(note) ? state.struck : [...state.struck, note];
        return {
            state: { ...state, struck },
            expected: true,
            caught: complete(state.expected, struck),
        };
    }
    if (state.next.includes(note) && state.closesAt - at <= KEEP_UP_EARLY_MS) {
        const early = state.early.includes(note) ? state.early : [...state.early, note];
        return { state: { ...state, early }, expected: true, caught: false };
    }
    return { state, expected: false, caught: false };
}

// The beat ends: whatever was still closing before it is settled, and this beat begins
// its own late window. A beat that owed nothing — the other hand's turn — settles to no
// verdict at all. `settled` is the verdict of the beat BEFORE this one, when its window
// had not yet been settled on its own.
export function closeKeepUpStep(
    state: KeepUpState,
    at = 0,
): { state: KeepUpState; settled: boolean | null } {
    const { state: after, hit } = settleKeepUp(state);
    const closing: ClosingBeat | null =
        after.expected.length === 0
            ? null
            : { expected: after.expected, struck: after.struck, until: at + KEEP_UP_LATE_MS };
    return {
        state: { ...after, expected: [], struck: [], closesAt: Number.POSITIVE_INFINITY, closing },
        settled: hit,
    };
}

// The late window of the last closed beat has passed: its verdict is final.
export function settleKeepUp(state: KeepUpState): { state: KeepUpState; hit: boolean | null } {
    const { closing } = state;
    if (closing === null) {
        return { state, hit: null };
    }
    const hit = complete(closing.expected, closing.struck);
    return { state: { ...state, closing: null, hits: [...state.hits, hit] }, hit };
}

export function keepUpProgress(state: KeepUpState): { inTime: number; done: number } {
    return {
        inTime: state.hits.filter(Boolean).length,
        done: state.hits.length,
    };
}
