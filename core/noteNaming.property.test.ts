// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isWhite } from "./keyboardGeometry";
import { spokenKeyIn } from "./noteNaming";

const key = fc.integer({ min: 0, max: 127 });
const system = fc.constantFrom("letters" as const, "german" as const);

describe("spokenKeyIn properties", () => {
    it("says the octave a piano label carries, middle C in the fourth", () => {
        fc.assert(
            fc.property(key, system, (midi, one) => {
                expect(spokenKeyIn(midi, one).octave).toBe(Math.floor(midi / 12) - 1);
            }),
        );
    });

    it("never speaks a glyph, which a screen reader would read as a number or nothing", () => {
        fc.assert(
            fc.property(key, system, (midi, one) => {
                expect(spokenKeyIn(midi, one).name).not.toMatch(/[♯♭#]/);
            }),
        );
    });

    it("asks for a sharp word on exactly the black keys, and only in letters", () => {
        fc.assert(
            fc.property(key, (midi) => {
                expect(spokenKeyIn(midi, "letters").sharp).toBe(!isWhite(midi));
                expect(spokenKeyIn(midi, "german").sharp).toBe(false);
            }),
        );
    });

    it("gives the twelve keys of an octave twelve different spoken names", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 9 }), system, (octave, one) => {
                const said = Array.from({ length: 12 }, (_, step) => {
                    const spoken = spokenKeyIn(12 * (octave + 1) + step, one);
                    return `${spoken.name}${spoken.sharp ? "+" : ""}`;
                });
                expect(new Set(said).size).toBe(12);
            }),
        );
    });
});
