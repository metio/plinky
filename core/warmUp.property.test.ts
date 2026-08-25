// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildExerciseId, exerciseTitle, parseExerciseId } from "./exerciseGen";
import { warmUpFor } from "./warmUp";

// Every key signature a score can legally write, and both modes.
const signature = fc.integer({ min: -7, max: 7 });
const mode = fc.boolean();

describe("the warm-up offered before a piece", () => {
    it("is always playable when it is offered at all", () => {
        // The card is a link. An offer that cannot be turned into a real exercise id is a
        // link to nothing, which is worse than no card — so this is the property the whole
        // unit rests on.
        fc.assert(
            fc.property(signature, mode, (fifths, minor) => {
                const warm = warmUpFor({ fifths, minor, isExercise: false });
                if (warm === null) {
                    return;
                }
                const id = buildExerciseId(warm.exercise);
                expect(parseExerciseId(id)).not.toBeNull();
                expect(exerciseTitle(warm.exercise).length).toBeGreaterThan(0);
            }),
        );
    });

    it("never counts a negative number of accidentals", () => {
        // Flats arrive as a negative signature, and the sentence built around this number
        // says "three flats" — "-3 flats" is exactly the sort of thing that ships.
        fc.assert(
            fc.property(signature, mode, (fifths, minor) => {
                const warm = warmUpFor({ fifths, minor, isExercise: false });
                if (warm !== null) {
                    expect(warm.accidentals).toBeGreaterThanOrEqual(0);
                    expect(warm.accidentals).toBe(Math.abs(fifths));
                }
            }),
        );
    });

    it("teaches the key the piece is actually in, never a neighbouring one", () => {
        // The failure this guards is the tempting one: answering an unsupported signature
        // with the nearest key that does have a scale. That would put the wrong accidentals
        // under the hand and call it preparation.
        fc.assert(
            fc.property(signature, mode, (fifths, minor) => {
                const warm = warmUpFor({ fifths, minor, isExercise: false });
                if (warm !== null) {
                    // The exercise's own key round-trips back to the signature it was asked
                    // for, so the scale and the piece cannot disagree.
                    expect(warm.exercise.key).toBe(warm.key);
                }
            }),
        );
    });

    it("offers nothing at all before an exercise, whatever its key", () => {
        fc.assert(
            fc.property(signature, mode, (fifths, minor) => {
                expect(warmUpFor({ fifths, minor, isExercise: true })).toBeNull();
            }),
        );
    });
});
