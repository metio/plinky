// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The fingering difficulty heat-map: how hard each bar is to finger *at its
// best* — the comfort cost of the optimal fingering, per position so long bars
// aren't penalised for length. Two readings are combined: a *relative* one
// (normalised across the piece, so the hardest bar reads 1 and the easiest 0)
// and an *absolute* floor (each bar's raw cost on a fixed scale). The relative
// contrast rides above the absolute floor, so an easy piece like a nursery
// melody stays cold while a uniformly *hard* piece still glows — a flat map no
// longer ambiguously means both "all easy" and "all hard".

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

// A per-position comfort cost at or above this reads as maximally hard on the
// absolute scale. Calibrated against the cost model: a comfortable line is ~0, a
// moving arpeggio ~1–3, chord changes ~3, and only sustained leaps or awkward
// position shifts climb past here.
const ABSOLUTE_HOT_COST = 8;

// Raw per-bar costs → 0..1 on a FIXED scale, independent of the rest of the
// piece — so a piece whose bars are all equally hard still reads hot instead of
// washing out to nothing the way a purely relative map would.
export function absoluteHeat(costs: number[]): number[] {
    return costs.map((cost) => Math.min(1, Math.max(0, cost / ABSOLUTE_HOT_COST)));
}

export function barHeat(bars: number[][][], hand: Hand, span?: number): number[] {
    const costs = barCosts(bars, hand, span);
    const relative = normalizeHeat(costs);
    const absolute = absoluteHeat(costs);
    // The absolute value is a floor; the relative contrast rides above it. An
    // easy piece stays cold (absolute ~0, relative flat); a uniformly hard one
    // glows at its absolute level; a varied one keeps its hardest bar at 1 with
    // cooler bars tinted by their own real difficulty rather than dropped to 0.
    return costs.map((_, i) => Math.max(relative[i]!, absolute[i]!));
}
