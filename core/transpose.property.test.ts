// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LETTERS, SEMITONE } from "./notes";
import { keyPitchClasses } from "./ornament";
import { keyShift } from "./transpose";

const opening = fc.integer({ min: -7, max: 7 });
const shift = fc.integer({ min: -24, max: 24 });
const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);

describe("keyShift", () => {
    it("moves the key's seven notes by exactly the transposition", () => {
        // An ornament in a transposed piece reaches into the key being played, so the key
        // the move lands on must hold the moved notes and no others.
        fc.assert(
            fc.property(opening, shift, (fifths, semitones) => {
                const { fifthsDelta } = keyShift(fifths, semitones);
                expect(sorted(keyPitchClasses(fifths + fifthsDelta))).toEqual(
                    sorted(
                        new Set(
                            [...keyPitchClasses(fifths)].map(
                                (one) => (((one + semitones) % 12) + 12) % 12,
                            ),
                        ),
                    ),
                );
            }),
        );
    });

    it("lands the opening key within six sharps or flats, or leaves it as written", () => {
        fc.assert(
            fc.property(opening, shift, (fifths, semitones) => {
                const moved = fifths + keyShift(fifths, semitones).fifthsDelta;
                if (semitones % 12 === 0) {
                    expect(moved).toBe(fifths);
                } else {
                    expect(Math.abs(moved)).toBeLessThanOrEqual(6);
                }
            }),
        );
    });

    it("moves every letter to one that reaches its moved pitch within a double accidental", () => {
        fc.assert(
            fc.property(opening, shift, (fifths, semitones) => {
                const { letterSteps } = keyShift(fifths, semitones);
                const within = ((semitones % 12) + 12) % 12;
                for (const [index, step] of LETTERS.entries()) {
                    const to = LETTERS[(((index + letterSteps) % 7) + 7) % 7] ?? "C";
                    const wraps = Math.floor((index + letterSteps) / 7);
                    const gap = (SEMITONE[step] ?? 0) + within - ((SEMITONE[to] ?? 0) + 12 * wraps);
                    expect(Math.abs(gap)).toBeLessThanOrEqual(2);
                }
            }),
        );
    });
});
