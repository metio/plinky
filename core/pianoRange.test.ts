// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { beyondThePiano, BEYOND_REPAIR, HIGHEST, LOWEST, onThePiano, ontoThePiano } from "./pianoRange";

describe("onThePiano", () => {
    it("knows the ends of the keyboard", () => {
        expect(onThePiano(LOWEST)).toBe(true);
        expect(onThePiano(HIGHEST)).toBe(true);
        expect(onThePiano(LOWEST - 1)).toBe(false);
        expect(onThePiano(HIGHEST + 1)).toBe(false);
    });
});

describe("ontoThePiano", () => {
    it("leaves a note that already fits exactly alone", () => {
        for (const midi of [LOWEST, 60, HIGHEST]) {
            expect(ontoThePiano(midi)).toBe(midi);
        }
    });

    it("moves by whole octaves, which is the only move that keeps the note itself", () => {
        // G0 becomes G1, not A0: shifting to the nearest key would change the harmony.
        expect(ontoThePiano(19)).toBe(31);
        expect(ontoThePiano(16)).toBe(28);
        expect(ontoThePiano(13)).toBe(25);
    });

    it("brings a note down from above the top just as far", () => {
        expect(ontoThePiano(125)).toBe(101);
        expect(ontoThePiano(112)).toBe(100);
    });

    it("lands inside the keyboard however far out it started", () => {
        for (let midi = -40; midi < 200; midi++) {
            expect(onThePiano(ontoThePiano(midi))).toBe(true);
        }
    });
});

describe("beyondThePiano", () => {
    it("is zero for a note that fits", () => {
        expect(beyondThePiano(60)).toBe(0);
        expect(beyondThePiano(LOWEST)).toBe(0);
    });

    it("measures how far out, at either end", () => {
        expect(beyondThePiano(19)).toBe(2);
        expect(beyondThePiano(13)).toBe(8);
        expect(beyondThePiano(125)).toBe(17);
    });

    it("separates a slip from a phantom at the octave", () => {
        // Every genuine slip in the catalogue is within eight semitones of the bottom A; the
        // one corrupt score carries notes seventeen above the top C.
        expect(beyondThePiano(13)).toBeLessThanOrEqual(BEYOND_REPAIR);
        expect(beyondThePiano(125)).toBeGreaterThan(BEYOND_REPAIR);
    });
});
