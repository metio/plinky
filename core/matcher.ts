// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The note-by-note practice matcher: a pure reducer over a pre-collected step
// model. The rendering surface extracts the steps from the engraved score and
// mirrors the reducer's position onto the visual cursor; everything about what
// counts as progress — chords assembled pitch by pitch, wrong notes tolerated
// while the player hunts, the forgiving skip to the next position — lives here,
// testable without a score renderer.

// Which hand's staff to match: both together, or one alone for hands-separate
// practice. On the grand staff our scores build, the treble (right) is staff 0
// and the bass (left) is staff 1.
export type Hand = "both" | "right" | "left";
export const STAFF_FOR: Record<Exclude<Hand, "both">, number> = { right: 0, left: 1 };

// One playable position for the chosen hand, in play order. Hand narrowing
// happens when the surface collects the steps, so the reducer is hand-agnostic.
export type MatchStep = {
    // The MIDI pitches that sound here — a chord gives several.
    pitches: number[];
    // The staves the position sits on (0 = treble/right, 1 = bass/left), so a
    // run can be scored per hand. Both when a chord spans the grand staff.
    staves: number[];
    // The notated onset in whole notes from the top of the piece — pure
    // notation; the caller scales it by the run's tempo into milliseconds.
    whole: number;
    // The 0-based bar the position sits in, for a focus view.
    bar: number;
};

export type MatcherState = {
    steps: MatchStep[];
    // The position being played, and the pitches of it already sounded — a
    // chord is cleared pitch by pitch in any order.
    index: number;
    hit: number[];
    wrong: number;
    // Wrong notes at the current position so far — zero at a clear means a
    // clean first try, the signal Flow and per-segment accuracy build from.
    sinceWrong: number;
    complete: boolean;
};

// A position was cleared: what was actually played there (forgiving mode may
// credit a partial chord), which step it was, and how many wrong notes came
// before — everything a grader needs except the run clock, which the caller
// owns.
export type ClearedEvent = {
    kind: "cleared";
    step: MatchStep;
    ordinal: number;
    playedPitches: number[];
    wrongBefore: number;
};

export type MatchEvent =
    | ClearedEvent
    // A pitch of the current chord landed; the position is not yet complete.
    | { kind: "hit"; note: number }
    | { kind: "wrong"; note: number };

export function startMatch(steps: MatchStep[]): MatcherState {
    return { steps, index: 0, hit: [], wrong: 0, sinceWrong: 0, complete: steps.length === 0 };
}

// The pitches expected at the current position — empty once complete.
export function expectedPitches(state: MatcherState): number[] {
    return state.steps[state.index]?.pitches ?? [];
}

// The 0-based bar the current position sits in; the final bar once complete.
export function currentBar(state: MatcherState): number {
    const step = state.steps[Math.min(state.index, state.steps.length - 1)];
    return step?.bar ?? 0;
}

// The pitch range across every step, padded by a whole tone each side so the
// on-screen keyboard frames the piece with a little room. Null for no steps.
export function stepRange(steps: MatchStep[]): { from: number; to: number } | null {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const step of steps) {
        for (const pitch of step.pitches) {
            lo = Math.min(lo, pitch);
            hi = Math.max(hi, pitch);
        }
    }
    return Number.isFinite(lo) ? { from: lo - 2, to: hi + 2 } : null;
}

function clear(state: MatcherState, playedPitches: number[], events: MatchEvent[]): MatcherState {
    const step = state.steps[state.index];
    if (!step) {
        return state;
    }
    events.push({
        kind: "cleared",
        step,
        ordinal: state.index,
        playedPitches,
        wrongBefore: state.sinceWrong,
    });
    const index = state.index + 1;
    return {
        ...state,
        index,
        hit: [],
        sinceWrong: 0,
        complete: index >= state.steps.length,
    };
}

// Feed one played note into the run. Wrong notes are tolerated so a learner can
// hunt for the right key; with `forgiving`, a note that starts the NEXT position
// treats the current one as done (crediting only what was played) and moves on,
// so a slip — especially the wrong hand in a two-hand piece — never freezes the
// run. Up to two cleared events can result: the forgiven position and, for a
// single-note next position, the one the note itself completes.
export function matchNote(
    state: MatcherState,
    note: number,
    forgiving = false,
): { state: MatcherState; events: MatchEvent[] } {
    if (state.complete) {
        return { state, events: [] };
    }
    const events: MatchEvent[] = [];
    const expected = expectedPitches(state);

    if (expected.includes(note)) {
        const hit = state.hit.includes(note) ? state.hit : [...state.hit, note];
        if (expected.every((pitch) => hit.includes(pitch))) {
            return { state: clear({ ...state, hit }, expected, events), events };
        }
        events.push({ kind: "hit", note });
        return { state: { ...state, hit }, events };
    }

    if (forgiving && state.steps[state.index + 1]?.pitches.includes(note)) {
        let next = clear(state, [...state.hit], events);
        if (!next.complete) {
            const nextExpected = expectedPitches(next);
            if (nextExpected.includes(note)) {
                if (nextExpected.every((pitch) => pitch === note)) {
                    next = clear(next, nextExpected, events);
                } else {
                    events.push({ kind: "hit", note });
                    next = { ...next, hit: [note] };
                }
            }
        }
        return { state: next, events };
    }

    events.push({ kind: "wrong", note });
    return {
        state: { ...state, wrong: state.wrong + 1, sinceWrong: state.sinceWrong + 1 },
        events,
    };
}
