// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The music-theory vocabulary the ear exercises are built from: pitch classes, note
// names and intervals, all as plain MIDI-note arithmetic.
//
// Everything here names things with identifiers ("minor-third"), never with words. A
// name is a translated string and this layer is pure, so the app maps an id to a
// paraglide message at the edge. That split is what lets an exercise ask its question
// in 26 languages while the answer checking stays language-neutral.
//
// The vocabulary grows with the exercises that need it: chords, scales and scale
// degrees belong here too, and arrive with the rounds that ask about them.

export const SEMITONES_PER_OCTAVE = 12;

// 0 = C, 1 = C♯/D♭, … 11 = B.
export type PitchClass = number;

export function pitchClassOf(midi: number): PitchClass {
    return ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
}

// ---------------------------------------------------------------------------
// Note names
// ---------------------------------------------------------------------------

// A black key has two names for the same sound, and which one is right depends on the
// key you're in. Nothing establishes a key for a bare note, so a pitch class can be
// spelled either way and the caller picks.
export type Spelling = "sharp" | "flat";

export type NoteNameId =
    | "c"
    | "c-sharp"
    | "d-flat"
    | "d"
    | "d-sharp"
    | "e-flat"
    | "e"
    | "f"
    | "f-sharp"
    | "g-flat"
    | "g"
    | "g-sharp"
    | "a-flat"
    | "a"
    | "a-sharp"
    | "b-flat"
    | "b";

const SHARP_NAMES: NoteNameId[] = [
    "c",
    "c-sharp",
    "d",
    "d-sharp",
    "e",
    "f",
    "f-sharp",
    "g",
    "g-sharp",
    "a",
    "a-sharp",
    "b",
];

const FLAT_NAMES: NoteNameId[] = [
    "c",
    "d-flat",
    "d",
    "e-flat",
    "e",
    "f",
    "g-flat",
    "g",
    "a-flat",
    "a",
    "b-flat",
    "b",
];

export function noteNameOf(pitchClass: PitchClass, spelling: Spelling = "sharp"): NoteNameId {
    const names = spelling === "flat" ? FLAT_NAMES : SHARP_NAMES;
    return names[pitchClassOf(pitchClass)] ?? "c";
}

// The white keys, in the order a keyboard lays them out. A round that stays on the
// naturals filters with this.
export const NATURAL_PITCH_CLASSES: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

export type IntervalId =
    | "unison"
    | "minor-second"
    | "major-second"
    | "minor-third"
    | "major-third"
    | "perfect-fourth"
    | "tritone"
    | "perfect-fifth"
    | "minor-sixth"
    | "major-sixth"
    | "minor-seventh"
    | "major-seventh"
    | "octave";

// Indexed by semitone distance, so an interval's position in the array IS its size.
export const INTERVAL_IDS: IntervalId[] = [
    "unison",
    "minor-second",
    "major-second",
    "minor-third",
    "major-third",
    "perfect-fourth",
    "tritone",
    "perfect-fifth",
    "minor-sixth",
    "major-sixth",
    "minor-seventh",
    "major-seventh",
    "octave",
];

export function semitonesOf(interval: IntervalId): number {
    return INTERVAL_IDS.indexOf(interval);
}

// Intervals wider than an octave fold back to their simple form: a tenth is heard as a
// third, and asking for "a tenth" would test arithmetic rather than hearing. Compound
// intervals reduce; a plain octave stays an octave.
export function intervalIdOf(semitones: number): IntervalId {
    const size = Math.abs(Math.round(semitones));
    const simple = size % SEMITONES_PER_OCTAVE;
    if (simple === 0 && size > 0) {
        return "octave";
    }
    return INTERVAL_IDS[simple] ?? "unison";
}
