// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Small pure statistics shared across the analysis code, so the tempo curve and the
// flow score measure "the middle value" the same way instead of each rolling its own.

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
