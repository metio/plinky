// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Small pure statistics shared across the analysis code, so the tempo curve and the
// flow score measure "the middle value" the same way instead of each rolling its own.

// The smallest and largest of a list, or the fallback when it is empty.
//
// Folded rather than spread: `Math.min(...values)` passes every element as a separate
// argument, and past roughly 125,000 of them that overflows the call stack instead of
// returning a number — a scale a piece imported from a large MIDI file reaches.
//
// The fallback stands in only for an empty list; it is never a seed, or a list whose
// every value sits above it would report the fallback as its minimum.
export function minOf(values: readonly number[], fallback: number): number {
    let low = fallback;
    for (let i = 0; i < values.length; i++) {
        const value = values[i]!;
        if (i === 0 || value < low) {
            low = value;
        }
    }
    return low;
}

export function maxOf(values: readonly number[], fallback: number): number {
    let high = fallback;
    for (let i = 0; i < values.length; i++) {
        const value = values[i]!;
        if (i === 0 || value > high) {
            high = value;
        }
    }
    return high;
}

// The median of a list of numbers; 0 for an empty list. Averages the two middle
// values on an even count.
export function median(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = values.toSorted((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
