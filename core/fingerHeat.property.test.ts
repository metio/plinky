// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { absoluteHeat, barCosts, barHeat } from "./fingerHeat";

// The heat feeds a CSS opacity, so every value must stay in [0, 1] for any score;
// and combining the relative map with the absolute floor must never make a harder
// bar read cooler than an easier one, nor drop a bar below its own absolute level.

// A random score: each bar a list of positions, each position 1–3 MIDI pitches.
const score = fc.array(
    fc.array(fc.array(fc.integer({ min: 21, max: 108 }), { minLength: 1, maxLength: 3 }), {
        maxLength: 8,
    }),
    { maxLength: 12 },
);

describe("barHeat properties", () => {
    it("keeps every bar's heat within [0, 1]", () => {
        fc.assert(
            fc.property(score, (bars) => {
                for (const heat of barHeat(bars, "right")) {
                    expect(heat).toBeGreaterThanOrEqual(0);
                    expect(heat).toBeLessThanOrEqual(1);
                }
            }),
        );
    });

    it("never reads below the bar's absolute floor", () => {
        fc.assert(
            fc.property(score, (bars) => {
                const heat = barHeat(bars, "right");
                const floor = absoluteHeat(barCosts(bars, "right"));
                heat.forEach((h, i) => expect(h).toBeGreaterThanOrEqual(floor[i]! - 1e-9));
            }),
        );
    });

    it("is monotonic — a costlier bar never reads cooler", () => {
        fc.assert(
            fc.property(score, (bars) => {
                const costs = barCosts(bars, "right");
                const heat = barHeat(bars, "right");
                for (let i = 0; i < costs.length; i++) {
                    for (let j = 0; j < costs.length; j++) {
                        if (costs[i]! > costs[j]!) {
                            expect(heat[i]!).toBeGreaterThanOrEqual(heat[j]! - 1e-9);
                        }
                    }
                }
            }),
        );
    });
});
