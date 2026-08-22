// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Scores a set of taps against the moments a rhythm asked for.
//
// The play surface never has to do this: there, a note identifies itself by its pitch, so
// which written note a keypress was aiming at is never in question. A tap has no pitch.
// All it carries is when it happened, and the same tap can plausibly be a late one note
// or an early the next — so the matching is the whole problem, and it is separate from
// the rating, which `core/rhythm.ts` already does.
//
// Taps are matched nearest-first rather than in order. Reading in order sounds right and
// is wrong: one missed note early on shunts every later tap onto the wrong target and
// turns a single mistake into a run of them, which is exactly the report a player would
// not recognise as their own playing.

import { GOOD_MS, type Hit, makeHit, type Rating, summarize } from "./rhythm";

export type RhythmVerdict = {
    // One entry per written note, in written order. `null` where nothing was tapped
    // near enough to count — a note that was missed.
    hits: (Hit | null)[];
    // Taps that landed near no note at all: the extra ones.
    extra: number;
    perfect: number;
    good: number;
    off: number;
    missed: number;
    // Written notes that were actually tapped, over the number written.
    total: number;
    averageAbsMs: number;
};

// How far from a written note a tap may land and still be counted as an attempt at it.
// Wider than the "off" rating window, because a tap that far out is still recognisably
// aimed at that note and should be reported as badly-timed rather than as a miss plus a
// stray. Beyond this it is genuinely a different event.
export const CLAIM_MS = GOOD_MS * 3;

export function gradeRhythm(
    expected: readonly number[],
    taps: readonly number[],
    tolerance?: number,
): RhythmVerdict {
    // Every plausible pairing, nearest first — so the closest tap to any note claims it,
    // whatever order the two lists are in.
    const pairs: { note: number; tap: number; distance: number }[] = [];
    expected.forEach((target, note) => {
        taps.forEach((at, tap) => {
            const distance = Math.abs(at - target);
            if (distance <= CLAIM_MS) {
                pairs.push({ note, tap, distance });
            }
        });
    });
    pairs.sort((one, other) => one.distance - other.distance || one.note - other.note);

    const hits: (Hit | null)[] = expected.map(() => null);
    const claimed = new Set<number>();
    for (const pair of pairs) {
        if (hits[pair.note] !== null || claimed.has(pair.tap)) {
            continue;
        }
        claimed.add(pair.tap);
        hits[pair.note] = makeHit(
            pair.note,
            (taps[pair.tap] as number) - (expected[pair.note] as number),
            tolerance,
        );
    }

    const landed = hits.filter((hit): hit is Hit => hit !== null);
    const summary = summarize(landed);
    return {
        hits,
        extra: taps.length - claimed.size,
        perfect: summary.perfect,
        good: summary.good,
        off: summary.off,
        missed: expected.length - landed.length,
        total: expected.length,
        averageAbsMs: summary.averageAbsMs,
    };
}

// A single word for how the whole attempt went, for the line under the result. Anything
// missed or spare outranks the timing: a rhythm read wrongly is a different mistake from
// one read right and played loosely, and saying "good" to the first would be a lie.
export function rhythmVerdictRating(verdict: RhythmVerdict): Rating {
    if (verdict.missed > 0 || verdict.extra > 0 || verdict.off > 0) {
        return "off";
    }
    return verdict.good > 0 ? "good" : "perfect";
}
