// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
