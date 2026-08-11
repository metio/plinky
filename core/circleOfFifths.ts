// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type NoteNameId, type PitchClass, pitchClassOf, type Spelling } from "./theory";

// The circle of fifths: the twelve major keys in the order a fifth takes you through
// them, each with its relative minor and how many sharps or flats it carries.
//
// It is the one diagram every piano student is shown and the reason a key signature
// is memorable rather than arbitrary — neighbours on the circle differ by a single
// accidental. Derived here rather than typed out as a table, so the relationship is
// stated once and the spellings cannot drift from the arithmetic.

export type CircleKey = {
    // Semitones above C for the major tonic.
    tonic: PitchClass;
    // Positive for sharps, negative for flats, 0 for C major. This is the position on
    // the circle as much as the key signature: +1 is one step clockwise.
    accidentals: number;
    // How the key writes its own accidentals, which decides how its notes are spelled:
    // the key of F takes B flat, never A sharp.
    spelling: Spelling;
    // Semitones above C for the relative minor — always three semitones below the
    // major tonic, which is what "relative" means.
    relativeMinor: PitchClass;
};

// Clockwise from C, a fifth at a time, through the seven sharp keys; then
// anticlockwise through the flat ones. Both directions meet at the enharmonic keys,
// so the circle is cut at six accidentals in each direction and F sharp / G flat is
// represented once, as the sharp side's last key.
const SHARP_STEPS = 6;
const FLAT_STEPS = 5;

const FIFTH = 7;
const RELATIVE_MINOR_OFFSET = 9;

function keyAt(accidentals: number): CircleKey {
    const tonic = pitchClassOf(accidentals * FIFTH);
    return {
        tonic,
        accidentals,
        // C major has no accidentals at all; sharp is its nominal spelling and nothing
        // in it is ever written as one.
        spelling: accidentals < 0 ? "flat" : "sharp",
        relativeMinor: pitchClassOf(tonic + RELATIVE_MINOR_OFFSET),
    };
}

// The circle in clockwise order starting at C, so index 0 is C major, index 1 is G,
// and the last entries are the flat keys approaching C from below.
export const CIRCLE: CircleKey[] = [
    ...Array.from({ length: SHARP_STEPS + 1 }, (_, step) => keyAt(step)),
    ...Array.from({ length: FLAT_STEPS }, (_, step) => keyAt(-(FLAT_STEPS - step))),
];

export function keyForTonic(tonic: PitchClass): CircleKey | null {
    return CIRCLE.find((key) => key.tonic === pitchClassOf(tonic)) ?? null;
}

// The two keys either side on the circle — a fifth up and a fifth down. These are the
// keys a piece most often moves to, and the ones whose signatures differ from this
// one by exactly one accidental.
export function neighbours(key: CircleKey): { up: CircleKey; down: CircleKey } {
    const at = (accidentals: number) =>
        // Past the cut, the circle wraps: seven sharps is five flats spelled the other
        // way, and the diagram shows the key the reader would actually meet.
        keyForTonic(pitchClassOf((accidentals % 12) * FIFTH)) ?? keyAt(0);
    return { up: at(key.accidentals + 1), down: at(key.accidentals - 1) };
}

// The accidentals a key signature writes, in the order it writes them — sharps rising
// by fifths from F sharp, flats falling by fifths from B flat. A reader looking at a
// signature is reading exactly this sequence.
//
// NAMES, not pitch classes. A signature is a statement about letters: the sixth sharp
// is E sharp even though it sounds the pitch F, and the sixth flat is C flat even
// though it sounds B. Spelling these from a pitch class asks the wrong question and
// gets the wrong letter — F sharp major would print "F" for its sixth sharp, naming
// five letters for six accidentals and appearing to sharpen a note the key holds.
const SHARP_ORDER: NoteNameId[] = [
    "f-sharp",
    "c-sharp",
    "g-sharp",
    "d-sharp",
    "a-sharp",
    "e-sharp",
    "b-sharp",
];
const FLAT_ORDER: NoteNameId[] = [
    "b-flat",
    "e-flat",
    "a-flat",
    "d-flat",
    "g-flat",
    "c-flat",
    "f-flat",
];

export function signatureNotes(key: CircleKey): NoteNameId[] {
    const order = key.accidentals < 0 ? FLAT_ORDER : SHARP_ORDER;
    return order.slice(0, Math.abs(key.accidentals));
}
