// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The little signs above a note that mean "play several notes here".
//
// A trill, a mordent and a turn are not decorations on a note — they are instructions to
// replace it with a short figure. Printed and not played, the page and the sound disagree
// about what the bar contains, which is worse than not printing them: a reader learning to
// recognise the sign hears nothing happen where it is written.
//
// The notes a figure reaches for are the neighbours IN THE KEY, not a fixed distance away.
// A trill on the leading note of a minor key turns to the tonic a semitone above; the same
// sign on the tonic of a major key turns to a note a whole tone above. Using a fixed
// interval would put a wrong note in every ornament the catalogue contains.

import { SEMITONES_PER_OCTAVE } from "./theory";

export type OrnamentKind = "trill" | "turn" | "inverted-turn" | "mordent" | "inverted-mordent";

export type OrnamentNote = {
    pitch: number;
    // The note's share of the written length, in quarter notes.
    quarters: number;
};

// The pitch classes a key signature admits. A signature names a major key and its relative
// minor together, and the two share every note — so the signature alone fixes the set,
// which is all a neighbour needs.
export function keyPitchClasses(fifths: number): Set<number> {
    // Each sharp moves the tonic up a fifth; each flat down one. Seven semitones per fifth.
    const tonic =
        (((fifths * 7) % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
    const major = [0, 2, 4, 5, 7, 9, 11];
    return new Set(major.map((step) => (tonic + step) % SEMITONES_PER_OCTAVE));
}

// The next note of the key above and below a pitch. A pitch outside the key — a written
// accidental — still gets the key's neighbours, which is what a player reads off the page.
export function diatonicNeighbours(
    pitch: number,
    fifths: number,
): { above: number; below: number } {
    const inKey = keyPitchClasses(fifths);
    const has = (value: number) =>
        inKey.has(((value % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE);
    let above = pitch + 1;
    // A key has at most two semitones between neighbours, so this walks at most twice —
    // the bound is a guard against a caller handing in an empty key, not a real search.
    while (above < pitch + SEMITONES_PER_OCTAVE && !has(above)) {
        above += 1;
    }
    let below = pitch - 1;
    while (below > pitch - SEMITONES_PER_OCTAVE && !has(below)) {
        below -= 1;
    }
    return { above, below };
}

// A figure shorter than this is a blur rather than an ornament, so a note with no room for
// one is played plainly instead. Half a quaver at the tempo these are written at.
const MIN_ORNAMENT_QUARTERS = 0.25;
// What each of a figure's leading notes takes from the main note. Fast, and even — an
// ornament is played as an event, not as a rhythm to be read.
const FIGURE_NOTE_QUARTERS = 0.125;
// How many notes a trill fits into a quarter. A trill is measured rather than counted: it
// fills the note it is written on, so its speed is what is fixed.
const TRILL_NOTES_PER_QUARTER = 8;

// The notes an ornament actually sounds, in order, sharing out the written length.
//
// Returns the main note alone when there is no room for the figure — which is the honest
// answer for a demisemiquaver with a turn over it, and keeps every caller's arithmetic
// working without a special case.
export function ornamentNotes(
    pitch: number,
    quarters: number,
    kind: OrnamentKind,
    fifths: number,
): OrnamentNote[] {
    const plain = [{ pitch, quarters }];
    if (quarters < MIN_ORNAMENT_QUARTERS) {
        return plain;
    }
    const { above, below } = diatonicNeighbours(pitch, fifths);

    if (kind === "trill") {
        const count = Math.max(2, Math.round(quarters * TRILL_NOTES_PER_QUARTER));
        const each = quarters / count;
        // Alternating main and upper, starting on the main note — the reading a modern
        // edition expects, and the one a player of these grades will have been taught.
        return Array.from({ length: count }, (_, index) => ({
            pitch: index % 2 === 0 ? pitch : above,
            quarters: each,
        }));
    }

    const lead =
        kind === "mordent"
            ? [pitch, below]
            : kind === "inverted-mordent"
              ? [pitch, above]
              : kind === "turn"
                ? [above, pitch, below]
                : [below, pitch, above];
    const leadEach = Math.min(FIGURE_NOTE_QUARTERS, (quarters * 0.5) / lead.length);
    const rest = quarters - leadEach * lead.length;
    return [...lead.map((one) => ({ pitch: one, quarters: leadEach })), { pitch, quarters: rest }];
}

// The key signature a piece lands in when it is transposed.
//
// Transposing moves the tonic, and the ornaments follow: a trill in C major that becomes a
// trill in E flat reaches for a different note above. Reading the written signature and
// using it on transposed pitches would put every ornament in a transposed score a semitone
// or two out.
//
// Signatures run from six flats to six sharps; anything beyond wraps to its enharmonic
// twin, which names the same seven pitch classes and is what a reader would write.
export function transposeFifths(fifths: number, semitones: number): number {
    // A piece nobody transposed keeps the signature it was written in, spelling and all.
    // Worth saying rather than deriving: six sharps and six flats name the same seven
    // notes, so the arithmetic below cannot tell them apart and would rewrite one as the
    // other for no reason.
    if (semitones % 12 === 0) {
        return fifths;
    }
    // Each step round the circle of fifths moves the tonic seven semitones, so going the
    // other way costs seven fifths per semitone.
    let moved = (((fifths + semitones * 7) % 12) + 12) % 12;
    if (moved > 6) {
        moved -= 12;
    }
    return moved;
}
