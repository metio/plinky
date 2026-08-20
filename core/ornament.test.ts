// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { diatonicNeighbours, keyPitchClasses, type OrnamentKind, ornamentNotes } from "./ornament";

const C4 = 60;
const C_MAJOR = 0;
const A_MAJOR = 3; // three sharps — also F sharp minor
const E_FLAT = -3;

const KINDS: OrnamentKind[] = ["trill", "turn", "inverted-turn", "mordent", "inverted-mordent"];

describe("the key an ornament reaches into", () => {
    it("reads the seven notes a signature admits", () => {
        expect([...keyPitchClasses(C_MAJOR)].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
        // Three sharps: A major — F sharp, C sharp, G sharp.
        expect([...keyPitchClasses(A_MAJOR)].sort((a, b) => a - b)).toEqual([1, 4, 6, 8, 9, 11, 2].sort((a, b) => a - b));
        // Three flats: E flat major — B flat, E flat, A flat.
        expect([...keyPitchClasses(E_FLAT)].sort((a, b) => a - b)).toEqual([3, 5, 7, 8, 10, 0, 2].sort((a, b) => a - b));
    });

    it("steps to the next note of the key, not a fixed distance", () => {
        // The whole reason the key is consulted. In C major the note above E is F, one
        // semitone up; the note above C is D, two. A fixed interval gets one of them wrong
        // wherever it is used.
        expect(diatonicNeighbours(64, C_MAJOR).above).toBe(65);
        expect(diatonicNeighbours(C4, C_MAJOR).above).toBe(62);
    });

    it("steps down into the key as well", () => {
        expect(diatonicNeighbours(65, C_MAJOR).below).toBe(64);
        expect(diatonicNeighbours(C4, C_MAJOR).below).toBe(59);
    });

    it("uses the key's own notes in a signature with accidentals", () => {
        // In E flat major the note below C is B flat, not B.
        expect(diatonicNeighbours(C4, E_FLAT).below).toBe(58);
    });

    it("gives a note outside the key the key's neighbours anyway", () => {
        // A written accidental is one note; the ornament over it still turns into the key,
        // which is what a player reads off the page.
        expect(diatonicNeighbours(61, C_MAJOR)).toEqual({ above: 62, below: 60 });
    });
});

describe("the notes an ornament sounds", () => {
    it("spends exactly the note's written length, whatever the figure", () => {
        // The figure replaces the note; a figure that ran over would push everything after
        // it late for the rest of the bar.
        for (const kind of KINDS) {
            for (const quarters of [0.25, 0.5, 1, 2, 3]) {
                const notes = ornamentNotes(C4, quarters, kind, C_MAJOR);
                const total = notes.reduce((sum, one) => sum + one.quarters, 0);
                expect(total).toBeCloseTo(quarters, 6);
                expect(notes.every((one) => one.quarters > 0)).toBe(true);
            }
        }
    });

    it("ends on the written note for every figure but the trill", () => {
        for (const kind of KINDS.filter((one) => one !== "trill")) {
            expect(ornamentNotes(C4, 1, kind, C_MAJOR).at(-1)?.pitch).toBe(C4);
        }
    });

    it("plays a mordent as the note, the one below, and the note again", () => {
        expect(ornamentNotes(C4, 1, "mordent", C_MAJOR).map((one) => one.pitch)).toEqual([
            C4,
            59,
            C4,
        ]);
    });

    it("plays an inverted mordent upward instead", () => {
        expect(ornamentNotes(C4, 1, "inverted-mordent", C_MAJOR).map((one) => one.pitch)).toEqual([
            C4,
            62,
            C4,
        ]);
    });

    it("turns from above, through the note, to below and back", () => {
        expect(ornamentNotes(C4, 1, "turn", C_MAJOR).map((one) => one.pitch)).toEqual([
            62,
            C4,
            59,
            C4,
        ]);
        expect(ornamentNotes(C4, 1, "inverted-turn", C_MAJOR).map((one) => one.pitch)).toEqual([
            59,
            C4,
            62,
            C4,
        ]);
    });

    it("alternates a trill with the note above, starting on the note", () => {
        const notes = ornamentNotes(C4, 1, "trill", C_MAJOR);
        expect(notes.length).toBeGreaterThan(4);
        expect(notes.map((one) => one.pitch)).toEqual(
            notes.map((_, index) => (index % 2 === 0 ? C4 : 62)),
        );
    });

    it("fills a longer trill with more notes rather than slower ones", () => {
        // A trill is measured, not counted: it fills the note it is written on, so what is
        // fixed is its speed.
        const short = ornamentNotes(C4, 1, "trill", C_MAJOR);
        const long = ornamentNotes(C4, 2, "trill", C_MAJOR);
        expect(long.length).toBeGreaterThan(short.length);
        expect(long[0]?.quarters).toBeCloseTo(short[0]?.quarters ?? 0, 6);
    });

    it("plays a note with no room for a figure plainly instead", () => {
        // A demisemiquaver with a turn over it is a blur, not an ornament — and answering
        // with the plain note keeps every caller's arithmetic working with no special case.
        for (const kind of KINDS) {
            expect(ornamentNotes(C4, 0.1, kind, C_MAJOR)).toEqual([{ pitch: C4, quarters: 0.1 }]);
        }
    });

    it("never lets the figure eat more than half of a short note", () => {
        const notes = ornamentNotes(C4, 0.25, "turn", C_MAJOR);
        const lead = notes.slice(0, -1).reduce((sum, one) => sum + one.quarters, 0);
        expect(lead).toBeLessThanOrEqual(0.25 * 0.5 + 1e-9);
        expect(notes.at(-1)?.quarters).toBeGreaterThan(0);
    });
});
