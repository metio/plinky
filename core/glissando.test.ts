// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { glissandoNotes, readGlissandos } from "./glissando";

const pitches = (notes: { pitch: number }[]) => notes.map((one) => one.pitch);
const total = (notes: { quarters: number }[]) => notes.reduce((sum, one) => sum + one.quarters, 0);

describe("glissandoNotes", () => {
    it("sweeps the keys under the hand, not every semitone", () => {
        // A piano gliss is a fingernail dragged across the keys. In C that is the white
        // ones — sweeping every semitone would be a chromatic run, a different gesture
        // played with a different hand.
        expect(pitches(glissandoNotes(60, 72, 1, 0))).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    });

    it("sounds both notes the score actually wrote", () => {
        const swept = pitches(glissandoNotes(60, 67, 1, 0));
        expect(swept[0]).toBe(60);
        expect(swept.at(-1)).toBe(67);
    });

    it("sweeps downward when the score does", () => {
        const swept = pitches(glissandoNotes(72, 60, 1, 0));
        expect(swept[0]).toBe(72);
        expect(swept.at(-1)).toBe(60);
        expect(swept).toEqual([...swept].sort((one, other) => other - one));
    });

    it("follows the key the piece is in", () => {
        // Three flats: the sweep takes E flat rather than E natural.
        const swept = pitches(glissandoNotes(60, 72, 1, -3));
        expect(swept).toContain(63);
        expect(swept).not.toContain(64);
    });

    it("starts on a written accidental even when the key does not contain it", () => {
        // A gliss written from F sharp in C major starts on F sharp — that is the note on
        // the page and the key the hand begins on.
        const swept = pitches(glissandoNotes(66, 72, 1, 0));
        expect(swept[0]).toBe(66);
        expect(swept.at(-1)).toBe(72);
    });

    it("fills exactly the time the written note had", () => {
        for (const quarters of [0.5, 1, 2.5]) {
            expect(total(glissandoNotes(60, 79, quarters, 0))).toBeCloseTo(quarters);
        }
    });

    it("thins a long sweep instead of arriving late or scheduling hundreds", () => {
        // A gliss across the instrument in a quaver: a gesture of the right length beats a
        // complete scale that overruns it.
        const swept = glissandoNotes(21, 108, 0.5, 0);
        expect(swept.length).toBeLessThanOrEqual(60);
        expect(total(swept)).toBeCloseTo(0.5);
        expect(swept[0]?.pitch).toBe(21);
        expect(swept.at(-1)?.pitch).toBe(108);
    });

    it("has nothing to sweep between a note and itself", () => {
        expect(glissandoNotes(60, 60, 1, 0)).toEqual([]);
        expect(glissandoNotes(60, 72, 0, 0)).toEqual([]);
    });

    it("never repeats a pitch when thinning", () => {
        // Thinning rounds into the original list, and two rounded indices can land on one
        // note — a repeated key in a gliss is an audible stumble.
        const swept = pitches(glissandoNotes(60, 64, 2, 0));
        expect(new Set(swept).size).toBe(swept.length);
    });
});

const note = (
    whole: number,
    midi: number | null,
    glissando: "start" | "stop" | null,
    wholes = 0.5,
) => ({
    whole,
    wholes,
    midi,
    marks: { glissando },
});

describe("readGlissandos", () => {
    it("reads the sweep and the note it arrives on", () => {
        expect(readGlissandos([note(0, 60, "start"), note(0.5, 72, "stop")])).toEqual([
            { from: 0, to: 1, arrivesAt: 72, pitch: 60 },
        ]);
    });

    it("ignores a sweep the file opens and never closes", () => {
        expect(readGlissandos([note(0, 60, "start")])).toEqual([]);
    });

    it("ignores an unmarked note and a rest", () => {
        expect(readGlissandos([note(0, 60, null), note(1, null, "stop")])).toEqual([]);
    });
});
