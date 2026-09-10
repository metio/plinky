// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { reappearingSteps, vanishedSteps } from "./sightRead";

// Each step's bar, in play order. A repeat or a loop sends the bar number back down, so
// the sequence is arbitrary rather than rising.
const measuresArb = fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 16 });

describe("reappearingSteps properties", () => {
    it("returns exactly the vanished steps at or after the bar returned to", () => {
        fc.assert(
            fc.property(measuresArb, fc.nat(), fc.nat(), (measures, clearedAt, returnedAt) => {
                const cleared = clearedAt % measures.length;
                const returnedTo = returnedAt % measures.length;
                const gone = vanishedSteps(measures, cleared);
                const back = reappearingSteps(measures, gone, returnedTo);
                const target = measures[returnedTo]!;
                // Only what had vanished can come back.
                expect(back.every((index) => gone.includes(index))).toBe(true);
                // Nothing the player is about to read is left hidden...
                const stillGone = gone.filter((index) => !back.includes(index));
                expect(stillGone.every((index) => measures[index]! < target)).toBe(true);
                // ...and nothing behind the run comes back with it.
                expect(back.every((index) => measures[index]! >= target)).toBe(true);
            }),
        );
    });

    it("brings every step of a bar back together, never one pass of it", () => {
        fc.assert(
            fc.property(measuresArb, fc.nat(), fc.nat(), (measures, clearedAt, returnedAt) => {
                const gone = vanishedSteps(measures, clearedAt % measures.length);
                const back = new Set(
                    reappearingSteps(measures, gone, returnedAt % measures.length),
                );
                for (const a of gone) {
                    for (const b of gone) {
                        if (measures[a] === measures[b]) {
                            expect(back.has(a)).toBe(back.has(b));
                        }
                    }
                }
            }),
        );
    });
});
