// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { owesGrade } from "./runEnd";

const claims = fc.record({
    complete: fc.boolean(),
    graded: fc.boolean(),
    cleared: fc.nat({ max: 400 }),
    captured: fc.nat({ max: 400 }),
});

describe("owesGrade", () => {
    it("is owed only by a finished run not yet graded", () => {
        fc.assert(
            fc.property(claims, (claim) => {
                if (owesGrade(claim)) {
                    expect(claim.complete).toBe(true);
                    expect(claim.graded).toBe(false);
                }
            }),
        );
    });

    it("never grades cleared positions from an empty capture", () => {
        fc.assert(
            fc.property(claims, fc.integer({ min: 1, max: 400 }), (claim, cleared) => {
                expect(owesGrade({ ...claim, cleared, captured: 0 })).toBe(false);
            }),
        );
    });

    it("grades every finished, ungraded run that captured its notes", () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 400 }),
                fc.integer({ min: 1, max: 400 }),
                (cleared, captured) => {
                    expect(owesGrade({ complete: true, graded: false, cleared, captured })).toBe(
                        true,
                    );
                },
            ),
        );
    });
});
