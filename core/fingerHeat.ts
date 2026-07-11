// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The fingering difficulty heat-map: how hard each bar is to finger *at its
// best* — the comfort cost of the optimal fingering, per position so long bars
// aren't penalised for length — normalised across the piece so the hardest bar
// reads 1 and the easiest 0. A piece whose bars are equally comfortable heats
// to all zeros: nothing stands out because nothing should.

import { type Hand, fingerPositions, positionsCost } from "./fingering";

// The raw per-bar cost: optimal fingering's cost averaged over the bar's
// positions; an empty bar (a rest bar, or the other hand's solo) costs 0.
export function barCosts(bars: number[][][], hand: Hand, span?: number): number[] {
    return bars.map((positions) => {
        if (positions.length === 0) {
            return 0;
        }
        const optimal = fingerPositions(positions, hand, span);
        return positionsCost(positions, optimal, hand, span) / positions.length;
    });
}

// Costs → 0..1 heat by min–max over the whole piece. A flat piece (or a single
// bar) yields all zeros: nothing stands out because nothing should.
export function normalizeHeat(costs: number[]): number[] {
    const min = Math.min(...costs);
    const max = Math.max(...costs);
    if (costs.length === 0 || max - min <= 1e-9) {
        return costs.map(() => 0);
    }
    return costs.map((cost) => (cost - min) / (max - min));
}

export function barHeat(bars: number[][][], hand: Hand, span?: number): number[] {
    return normalizeHeat(barCosts(bars, hand, span));
}
