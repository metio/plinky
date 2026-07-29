// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The facts about note letters that every other module was quietly keeping its own
// copy of: which letters there are, how far each sits above C, and what a key
// signature does to them.
//
// These are not preferences or tuning knobs — they are the same in every piece of
// music ever written — so a second copy can only ever be a chance to disagree with
// the first. The generator, the exercise builder, the transposer, the MusicXML
// writer and the fingering scorer each had one.

// The seven natural letters, in the order a scale walks them.
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// Semitones above C for each natural letter.
export const SEMITONE: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};

// The order sharps and flats are added to a key signature — the circle of fifths
// read outward from C in each direction.
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

// The alteration a key signature applies to a letter, so notes can be spelled from
// plain letters and the signature supplies the sharps and flats.
export function alterFor(letter: string, fifths: number): number {
    if (fifths > 0) {
        return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    }
    if (fifths < 0) {
        return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    }
    return 0;
}
