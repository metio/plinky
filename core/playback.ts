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

export function listenStepMs(quarterLengths: number[], tempo: number, stretch = 1): number {
    const beatMs = quartersMs(1, tempo);
    const nextOnset = quarterLengths.length > 0 ? Math.min(...quarterLengths) : 1;
    return Math.max(MIN_STEP_MS, nextOnset * beatMs * stretch);
}

// The tempo to count a position at: the dial, held in the same proportion to the mark in
// force as it is to the tempo the score opens at. A piece that doubles its speed halfway
// does so at whatever dial the player sets, and a piece that marks nothing plays at the
// dial itself, because both readings then report the same nominal tempo.
export function effectiveTempo(dial: number, bpm: number, startBpm: number): number {
    return dial * (bpm / Math.max(1, startBpm));
}
