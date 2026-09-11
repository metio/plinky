// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { median } from "./stats";

// Timing windows around each note's target time, in milliseconds. A hit within
// PERFECT_MS counts as perfect; within GOOD_MS as good; otherwise off.
export const PERFECT_MS = 60;
export const GOOD_MS = 140;

// Window leniency by input. A real MIDI instrument is held to the tight windows
// above; the on-screen and computer-keyboard fallbacks send a fixed velocity and
// can't tap a precise rhythm, so their windows are widened rather than flooring a
// touch player — the primary mobile input — at zero.
export const PRECISE_TOLERANCE = 1;
export const LENIENT_TOLERANCE = 2;

export type Rating = "perfect" | "good" | "off";

export type Hit = {
    index: number;
    // Signed offset from the target: negative is early, positive is late.
    deltaMs: number;
    rating: Rating;
};

export type RhythmSummary = {
    perfect: number;
    good: number;
    off: number;
    total: number;
    averageAbsMs: number;
};

// `slackMs` widens the windows for a note whose moment the notation does not actually
// fix. An ornament is the case that needs it: the score says to play the little note
// before the big one, but not by how much, and the two standard readings — crushed just
// before the beat, or leaning on it and taking time from the note it decorates — are a
// good part of a beat apart. Both are right. Grading either against the other's moment
// marks a player down for a choice the notation left to them, so the window is widened
// to span the pair rather than picking a side.
//
// Zero everywhere else, which leaves every other note scored exactly as before.
export function rate(absDeltaMs: number, tolerance = PRECISE_TOLERANCE, slackMs = 0): Rating {
    const slack = Math.max(0, slackMs);
    if (absDeltaMs <= PERFECT_MS * tolerance + slack) {
        return "perfect";
    }
    if (absDeltaMs <= GOOD_MS * tolerance + slack) {
        return "good";
    }
    return "off";
}

export function makeHit(
    index: number,
    deltaMs: number,
    tolerance = PRECISE_TOLERANCE,
    slackMs = 0,
): Hit {
    return { index, deltaMs, rating: rate(Math.abs(deltaMs), tolerance, slackMs) };
}

// One played note relative to the run's first note: its notated onset (the ideal)
// and when it was actually played, both in milliseconds. `skipped` marks a position the
// forgiving advance moved past without it being struck: its `playedMs` is the next note's
// moment, so it is no evidence of pace and has no timing of its own.
export type Onset = { targetMs: number; playedMs: number; skipped?: boolean };

// The gap leading into a note, as notated and as played, in milliseconds.
export type Gap = { notated: number; played: number };

// The gap into each note from the last note that was struck. A skipped position has no
// moment of its own, so it has no gap and is passed over: the note after it is measured
// from the note before it. The first note struck has nothing to measure from. Both read
// null. Every timing reader measures through this, so none can time a note from a skip.
export function struckGaps(onsets: readonly Onset[]): (Gap | null)[] {
    let last: Onset | undefined;
    return onsets.map((onset) => {
        if (onset.skipped) {
            return null;
        }
        const before = last;
        last = onset;
        return before === undefined
            ? null
            : {
                  notated: onset.targetMs - before.targetMs,
                  played: onset.playedMs - before.playedMs,
              };
    });
}

// The gap between the last two notes struck, walked back from the end, for a reader that
// runs on every cleared note and must not rescan the whole run each time.
export function lastStruckGap(onsets: readonly Onset[]): Gap | null {
    let later: Onset | undefined;
    for (let index = onsets.length - 1; index >= 0; index--) {
        const onset = onsets[index]!;
        if (onset.skipped) {
            continue;
        }
        if (later === undefined) {
            later = onset;
            continue;
        }
        return {
            notated: later.targetMs - onset.targetMs,
            played: later.playedMs - onset.playedMs,
        };
    }
    return null;
}

// The player's pace relative to the score: the median of each gap's played/notated
// ratio. 1.0 means they matched the notated tempo, 2.0 that they played at half
// speed. Practice is self-paced, so timing is judged against this personal pace
// rather than the absolute notated clock — otherwise a steady run at any tempo but
// the preset one drifts ever further from target and scores zero. The median
// shrugs off a few wild gaps, and a non-positive result falls back to 1.0.
export function tempoScale(onsets: readonly Onset[]): number {
    const ratios = struckGaps(onsets).flatMap((gap) =>
        gap && gap.notated > 0 ? [gap.played / gap.notated] : [],
    );
    const scale = median(ratios);
    return scale > 0 ? scale : 1;
}

// Each note's timing deviation in ms once the player's overall pace is removed: how
// far the gap from the previous note ran from where their own steady tempo predicts
// it. The first note anchors the run (zero), as do simultaneous onsets — a chord
// matched key by key carries no rhythm of its own. A steady run reads as on-time at
// any tempo; only a gap that breaks the player's established pace counts as off.
//
// A skipped onset was never struck, so it has no timing at all and reads null — a zero
// would be a note dead on its beat, which every average and every plot would count as one.
// The note after it is timed from the last note that was struck (see struckGaps).
export function timingDeltas(onsets: readonly Onset[]): (number | null)[] {
    const scale = tempoScale(onsets);
    return struckGaps(onsets).map((gap, index) => {
        if (onsets[index]?.skipped) {
            return null;
        }
        return gap && gap.notated > 0 ? gap.played - gap.notated * scale : 0;
    });
}

export function summarize(hits: Hit[]): RhythmSummary {
    const counts = { perfect: 0, good: 0, off: 0 };
    let sumAbs = 0;
    for (const hit of hits) {
        counts[hit.rating] += 1;
        sumAbs += Math.abs(hit.deltaMs);
    }
    return {
        ...counts,
        total: hits.length,
        averageAbsMs: hits.length > 0 ? sumAbs / hits.length : 0,
    };
}
