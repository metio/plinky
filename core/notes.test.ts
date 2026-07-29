// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { alterFor, LETTERS, SEMITONE, solfegeOf } from "./notes";

describe("the note facts", () => {
    it("names the seven letters in scale order", () => {
        expect(LETTERS).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    });

    it("places each letter the right distance above C", () => {
        expect(LETTERS.map((letter) => SEMITONE[letter])).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });
});

describe("alterFor", () => {
    it("adds sharps and flats in the order a signature does", () => {
        // One sharp is F#, two are F# and C#; one flat is Bb.
        expect(alterFor("F", 1)).toBe(1);
        expect(alterFor("C", 1)).toBe(0);
        expect(alterFor("C", 2)).toBe(1);
        expect(alterFor("B", -1)).toBe(-1);
        expect(alterFor("E", -1)).toBe(0);
        expect(alterFor("E", -2)).toBe(-1);
    });

    it("leaves every letter alone in C major", () => {
        expect(LETTERS.every((letter) => alterFor(letter, 0) === 0)).toBe(true);
    });

    it("alters every letter at the far ends of the circle", () => {
        expect(LETTERS.every((letter) => alterFor(letter, 7) === 1)).toBe(true);
        expect(LETTERS.every((letter) => alterFor(letter, -7) === -1)).toBe(true);
    });
});

describe("solfegeOf", () => {
    it("names the white keys do through si", () => {
        // C D E F G A B over one octave from middle C.
        expect([60, 62, 64, 65, 67, 69, 71].map((n) => solfegeOf(n).degree)).toEqual([
            0, 1, 2, 3, 4, 5, 6,
        ]);
        expect([60, 62, 64, 65, 67, 69, 71].every((n) => !solfegeOf(n).sharp)).toBe(true);
    });

    it("reads a black key as the syllable below it, raised", () => {
        // C# is do sharp, not a syllable of its own.
        expect(solfegeOf(61)).toEqual({ degree: 0, sharp: true });
        expect(solfegeOf(66)).toEqual({ degree: 3, sharp: true });
        expect(solfegeOf(70)).toEqual({ degree: 5, sharp: true });
    });

    it("names every pitch class exactly one way", () => {
        const named = Array.from({ length: 12 }, (_, pc) => solfegeOf(60 + pc));

        // Seven naturals and five sharps — no pitch class left unnamed or doubled.
        expect(named.filter((n) => !n.sharp)).toHaveLength(7);
        expect(named.filter((n) => n.sharp)).toHaveLength(5);
    });

    it("names the same syllable in every octave, and below MIDI zero", () => {
        expect(solfegeOf(0)).toEqual(solfegeOf(60));
        expect(solfegeOf(120)).toEqual(solfegeOf(60));
        // A floor-mod, so a negative note still names a real syllable.
        expect(solfegeOf(-1)).toEqual({ degree: 6, sharp: false });
    });
});
