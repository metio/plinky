// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { alterFor, alterOnto, LETTERS, octaveOf, pitchMidiOf, SEMITONE } from "./notes";

describe("alterOnto", () => {
    it("reaches a pitch class from a letter the shorter way round", () => {
        expect(alterOnto(1, "C")).toBe(1);
        expect(alterOnto(1, "D")).toBe(-1);
        expect(alterOnto(2, "C")).toBe(2);
        expect(alterOnto(4, "E")).toBe(0);
    });

    it("crosses the octave line to reach a letter's neighbour", () => {
        // B♯ is C, and C♭ is B.
        expect(alterOnto(0, "B")).toBe(1);
        expect(alterOnto(11, "C")).toBe(-1);
    });

    it("reads any whole number as its pitch class", () => {
        expect(alterOnto(13, "C")).toBe(1);
        expect(alterOnto(-1, "C")).toBe(-1);
    });
});

describe("octaveOf", () => {
    it("puts a letter spelled across the octave line in its own octave", () => {
        expect(octaveOf(60, "C", 0)).toBe(4);
        // B♯3 sounds as middle C, and C♭4 as the B below it.
        expect(octaveOf(60, "B", 1)).toBe(3);
        expect(octaveOf(59, "C", -1)).toBe(4);
    });
});

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

describe("pitchMidiOf", () => {
    const pitch = (inner: string) =>
        new DOMParser().parseFromString(`<pitch>${inner}</pitch>`, "application/xml")
            .documentElement;

    it("reads the letter, the alteration and the octave", () => {
        expect(pitchMidiOf(pitch("<step>C</step><octave>4</octave>"))).toBe(60);
        expect(pitchMidiOf(pitch("<step>e</step><alter>-1</alter><octave>5</octave>"))).toBe(75);
    });

    it("reads an absent octave as the one middle C sits in", () => {
        expect(pitchMidiOf(pitch("<step>C</step>"))).toBe(60);
    });

    it("answers null for no letter or an unreadable number", () => {
        expect(pitchMidiOf(pitch("<octave>4</octave>"))).toBeNull();
        expect(pitchMidiOf(pitch("<step>C</step><octave>four</octave>"))).toBeNull();
        expect(pitchMidiOf(pitch("<step>C</step><alter>x</alter><octave>4</octave>"))).toBeNull();
    });
});
