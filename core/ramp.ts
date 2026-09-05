// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A value that holds from where it is written until the next mark, or slides toward the
// next mark when the score writes a ramp there — the one reading the tempo marks and the
// dynamics share: a rit. and a crescendo are the same shape over different numbers.

// Printed onsets are exact binary fractions in every ordinary metre, but a triplet is a
// third, so a mark written at one needs room for a rounded value.
const EPSILON = 1e-9;

export function rampAt<T extends { whole: number; ramp?: boolean }>(
    points: readonly T[],
    whole: number,
    read: (point: T) => number,
): number | null {
    let index = -1;
    for (const [at, point] of points.entries()) {
        if (point.whole <= whole + EPSILON) {
            index = at;
        }
    }
    const current = points[index];
    if (!current) {
        return null;
    }
    const next = points[index + 1];
    if (!current.ramp || !next) {
        return read(current);
    }
    const span = next.whole - current.whole;
    if (span <= 0) {
        return read(current);
    }
    const travelled = Math.min(1, Math.max(0, (whole - current.whole) / span));
    return read(current) + (read(next) - read(current)) * travelled;
}
