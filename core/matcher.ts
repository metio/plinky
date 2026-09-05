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

// A hand that actually plays — "both" is a practice mode, not a hand.
export type Hand2 = Exclude<Hand, "both">;

// Which hand a staff belongs to, given the score's parts. An accompaniment staff has no
// hand of its own; it reads as the right, which is where a single-staff piece is played.
export function handOfStaff(staff: number | undefined, parts: ScoreParts): Hand2 {
    return staff === parts.left ? "left" : "right";
}

export function staffFor(hand: Hand2, parts: ScoreParts): number {
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
// Whether the music has just been sent back to an earlier place on the page.
//
// A written repeat is the only thing that does this: `whole` is where a position is
// PRINTED, and it rises with the run except where the barline sends the reader back to
// play the same bars again. That second pass finds those bars already coloured from the
// first, so the trail stops meaning "how far you have got" — the same thing a section loop
// does, which is already handled, and which nothing handled here.
//
// Compared with a tolerance because `whole` is accumulated in fractions of a whole note,
// and two positions printed at the same moment must never read as a jump: an ornament
// carries the onset of the note it decorates, so it shares a value rather than preceding it.
const SAME_PLACE = 1e-6;

// Takes the one field it reads rather than a whole step, because both surfaces that walk
// the music have to ask this and they walk different models: a run reads MatchStep, Listen
// reads ListenStep, and the repeat sends each of them back over the same printed bars.
export function jumpsBack(from: { whole: number }, to: { whole: number }): boolean {
    return to.whole < from.whole - SAME_PLACE;
}

export type MatchStep = {
    // The MIDI pitches that sound here — a chord gives several.
    pitches: number[];
    // Which hand plays each pitch, index-aligned with `pitches`. Derived where the
    // score's part layout is known, so it stays right on music whose piano is not the
    // first instrument — on an art song the piano's staves are 1 and 2, and reading
    // "staff 1 is the left hand" off the raw index inverts the hands.
    pitchHands: Hand2[];
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
    // The score asks for the sustain pedal here. Under it the damper holds the sound, so
    // a pianist releases keys early and on purpose; how long a key was down says nothing
    // about the length being played, and the expressive reading leaves it alone.
    pedalled: boolean;
    // The longest written length here, in quarter notes — how long the key is
    // meant to keep ringing. Collected with the position so the hold-duration
    // indicator reads it off the step model, never the live cursor. Zero when
    // the score marks no length.
    holdQuarters: number;
    // How long the position is meant to keep RINGING, in milliseconds at the written
    // tempi — its longest note at the tempo in force here, extended by a fermata. This
    // is the chord's own length; `expected` carries what each individual key is asked
    // for, including the length its own hold indicator draws. Scaled by the same dial
    // ratio as `elapsedMs`.
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
    // `writtenHoldMs` is the same length before articulation narrows it: what the key
    // is written to last, which is what its hold indicator draws. Two hands rarely hold
    // for the same time — a whole note under a quaver is the ordinary case — so drawing
    // every key at the position's own length drains the quaver's fill at the whole
    // note's pace, long after that hand has moved on.
    //
    // Absent on a step model lifted for something other than a graded run — the duet's
    // other hand, a fingering walk — which needs the pitches and nothing about how they
    // are meant to sound.
    expected?: { velocity: number | null; holdMs: number; writtenHoldMs: number }[];
    // What fraction of its written loudness this position is actually played at, for where
    // it sits in its bar and its phrase — a downbeat at full weight, an offbeat lighter, a
    // slurred arch settling as it resolves.
    //
    // Kept beside `expected` rather than folded into it, because the two answer different
    // questions and only one of them is a fact about the page. `expected[].velocity` is what
    // the score asks for, and it is what a run is graded against; a player is never marked
    // down for weighting a bar the way a metronome would not. This is how it is played, and
    // only something turning the score into a sounding performance reads it.
    //
    // Absent where nothing is known — a step model collected without the score's marks
    // weights nothing, and reads as 1, so a caller that only wanted the pitches gets the
    // same notes it always did.
    interpretation?: number;
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
// How near two printed onsets must be to count as the same place. A 1024th of a whole
// note is finer than any notated value and coarser than the accumulated error.
export const WHOLE_EPSILON = 1 / 1024;

// Which position a printed onset means, when the same onset is printed more than once.
//
// A repeat prints two passes over one set of bars, so `whole` alone does not identify a
// position: on the second pass through bars printed at 0 and 1, the onsets asked for are 0
// and 1 again. Taking the first match walks the lookahead back to the pass that has already
// gone — the highway then draws the wrong notes, spaced from the wrong moment, for as long
// as the repeat lasts.
//
// So the search runs FORWARD from wherever it last landed. `from` is that place and
// `fromWhole` the onset wanted; when the onset has gone backwards the barline has sent the
// music back, and the answer must be past the current position rather than at it. A caller
// with no history (a fresh seek, or a jump the walk did not make) passes -1 and gets the
// first match, which is what an unanchored question deserves.
export function previewIndex(
    steps: readonly { whole: number }[],
    fromWhole: number,
    from = -1,
    lastWhole = Number.NEGATIVE_INFINITY,
): number {
    const at = (index: number) => steps[index]!.whole >= fromWhole - WHOLE_EPSILON;
    if (from >= 0) {
        // Past the current position when the music has been sent back, at it otherwise.
        const start = fromWhole < lastWhole - WHOLE_EPSILON ? from + 1 : from;
        for (let index = Math.max(0, start); index < steps.length; index++) {
            if (at(index)) {
                return index;
            }
        }
    }
    // Nothing ahead: either there is no history, or the ask is behind everything left —
    // a seek rather than a step, and the whole piece is the right place to look.
    for (let index = 0; index < steps.length; index++) {
        if (at(index)) {
            return index;
        }
    }
    return -1;
}

export type UpcomingStep = {
    index: number;
    pitches: number[];
    // Index-aligned with `pitches`, so a look-ahead can colour or light each note by
    // the hand that plays it rather than by the hands the position involves.
    pitchStaves: number[];
    // Index-aligned with `pitches`: which hand plays each note, worked out from the
    // score's parts rather than from the staff index alone.
    pitchHands: Hand2[];
    staves: number[];
    // When the position sounds, on the step model's own clock. A look-ahead drawn from
    // this spaces its notes by the music rather than by how many of them there are: a
    // count of positions says a minim and a semiquaver are the same distance apart,
    // which is the one thing a falling-note picture exists to show.
    atMs: number;
    // How long each pitch is WRITTEN to last, index-aligned with `pitches`.
    //
    // Per pitch because a whole note under a quaver is the ordinary case, and the
    // position's own length is its longest note — reading the picture off that draws the
    // quaver as long as the whole note beneath it.
    //
    // Written rather than sounded, so it agrees with the hold indicator the key itself
    // draws: articulation shortens what you do with a note, not what is printed, and a
    // staccato crotchet drawn as a semiquaver would teach the touch as the value.
    //
    // Falls back to the position's own length on a step model lifted without `expected`
    // — the duet's other hand, a fingering walk — which carries no per-key detail.
    pitchHoldsMs: number[];
};

export function upcomingSteps(state: MatcherState, count: number): UpcomingStep[] {
    return state.steps.slice(state.index, state.index + count).map((step, offset) => ({
        index: state.index + offset,
        pitches: step.pitches,
        pitchStaves: step.pitchStaves,
        pitchHands: step.pitchHands,
        staves: step.staves,
        atMs: step.elapsedMs,
        pitchHoldsMs: step.pitches.map(
            (_, note) => step.expected?.[note]?.writtenHoldMs ?? step.holdMs,
        ),
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
        let next = clear(
            state,
            state.hit.map((arrival) => arrival.note),
            events,
            at,
        );
        if (!next.complete) {
            const nextExpected = expectedPitches(next);
            if (nextExpected.includes(note)) {
                if (nextExpected.every((pitch) => pitch === note)) {
                    // The note that completes the next position was struck, here and now:
                    // its arrival goes on the record before the position clears, or the
                    // cleared event reports it at velocity 0 — the value reserved for a
                    // pitch nobody played.
                    next = clear(
                        { ...next, hit: [{ note, at, velocity }] },
                        nextExpected,
                        events,
                        at,
                    );
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

// The two readings a finished position gives up, both pure functions of the step and the
// pitches actually struck. They lived in the hook that calls them, where testing either one
// meant standing up an engraver and a React tree; here a test is a step and two arrays.

// What the score asked of each pitch the player actually struck, index-aligned with the
// event's `playedPitches` rather than with the step's own order — the two differ, because
// a chord is cleared in whatever order the hands find it.
//
// A pitch with no expectation of its own (nothing matched it in the step, which forgiving
// mode can produce) reports none, and the expressive reading skips it rather than scoring
// it against a neighbour's mark.
export function askedFor(
    event: { step: MatchStep; playedPitches: number[] },
    ratio: number,
): {
    expectedVelocities: (number | null)[];
    expectedHoldsMs: number[];
    writtenHoldsMs: number[];
} {
    const expectedVelocities: (number | null)[] = [];
    const expectedHoldsMs: number[] = [];
    const writtenHoldsMs: number[] = [];
    for (const pitch of event.playedPitches) {
        const asked = event.step.expected?.[event.step.pitches.indexOf(pitch)];
        expectedVelocities.push(asked?.velocity ?? null);
        expectedHoldsMs.push(asked ? asked.holdMs / ratio : 0);
        writtenHoldsMs.push(asked ? asked.writtenHoldMs / ratio : 0);
    }
    return { expectedVelocities, expectedHoldsMs, writtenHoldsMs };
}

// When each hand got to this position: the EARLIEST arrival among the pitches that
// staff owns, because a hand's moment is when it struck rather than when it finished a
// rolled chord.
export function staffArrivals(event: {
    step: MatchStep;
    playedPitches: number[];
    arrivals: number[];
}): Record<number, number> {
    const times: Record<number, number> = {};
    for (const [index, pitch] of event.playedPitches.entries()) {
        const at = event.arrivals[index];
        if (at === undefined) {
            continue;
        }
        const note = event.step.pitches.indexOf(pitch);
        const staff = event.step.pitchStaves[note] ?? 0;
        times[staff] = Math.min(times[staff] ?? at, at);
    }
    return times;
}
