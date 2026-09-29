// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    alterFor,
    alterOnto,
    FLAT_ORDER,
    LETTERS,
    midiOf,
    octaveOf,
    SEMITONE,
    SHARP_ORDER,
    spellInKey,
    spellMidi,
} from "./notes";

// How a written note and a sounding pitch turn into each other. Every walk over a score
// goes through here, and the letters arrive from files the app did not write — an
// imported MusicXML, a pasted bundle — so the laws cover both halves: the arithmetic
// must invert, and a letter that is not a letter must not become one.

const arbMidi = fc.integer({ min: 21, max: 108 });
const arbLetter = fc.constantFrom(...LETTERS);
const arbFifths = fc.integer({ min: -7, max: 7 });
const arbAlter = fc.integer({ min: -2, max: 2 });

// The names every object answers for. A <step> in an imported file can be any text at
// all, and these are the ones that used to resolve to a function rather than a letter.
const NOT_LETTERS = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
    "",
    "H",
    "do",
];

describe("a written note's sounding pitch", () => {
    it("stays a number, whatever the file called the step", () => {
        fc.assert(
            fc.property(
                fc.oneof(arbLetter, fc.constantFrom(...NOT_LETTERS), fc.string({ maxLength: 8 })),
                fc.integer({ min: -1, max: 9 }),
                arbAlter,
                (step, octave, alter) => {
                    const midi = midiOf(step, octave, alter);

                    // The signature promises a number; a step that resolved to a
                    // function would make this a string and poison every pitch derived
                    // from it, with nothing to notice it had happened.
                    expect(typeof midi).toBe("number");
                    expect(Number.isFinite(midi)).toBe(true);
                    expect(Number.isInteger(midi)).toBe(true);
                },
            ),
        );
    });

    it("reads an unknown letter as the octave's C", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NOT_LETTERS),
                fc.integer({ min: 0, max: 8 }),
                (step, octave) => {
                    expect(midiOf(step, octave)).toBe(midiOf("C", octave));
                },
            ),
        );
    });

    it("puts each letter where the keyboard has it", () => {
        fc.assert(
            fc.property(
                arbLetter,
                fc.integer({ min: 0, max: 8 }),
                arbAlter,
                (letter, octave, alter) => {
                    const midi = midiOf(letter, octave, alter);

                    expect(midi).toBe((octave + 1) * 12 + (SEMITONE[letter] as number) + alter);
                    // An octave up is twelve semitones up, and an accidental moves by its own
                    // size and nothing else.
                    expect(midiOf(letter, octave + 1, alter) - midi).toBe(12);
                    expect(midiOf(letter, octave, alter + 1) - midi).toBe(1);
                },
            ),
        );
    });
});

describe("spelling a pitch", () => {
    it("writes a note that sounds as the note it was given", () => {
        fc.assert(
            fc.property(arbMidi, arbFifths, (midi, fifths) => {
                const { step, octave, alter } = spellInKey(midi, fifths);

                // The round trip that matters: what is written must sound the same.
                expect(midiOf(step, octave, alter)).toBe(midi);
                expect(LETTERS).toContain(step);
                expect(Math.abs(alter)).toBeLessThanOrEqual(1);
            }),
        );
    });

    it("spells the same pitch the same way in the same key", () => {
        fc.assert(
            fc.property(arbMidi, arbFifths, (midi, fifths) => {
                expect(spellInKey(midi, fifths)).toEqual(spellInKey(midi, fifths));
            }),
        );
    });

    it("writes a sharp-side or flat-side spelling that sounds right", () => {
        fc.assert(
            fc.property(arbMidi, fc.boolean(), (midi, flat) => {
                const { step, octave, alter } = spellMidi(midi, flat);

                expect(midiOf(step, octave, alter)).toBe(midi);
            }),
        );
    });

    it("finds the accidental that lands a letter on a pitch", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 11 }), arbLetter, (pitchClass, step) => {
                const alter = alterOnto(pitchClass, step);

                expect(alter).toBeGreaterThanOrEqual(-6);
                expect(alter).toBeLessThan(6);
                // The letter with that accidental really is the pitch class asked for.
                expect(((((SEMITONE[step] as number) + alter) % 12) + 12) % 12).toBe(pitchClass);
            }),
        );
    });

    it("stays a number for a letter no alphabet has", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 11 }),
                fc.constantFrom(...NOT_LETTERS),
                (pitchClass, step) => {
                    expect(typeof alterOnto(pitchClass, step)).toBe("number");
                    expect(Number.isInteger(alterOnto(pitchClass, step))).toBe(true);
                    expect(typeof octaveOf(60, step, 0)).toBe("number");
                    expect(Number.isInteger(octaveOf(60, step, 0))).toBe(true);
                },
            ),
        );
    });
});

describe("what a key signature does to a letter", () => {
    it("alters only the letters the signature names", () => {
        fc.assert(
            fc.property(arbLetter, arbFifths, (letter, fifths) => {
                const alter = alterFor(letter, fifths);

                expect([-1, 0, 1]).toContain(alter);
                if (fifths > 0) {
                    expect(alter).toBe(SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0);
                } else if (fifths < 0) {
                    expect(alter).toBe(FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0);
                } else {
                    // No signature alters nothing.
                    expect(alter).toBe(0);
                }
            }),
        );
    });

    it("sharpens more letters the further round the circle it goes", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 6 }), (fifths) => {
                const sharpened = (at: number) =>
                    LETTERS.filter((letter) => alterFor(letter, at) === 1).length;

                expect(sharpened(fifths + 1)).toBe(sharpened(fifths) + 1);
            }),
        );
    });
});
