// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a piano can actually play, and what to do about a note that is outside it.
//
// A harvested transcription occasionally carries a note below the bottom of the instrument —
// a bass line written an octave low, a notation program's default octave off by one. There
// is no key for it, so the note is unreachable: a practice run that waits for it waits
// forever.
//
// Two quite different things wear that shape, and the difference is how far out the note is.
// A note a few semitones under the bottom A is a slip, and moving it up an octave restores
// what was meant. A note several octaves above the top of the keyboard is not a slip — it is
// a phantom voice stapled onto real chords, and there is nothing to restore.

// The 88 keys, as MIDI numbers: A0 to C8.
export const LOWEST = 21;
export const HIGHEST = 108;

export function onThePiano(midi: number): boolean {
    return midi >= LOWEST && midi <= HIGHEST;
}

// The note moved into range by whole octaves, which is the only move that keeps it the same
// note. Unchanged where it already fits.
export function ontoThePiano(midi: number): number {
    let moved = midi;
    while (moved < LOWEST) {
        moved += 12;
    }
    while (moved > HIGHEST) {
        moved -= 12;
    }
    return moved;
}

// How far outside the keyboard a note falls, in semitones; zero for a note that fits.
export function beyondThePiano(midi: number): number {
    if (midi < LOWEST) {
        return LOWEST - midi;
    }
    return midi > HIGHEST ? midi - HIGHEST : 0;
}

// Past this, a note is not one written in the wrong octave — it is not the music at all.
//
// An octave is the whole of the doubt: a transcriber writing a bass an octave low lands
// within one, and a phantom voice three to five octaves above the chord it is attached to
// does not. Measured against the catalogue, every genuine slip sits within eight semitones
// of the bottom A, and the one corrupt score carries notes seventeen semitones above the
// top C.
export const BEYOND_REPAIR = 12;
