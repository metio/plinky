// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    decodeIncipit,
    encodeIncipit,
    type Incipit,
    INCIPIT_NOTES,
    layoutIncipit,
} from "./incipit";

// The six lengths the encoding keeps; anything else rounds to the nearest of them.
const LENGTHS = [4, 2, 1, 0.5, 0.25, 0.125];

const incipit = fc.record({
    clef: fc.constantFrom<Incipit["clef"]>("treble", "bass"),
    notes: fc.array(
        fc.record({
            diatonic: fc.integer({ min: 0, max: 90 }),
            alter: fc.constantFrom(-1, 0, 1),
            quarters: fc.constantFrom(...LENGTHS),
        }),
        { minLength: 1, maxLength: INCIPIT_NOTES },
    ),
});

describe("the encoded incipit", () => {
    it("survives the round trip through the manifest", () => {
        fc.assert(
            fc.property(incipit, (original) => {
                expect(decodeIncipit(encodeIncipit(original))).toEqual(original);
            }),
        );
    });

    it("stays short enough to ship once per piece in the catalogue", () => {
        fc.assert(
            fc.property(incipit, (original) => {
                // Four characters a note is the worst case — accidental, two digits and
                // a length — plus the clef. Multiplied by a few thousand pieces, this is
                // the difference between a manifest that grew and one that doubled.
                expect(encodeIncipit(original).length).toBeLessThanOrEqual(
                    1 + original.notes.length * 4,
                );
            }),
        );
    });

    it("rounds an unusual length to the nearest it can draw", () => {
        // A dotted crotchet is 1.5 quarters, nearer a crotchet than a minim; the mark
        // draws no dots, and only reads the length for its hollow head and its stem.
        const dotted: Incipit = {
            clef: "treble",
            notes: [{ diatonic: 30, alter: 0, quarters: 1.5 }],
        };
        expect(decodeIncipit(encodeIncipit(dotted))?.notes[0]?.quarters).toBe(1);
    });

    it("refuses anything that is not a mark it wrote", () => {
        fc.assert(
            fc.property(
                fc.string().filter((text) => decodeIncipit(text) === null || text.length > 0),
                (text) => {
                    const decoded = decodeIncipit(text);
                    // Whatever comes back must at least be drawable — a partial read
                    // would put a wrong mark beside a title, which is worse than none.
                    if (decoded) {
                        expect(decoded.notes.length).toBeGreaterThan(0);
                        expect(() => layoutIncipit(decoded)).not.toThrow();
                    }
                },
            ),
        );
        expect(decodeIncipit("")).toBeNull();
        expect(decodeIncipit("G")).toBeNull();
        expect(decodeIncipit("X30q")).toBeNull();
        // A trailing fragment means the string is not one this wrote, so none of it is
        // trusted rather than the readable half being drawn.
        expect(decodeIncipit("G30q30")).toBeNull();
        expect(decodeIncipit("G30q!!")).toBeNull();
    });
});
