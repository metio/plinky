// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { quartersMs } from "./elapsed";

// The shortest a playback step may last before advancing, so a very short note — or a
// zero-length glitch from the score — still moves on rather than stalling or firing the
// next strike in the same instant.
export const MIN_STEP_MS = 40;

// How long to wait before advancing the cursor to the next note, in ms at the given
// tempo: the SHORTEST note (or rest) starting at the current step, not the longest. That
// shortest note ends first, and its end is the next onset — where the cursor stops next.
// When both hands sound together the durations differ (a left-hand whole note over four
// right-hand quarters), and dwelling for the longest would freeze the cursor on the whole
// note while the quarters queue up behind it; the shortest is the true gap to the next
// note. Each note's own written length is honoured by the synth, which sustains it for its
// full duration, so the whole note keeps ringing under the quarters as they play on.
// Honouring the written length is also what keeps eighths and sixteenths quick — rounding
// the step UP to a whole beat, as a naive one-beat minimum does, flattens every run to a
// quarter-note plod. The floor here is a few milliseconds only, purely to keep the step
// positive; an empty step (nothing under the cursor) falls back to a single beat.
// The playable tempo band, what every tempo control offers and every stored tempo must
// fall in. Twenty beats a minute is slower than any piece is marked; four hundred is
// faster than a keyboard can be struck.
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 400;

export function listenStepMs(
    quarterLengths: readonly number[],
    tempo: number,
    stretch = 1,
): number {
    return Math.max(MIN_STEP_MS, writtenStepMs(quarterLengths, tempo, stretch));
}

// A step's length as written, with no floor under it: the shortest length at it, or a
// beat when nothing is listed.
export function writtenStepMs(
    quarterLengths: readonly number[],
    tempo: number,
    stretch = 1,
): number {
    const nextOnset = quarterLengths.length > 0 ? Math.min(...quarterLengths) : 1;
    return Math.max(0, nextOnset * quartersMs(1, tempo) * stretch);
}

// A step of a walk that may spell one cursor position out into several: Listen's rolled
// chords and ornament figures, and the graces ahead of a beat in Listen and Keep up alike.
type TimedStep = {
    lengths: readonly number[];
    // The cursor position it was read at.
    position: number;
    // Whether it moves the cursor on: false on every sub-step of a position but the last.
    advancesCursor: boolean;
};

// The steps one position was spelled out into — a rolled chord's notes, an ornament's or a
// tremolo's figure, a beat and the graces leaning on it: consecutive steps at one cursor
// position, every one but the last holding the cursor where it is.
export function subStepsOf(
    steps: readonly TimedStep[],
    index: number,
): { from: number; to: number } {
    const joined = (earlier: TimedStep | undefined, later: TimedStep | undefined) =>
        earlier !== undefined &&
        later !== undefined &&
        !earlier.advancesCursor &&
        earlier.position === later.position;
    let from = index;
    while (joined(steps[from - 1], steps[from])) {
        from -= 1;
    }
    let to = index;
    while (joined(steps[to], steps[to + 1])) {
        to += 1;
    }
    return { from, to };
}

// How long one sub-step of a position holds, so that together they last exactly what the
// position is written to last — its sub-steps' written lengths added up, under the same
// MIN_STEP_MS floor a single step gets. Listen and Keep up both keep time by this, so the
// two agree on when the next beat is.
//
// A roll's spread is a fixed fraction of a beat, so above about 90 bpm it is shorter than
// that floor, and so are the notes of a quick figure and a quick grace. Floored one by one,
// each would overstay by the difference while the last still counted on having its written
// share, and the position would end late — every rolled chord and every grace pushing the
// rest of the piece further behind the onsets a graded run counts against. So the earlier
// sub-steps keep the floor while the position has room for it and the last takes what is
// left; a position too short to give each its floor shares its time out in the written
// proportions instead. Where no sub-step is shorter than the floor, each holds its own
// written length.
export function subStepAdvanceMs(
    steps: readonly TimedStep[],
    index: number,
    tempo: number,
    stretchAt: (at: number) => number,
): number {
    const step = steps[index] as TimedStep;
    const { from, to } = subStepsOf(steps, index);
    if (from === to) {
        return listenStepMs(step.lengths, tempo, stretchAt(index));
    }
    const written: number[] = [];
    for (let at = from; at <= to; at++) {
        written.push(writtenStepMs((steps[at] as TimedStep).lengths, tempo, stretchAt(at)));
    }
    const total = written.reduce((sum, ms) => sum + ms, 0);
    const positionMs = Math.max(MIN_STEP_MS, total);
    const earlier = written.slice(0, -1).map((ms) => Math.max(MIN_STEP_MS, ms));
    const taken = earlier.reduce((sum, ms) => sum + ms, 0);
    const offset = index - from;
    if (taken < positionMs) {
        if (index < to) {
            return earlier[offset] as number;
        }
        const lastWritten = written[offset] as number;
        const floored = earlier.some((ms, at) => ms !== written[at]);
        return !floored && lastWritten >= MIN_STEP_MS
            ? listenStepMs(step.lengths, tempo, stretchAt(index))
            : positionMs - taken;
    }
    return total > 0
        ? ((written[offset] as number) * positionMs) / total
        : positionMs / written.length;
}

// The tempo to count a position at: the dial, held in the same proportion to the mark in
// force as it is to the tempo the score opens at. A piece that doubles its speed halfway
// does so at whatever dial the player sets, and a piece that marks nothing plays at the
// dial itself, because both readings then report the same nominal tempo.
export function effectiveTempo(dial: number, bpm: number, startBpm: number): number {
    return dial * (bpm / Math.max(1, startBpm));
}
