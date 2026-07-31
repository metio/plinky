// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// What counts as a time signature the notation can actually spell. Its own module
// rather than a corner of composition.ts because the two file parsers need it and
// otherwise depend on that module for types alone — a value import would pull the
// whole engraver into the on-demand MIDI chunk to reach one guard.

// The engraver tiles a bar in whole grid cells and its shortest value is one cell, so
// a fractional meter yields a bar too small to hold any note value at all — there is
// no notation for it, and the duration table has nothing to return.
export const MAX_BEATS_PER_BAR = 32;

// Whole beats in a musical range, or the caller's fallback. A file or a link may say
// 7/8, but not 0.05 beats to the bar.
export function cleanBeatsPerBar(value: unknown, fallback = 4): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    const beats = Math.round(value);
    return beats >= 1 && beats <= MAX_BEATS_PER_BAR ? beats : fallback;
}
