// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Self-paced tempo analysis: instead of scoring against a fixed metronome, we
// read the player's own tempo back out of the gaps between their notes.

// The tempo curve summarises its points by their median; re-exported here so callers
// that already read the curve's helpers find it alongside them.
export { median } from "./stats";

export type TempoPoint = {
    // The note the gap leads into (>= 1); index 0 has no preceding gap.
    index: number;
    bpm: number;
};

export type Hotspot = {
    startIndex: number;
    endIndex: number;
};

// Convert one inter-onset interval to a tempo. `notatedGapMs` is how long the gap
// lasts at the reference tempo, so playing it faster (a smaller `actualGapMs`)
// reads as a higher bpm.
export function instantaneousBpm(
    referenceTempo: number,
    notatedGapMs: number,
    actualGapMs: number,
): number {
    if (actualGapMs <= 0) {
        return 0;
    }
    return (referenceTempo * notatedGapMs) / actualGapMs;
}

// Build the tempo curve from the notated onset times (at the reference tempo) and
// the actual onset timestamps, one point per gap between consecutive notes.
export function tempoSeries(
    referenceTempo: number,
    notatedMs: number[],
    actualMs: number[],
): TempoPoint[] {
    const points: TempoPoint[] = [];
    const count = Math.min(notatedMs.length, actualMs.length);
    for (let i = 1; i < count; i++) {
        const notatedGap = notatedMs[i]! - notatedMs[i - 1]!;
        const actualGap = actualMs[i]! - actualMs[i - 1]!;
        // A non-positive gap — two onsets at the same instant (a chord) or out of
        // order — has no measurable tempo. Skip it rather than emit a 0 bpm point,
        // which would drag the baseline median down and read as a drag hotspot.
        if (notatedGap <= 0 || actualGap <= 0) {
            continue;
        }
        points.push({ index: i, bpm: instantaneousBpm(referenceTempo, notatedGap, actualGap) });
    }
    return points;
}


export type HotspotOptions = {
    // A point is "slow" below `ratio` of the baseline tempo.
    ratio?: number;
    // Consecutive slow points required before a stretch counts as a hotspot.
    minRun?: number;
};

// Stretches where the player dragged well below their own typical tempo. The
// minimum run length keeps a single hiccup from lighting up while a sustained
// slow patch does.
export function findHotspots(
    points: TempoPoint[],
    baseline: number,
    options: HotspotOptions = {},
): Hotspot[] {
    const ratio = options.ratio ?? 0.85;
    const minRun = options.minRun ?? 2;
    const threshold = baseline * ratio;
    const hotspots: Hotspot[] = [];
    let runStart = -1;
    for (let i = 0; i < points.length; i++) {
        const slow = points[i]!.bpm < threshold;
        if (slow && runStart === -1) {
            runStart = i;
        }
        if (runStart !== -1 && (!slow || i === points.length - 1)) {
            const runEnd = slow ? i : i - 1;
            if (runEnd - runStart + 1 >= minRun) {
                hotspots.push({
                    startIndex: points[runStart]!.index,
                    endIndex: points[runEnd]!.index,
                });
            }
            runStart = -1;
        }
    }
    return hotspots;
}
