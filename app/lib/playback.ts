// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The shortest a playback step may last before advancing, so a very short note — or a
// zero-length glitch from the score — still moves on rather than stalling or firing the
// next strike in the same instant.
export const MIN_STEP_MS = 40;

// How long to dwell on one cursor step while playing a score back: the longest note (or
// rest) sounding there, in ms at the given tempo. Honoring each note's own written
// length is what keeps eighths and sixteenths quick — rounding the dwell UP to a whole
// beat, as a naive one-beat minimum does, flattens every run to a quarter-note plod. The
// floor here is a few milliseconds only, purely to keep the step positive; an empty step
// (nothing under the cursor) falls back to a single beat.
export function listenStepMs(quarterLengths: number[], tempo: number): number {
    const beatMs = 60_000 / Math.max(1, tempo);
    const longest = quarterLengths.length > 0 ? Math.max(...quarterLengths) : 1;
    return Math.max(MIN_STEP_MS, longest * beatMs);
}
