// Timing windows around each note's target time, in milliseconds. A hit within
// PERFECT_MS counts as perfect; within GOOD_MS as good; otherwise off.
export const PERFECT_MS = 60;
export const GOOD_MS = 140;

export type Rating = "perfect" | "good" | "off";

export type Hit = {
    index: number;
    // Signed offset from the target: negative is early, positive is late.
    deltaMs: number;
    rating: Rating;
};

export type RhythmSummary = {
    perfect: number;
    good: number;
    off: number;
    total: number;
    averageAbsMs: number;
};

export function rate(absDeltaMs: number): Rating {
    if (absDeltaMs <= PERFECT_MS) {
        return "perfect";
    }
    if (absDeltaMs <= GOOD_MS) {
        return "good";
    }
    return "off";
}

export function makeHit(index: number, deltaMs: number): Hit {
    return {index, deltaMs, rating: rate(Math.abs(deltaMs))};
}

export function summarize(hits: Hit[]): RhythmSummary {
    const counts = {perfect: 0, good: 0, off: 0};
    let sumAbs = 0;
    for (const hit of hits) {
        counts[hit.rating] += 1;
        sumAbs += Math.abs(hit.deltaMs);
    }
    return {
        ...counts,
        total: hits.length,
        averageAbsMs: hits.length > 0 ? sumAbs / hits.length : 0,
    };
}
