// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GRAND_STAFF, type ScoreParts } from "./parts";

// The note-by-note practice matcher: a pure reducer over a pre-collected step
// model. The rendering surface extracts the steps from the engraved score and
// mirrors the reducer's position onto the visual cursor; everything about what
// counts as progress — chords assembled pitch by pitch, wrong notes tolerated
// while the player hunts, the forgiving skip to the next position — lives here,
// testable without a score renderer.

// Which hand's staff to match: both together, or one alone for hands-separate
// practice.
export type Hand = "both" | "right" | "left";

export function staffFor(hand: Exclude<Hand, "both">, parts: ScoreParts): number {
    return hand === "right" ? parts.right : parts.left;
}

// Whether a note engraved on `staffId` belongs to the hand being practised. A
// both-hands run owns every note; a single-hand run owns only its own staff, so a
// note on the other staff — or one the engraving gives no resolvable staff at all —
// is the other hand's, to leave out or accompany, never to demand of the player.
// Every surface that narrows to a hand (the self-paced matcher, keep-up's beat
// split, the score colouring) shares this, so a hand choice means the same in each.
export function isPracticedHand(
    staffId: number | undefined,
    hand: Hand,
    // Which staves the practised instrument occupies. A score with a singer or a second
    // instrument on top numbers the piano's staves 1 and 2, not 0 and 1 — and even a
    // both-hands run must leave those other staves alone rather than demand them.
    parts: ScoreParts = GRAND_STAFF,
): boolean {
    // An accompaniment staff is never the player's, in either mode: a both-hands run of
    // an art song must not demand the sung line.
    if (staffId !== undefined && parts.other.includes(staffId)) {
        return false;
    }
    // A note the engraving gives no resolvable staff still belongs to a both-hands run,
    // which is what a generated drill relies on.
    return hand === "both" || staffId === staffFor(hand, parts);
}

// One playable position for the chosen hand, in play order. Hand narrowing
// happens when the surface collects the steps, so the reducer is hand-agnostic.
export type MatchStep = {
    // The MIDI pitches that sound here — a chord gives several.
    pitches: number[];
    // The staff each pitch sits on, index-aligned with `pitches` (0 = treble/right,
    // 1 = bass/left). A chord spanning the grand staff has both here, one per note,
    // which is what lets a reader of this model say WHICH hand plays which key rather
    // than only that both are involved. In the real catalogue 41% of positions carry
    // notes on both staves, so the distinction is the common case, not an edge.
    pitchStaves: number[];
    // The distinct staves the position sits on, derived from pitchStaves and kept
    // because most readers only ask "which hands are involved here".
    staves: number[];
    // The notated onset in whole notes from the top of the piece — where the position is
    // PRINTED. Repeats revisit it, so several steps of one run can share a value; use it
    // to find a place in the score, never to say when a note is due.
    whole: number;
    // Where the position falls in TIME: milliseconds from the start of the performance,
    // with the repeats played out and at the tempi the score writes. Rises across the
    // whole run even where `whole` rewinds. The caller scales it by the ratio between
    // the practice dial and the score's opening tempo, so a tempo change or a fermata
    // keeps its proportion at any speed.
    elapsedMs: number;
    // The 0-based bar the position sits in, for a focus view.
    bar: number;
    // Whether clearing this step moves the visual cursor on. False for an ornament: a
    // grace note and the note it decorates are printed in one place, so the cursor stays
    // there while the player works through them, and only the last step at a position
    // moves it along.
    advancesCursor: boolean;
    // How much to widen this step's timing windows, in milliseconds at the written tempi.
    // Non-zero only around an ornament, whose moment the notation does not fix: it may be
    // crushed in before the beat or leaned on and given time from the note it decorates,
    // and a player choosing either should not be marked down for it.
    slackMs: number;
    // The longest written length here, in quarter notes — how long the key is
    // meant to keep ringing. Collected with the position so the hold-duration
    // indicator reads it off the step model, never the live cursor. Zero when
    // the score marks no length.
    holdQuarters: number;
    // How long the position is meant to keep RINGING, in milliseconds at the written
    // tempi — its longest note at the tempo in force here, extended by a fermata. This
    // is the chord's own length, what the hold indicator draws; `expected` carries what
    // each individual key is asked for. Scaled by the same dial ratio as `elapsedMs`.
    holdMs: number;
    // What the score asks for at each pitch, index-aligned with `pitches`: the standing
    // dynamic with that note's own accent applied (null when the score marks none), and
    // how long it is meant to sound in milliseconds at the written tempi — its own
    // written length narrowed by its own articulation.
    //
    // Per pitch because a chord is not one note. A held bass under a staccato treble, an
    // accent on the top of the chord and not the rest: reading the whole position off
    // its longest note grades the player against marks the score never put there, and
    // silently ignores the ones it did.
    //
    // Absent on a step model lifted for something other than a graded run — the duet's
    // other hand, a fingering walk — which needs the pitches and nothing about how they
    // are meant to sound.
    expected?: { velocity: number | null; holdMs: number }[];
};

