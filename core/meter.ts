// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What counts as a time signature the notation can actually spell. Its own module
// rather than a corner of composition.ts because the two file parsers need it and
// otherwise depend on that module for types alone — a value import would pull the
// whole engraver into the on-demand MIDI chunk to reach one guard.

// The engraver tiles a bar in whole grid cells and its shortest value is one cell, so
// a fractional meter yields a bar too small to hold any note value at all — there is
// no notation for it, and the duration table has nothing to return.
export const MAX_BEATS_PER_BAR = 32;

// The meters Compose's time field offers a new take.
export const COMPOSE_METERS: readonly number[] = [2, 3, 4, 6];

// What the time field lists for a take in `current` beats to the bar: the usual meters,
// and the take's own among them in order when it is none of those. A file or a link can
// bring any whole meter up to MAX_BEATS_PER_BAR, and a select with no option for its
// value shows its first one instead — the field would read 2/4 over a staff in 5/4, and
// picking 2/4 would change nothing, because it already looks chosen.
export function meterChoices(current: number): number[] {
    return COMPOSE_METERS.includes(current)
        ? [...COMPOSE_METERS]
        : [...COMPOSE_METERS, current].sort((a, b) => a - b);
}

// Whole beats in a musical range, or the caller's fallback. A file or a link may say
// 7/8, but not 0.05 beats to the bar.
export function cleanBeatsPerBar(value: unknown, fallback = 4): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    const beats = Math.round(value);
    return beats >= 1 && beats <= MAX_BEATS_PER_BAR ? beats : fallback;
}
