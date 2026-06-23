// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Hand } from "./hands";

// The bar a note falls in (0-based), from its onset time at the given tempo. The
// epsilon keeps a note that lands exactly on a bar line out of the previous bar
// despite floating-point timing.
export function barIndex(timeMs: number, beatsPerBar: number, tempo: number): number {
    const msPerBar = beatsPerBar * (60000 / tempo);
    return Math.floor((timeMs + 1) / msPerBar);
}

export function totalBars(hands: Hand[], beatsPerBar: number, tempo: number): number {
    let max = -1;
    for (const hand of hands) {
        for (const step of hand.steps) {
            max = Math.max(max, barIndex(step.timeMs, beatsPerBar, tempo));
        }
    }
    return max + 1;
}

// Hands restricted to bars [fromBar, toBar] (inclusive, 0-based). Hands with no
// notes in the range are dropped so the matcher does not treat them as already
// finished. Note elements are preserved, so highlighting still lands on the
// rendered score.
export function buildRegion(
    hands: Hand[],
    fromBar: number,
    toBar: number,
    beatsPerBar: number,
    tempo: number,
): Hand[] {
    return hands
        .map((hand) => ({
            ...hand,
            steps: hand.steps.filter((step) => {
                const bar = barIndex(step.timeMs, beatsPerBar, tempo);
                return bar >= fromBar && bar <= toBar;
            }),
        }))
        .filter((hand) => hand.steps.length > 0);
}

// The notated onset span (ms) of a region's notes — first note to last — used to
// compare against how long the player actually took.
export function regionSpanMs(region: Hand[]): number {
    const times = region.flatMap((hand) => hand.steps.map((step) => step.timeMs));
    if (times.length === 0) {
        return 0;
    }
    return Math.max(...times) - Math.min(...times);
}
