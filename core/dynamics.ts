// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type DynamicsSummary = {
    mean: number; // average velocity, 0..127
    evenness: number; // 0..100, higher is steadier
    label: string;
};

// Score how evenly a passage was struck from its note velocities. Evenness is
// 100 minus the coefficient of variation (spread relative to the mean), so a
// player who hits every note at a similar volume scores high regardless of
// whether they played loud or soft.
export function summarizeDynamics(velocities: number[]): DynamicsSummary {
    if (velocities.length === 0) {
        return { mean: 0, evenness: 100, label: "—" };
    }
    const mean = velocities.reduce((sum, value) => sum + value, 0) / velocities.length;
    const variance =
        velocities.reduce((sum, value) => sum + (value - mean) ** 2, 0) / velocities.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const evenness = Math.max(0, Math.min(100, Math.round(100 * (1 - coefficientOfVariation))));
    const label =
        evenness >= 90
            ? "Very even"
            : evenness >= 75
              ? "Even"
              : evenness >= 55
                ? "A little uneven"
                : "Uneven";
    return { mean: Math.round(mean), evenness, label };
}

// The loudness the score marks, as a timeline read off the printed page: one point per
// dynamic mark, in printed order, each a 0..127 loudness at the whole-note position it is
// written at. A mark stands until the next one, which is what makes this a timeline
// rather than a per-note property — an mf in bar 1 is still in force in bar 9.
//
// `ramp` says a hairpin starts here, so the loudness slides toward the next mark instead
// of stepping at it: that is what a crescendo asks for, and reading it as a step would
// grade a player who swells through the passage as wrong for most of it.
export type DynamicPoint = {
    whole: number;
    volume: number;
    ramp: boolean;
};

// The loudness in force at a printed position, or null before the first mark — a score
// that writes no dynamics asks for nothing in particular, which is a different statement
// from asking for silence.
export function volumeAt(points: readonly DynamicPoint[], whole: number): number | null {
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
        return current.volume;
    }
    const span = next.whole - current.whole;
    if (span <= 0) {
        return current.volume;
    }
    const travelled = Math.min(1, Math.max(0, (whole - current.whole) / span));
    return current.volume + (next.volume - current.volume) * travelled;
}

// Printed onsets are exact binary fractions in every ordinary metre, but a triplet is a
// third, so a mark written at one needs room for a rounded value.
const EPSILON = 1e-9;
