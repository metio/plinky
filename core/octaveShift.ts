// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the score prints 8va — the dotted line that says "an octave higher than written".
//
// The mark exists so that a passage high above the treble staff can be read without a
// ladder of leger lines: the notes are drawn where they are legible and played where they
// belong. Which means the printed pitch is deliberately not the sounding pitch, and a
// reader following the line is playing something the page does not literally say.
//
// A passage read without it is out by a whole octave — in a register where being out by an
// octave is the difference between the tune and a rumble. It has to reach grading as well
// as playback, or the app would ask the player to play what it prints and then mark them
// wrong for it.

export type OctaveShiftSpan = {
    // Whole notes from the top of the piece.
    from: number;
    to: number;
    // What to add to a written pitch to get the sounding one. Twelve for 8va, minus twelve
    // for 8vb, twenty-four for 15ma.
    semitones: number;
};

const EPSILON = 1 / 1024;

// The shift in force at a printed position, in semitones — zero where the score prints no
// line, which is almost everywhere.
//
// Closed where the line starts and OPEN where it ends, exactly like the pedal next door.
// `to` is where the engraving writes the closing bracket, which comes AFTER the last note
// under the line — so a note written at that moment is the first one outside it. Reading
// the end as closed puts the note immediately after an 8va an octave up, which is both
// wrong and hard to hear as wrong, since it is only ever one note.
export function octaveShiftAt(spans: readonly OctaveShiftSpan[], whole: number): number {
    for (const span of spans) {
        if (whole >= span.from - EPSILON && whole < span.to - EPSILON) {
            return span.semitones;
        }
    }
    return 0;
}
