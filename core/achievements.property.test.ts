// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type BadgeMarks,
    NO_BADGE_MARKS,
    raiseBadgeMarks,
    type StarKind,
    starsThrough,
} from "./achievements";

const marks: fc.Arbitrary<BadgeMarks> = fc.record({
    star: fc.constantFrom<StarKind | null>(null, "bronze", "silver", "gold"),
    earMastered: fc.boolean(),
});

describe("badge marks (properties)", () => {
    it("once shown, a badge stays earned whatever the mastery shows afterwards", () => {
        fc.assert(
            fc.property(fc.array(marks, { maxLength: 20 }), (sightings) => {
                let kept = NO_BADGE_MARKS;
                for (const seen of sightings) {
                    const next = raiseBadgeMarks(kept, seen);
                    for (const tier of starsThrough(kept.star)) {
                        expect(starsThrough(next.star).has(tier)).toBe(true);
                    }
                    for (const tier of starsThrough(seen.star)) {
                        expect(starsThrough(next.star).has(tier)).toBe(true);
                    }
                    expect(next.earMastered).toBe(kept.earMastered || seen.earMastered);
                    kept = next;
                }
            }),
        );
    });

    it("the order the sightings arrive in does not change what is kept", () => {
        fc.assert(
            fc.property(marks, marks, marks, (a, b, c) => {
                const forward = raiseBadgeMarks(raiseBadgeMarks(a, b), c);
                const backward = raiseBadgeMarks(raiseBadgeMarks(a, c), b);
                expect(forward).toEqual(backward);
            }),
        );
    });
});
