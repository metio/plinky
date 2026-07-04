// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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

export function rate(absDeltaMs: number, tolerance = PRECISE_TOLERANCE): Rating {
    if (absDeltaMs <= PERFECT_MS * tolerance) {
        return "perfect";
    }
    if (absDeltaMs <= GOOD_MS * tolerance) {
        return "good";
    }
    return "off";
}

export function makeHit(index: number, deltaMs: number, tolerance = PRECISE_TOLERANCE): Hit {
    return { index, deltaMs, rating: rate(Math.abs(deltaMs), tolerance) };
}

// One played note relative to the run's first note: its notated onset (the ideal)
// and when it was actually played, both in milliseconds.
export type Onset = { targetMs: number; playedMs: number };

function median(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const high = sorted[mid] ?? 0;
    if (sorted.length % 2 !== 0) {
        return high;
    }
    return ((sorted[mid - 1] ?? high) + high) / 2;
}

// The player's pace relative to the score: the median of each gap's played/notated
// ratio. 1.0 means they matched the notated tempo, 2.0 that they played at half
// speed. Practice is self-paced, so timing is judged against this personal pace
// rather than the absolute notated clock — otherwise a steady run at any tempo but
// the preset one drifts ever further from target and scores zero. The median
// shrugs off a few wild gaps, and a non-positive result falls back to 1.0.
export function tempoScale(onsets: Onset[]): number {
    const ratios: number[] = [];
    for (let index = 1; index < onsets.length; index++) {
        const dt = onsets[index]!.targetMs - onsets[index - 1]!.targetMs;
        const dp = onsets[index]!.playedMs - onsets[index - 1]!.playedMs;
        if (dt > 0) {
            ratios.push(dp / dt);
        }
    }
    const scale = median(ratios);
    return scale > 0 ? scale : 1;
}

// Each note's timing deviation in ms once the player's overall pace is removed: how
// far the gap from the previous note ran from where their own steady tempo predicts
// it. The first note anchors the run (zero), as do simultaneous onsets — a chord
// matched key by key carries no rhythm of its own. A steady run reads as on-time at
// any tempo; only a gap that breaks the player's established pace counts as off.
export function timingDeltas(onsets: Onset[]): number[] {
    const scale = tempoScale(onsets);
    return onsets.map((onset, index) => {
        if (index === 0) {
            return 0;
        }
        const prev = onsets[index - 1]!;
        const dt = onset.targetMs - prev.targetMs;
        if (dt <= 0) {
            return 0;
        }
        return onset.playedMs - prev.playedMs - dt * scale;
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