// A pitch of the current position that has sounded, and when. The time comes from the
// caller — this module reads no clock — and is kept because a chord's notes do not all
// land together: on hands-together music the two hands arrive at measurably different
// moments, and that difference is the only evidence of which hand is trailing.
export type Arrival = { note: number; at: number; velocity: number };

export type MatcherState = {
    steps: MatchStep[];
    // The position being played, and the pitches of it already sounded — a
    // chord is cleared pitch by pitch in any order.
    index: number;
    hit: Arrival[];
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
    // When each of `playedPitches` landed, index-aligned. A position clears on its LAST
    // pitch, so a single time for the whole position says nothing about the hand that
    // arrived first — which is exactly what a per-hand verdict needs.
    arrivals: number[];
    // How hard each of `playedPitches` was struck, index-aligned. A chord's notes are not
    // all played equally, and a score that accents one of them asks for exactly that, so
    // one velocity for the position would hide both the instruction and the performance.
    velocities: number[];
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

// The next few positions to play, from the current one onward — what a look-ahead
// view (the notes highway) shows above the keys. Each carries its whole-run index
// so a view can key blocks stably as the run advances, and the staves it sits on
// so a two-hand piece can colour the hands apart. Fewer than `count` near the end.
export type UpcomingStep = {
    index: number;
    pitches: number[];
    // Index-aligned with `pitches`, so a look-ahead can colour or light each note by
    // the hand that plays it rather than by the hands the position involves.
    pitchStaves: number[];
    staves: number[];
};

export function upcomingSteps(state: MatcherState, count: number): UpcomingStep[] {
    return state.steps
        .slice(state.index, state.index + count)
        .map((step, offset) => ({
            index: state.index + offset,
            pitches: step.pitches,
            pitchStaves: step.pitchStaves,
            staves: step.staves,
        }));
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

function clear(
    state: MatcherState,
    playedPitches: number[],
    events: MatchEvent[],
    at: number,
): MatcherState {
    const step = state.steps[state.index];
    if (!step) {
        return state;
    }
    events.push({
        kind: "cleared",
        step,
        ordinal: state.index,
        playedPitches,
        // A pitch with no recorded arrival is one the forgiving advance credited without
        // it ever being played; it takes the clearing moment, which is the only time
        // anything is known to have happened.
        arrivals: playedPitches.map(
            (pitch) => state.hit.find((arrival) => arrival.note === pitch)?.at ?? at,
        ),
        // A pitch the forgiving advance credited without it ever being played reports no
        // strike at all, which the expressive reading skips rather than scoring as soft.
        velocities: playedPitches.map(
            (pitch) => state.hit.find((arrival) => arrival.note === pitch)?.velocity ?? 0,
        ),
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
    // When the note landed, on the caller's own clock. This module reads no clock.
    at: number,
    forgiving = false,
    // How hard it was struck, 0..127, or 0 from an input that cannot say.
    velocity = 0,
): { state: MatcherState; events: MatchEvent[] } {
    if (state.complete) {
        return { state, events: [] };
    }
    const events: MatchEvent[] = [];
    const expected = expectedPitches(state);

    if (expected.includes(note)) {
        // A pitch struck twice keeps its FIRST arrival: the hand got there then, and a
        // re-strike while the rest of the chord is still coming does not undo that.
        const hit = state.hit.some((arrival) => arrival.note === note)
            ? state.hit
            : [...state.hit, { note, at, velocity }];
        if (expected.every((pitch) => hit.some((arrival) => arrival.note === pitch))) {
            return { state: clear({ ...state, hit }, expected, events, at), events };
        }
        events.push({ kind: "hit", note });
        return { state: { ...state, hit }, events };
    }

    if (forgiving && state.steps[state.index + 1]?.pitches.includes(note)) {
        let next = clear(state, state.hit.map((arrival) => arrival.note), events, at);
        if (!next.complete) {
            const nextExpected = expectedPitches(next);
            if (nextExpected.includes(note)) {
                if (nextExpected.every((pitch) => pitch === note)) {
                    next = clear(next, nextExpected, events, at);
                } else {
                    events.push({ kind: "hit", note });
                    next = { ...next, hit: [{ note, at, velocity }] };
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
