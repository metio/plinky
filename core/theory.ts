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

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

export type ChordQuality =
    | "major"
    | "minor"
    | "diminished"
    | "augmented"
    | "dominant-seventh"
    | "major-seventh"
    | "minor-seventh"
    | "half-diminished-seventh"
    | "diminished-seventh";

// The semitones a chord stacks above its root — the whole definition of its quality.
// A quality is what it sounds like whatever the root, so the ear names the stack.
const CHORD_STACKS: Record<ChordQuality, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    "dominant-seventh": [0, 4, 7, 10],
    "major-seventh": [0, 4, 7, 11],
    "minor-seventh": [0, 3, 7, 10],
    "half-diminished-seventh": [0, 3, 6, 10],
    "diminished-seventh": [0, 3, 6, 9],
};

export const CHORD_QUALITIES = Object.keys(CHORD_STACKS) as ChordQuality[];

// The sounding notes of a chord in root position, from a root MIDI note.
export function chordPitches(root: number, quality: ChordQuality): number[] {
    return CHORD_STACKS[quality].map((step) => root + step);
}

// How far the top of a chord sits above its root — the room the generator must leave.
export function chordSpan(quality: ChordQuality): number {
    return Math.max(...CHORD_STACKS[quality]);
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

export type ScaleId =
    | "major"
    | "natural-minor"
    | "harmonic-minor"
    | "melodic-minor"
    | "dorian"
    | "phrygian"
    | "lydian"
    | "mixolydian"
    | "major-pentatonic"
    | "minor-pentatonic"
    | "blues"
    | "whole-tone"
    | "chromatic";

// Semitones above the tonic, ascending, without the closing octave — the shape a scale
// is defined by. scalePitches adds the octave back so the run resolves.
const SCALE_STEPS: Record<ScaleId, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    "natural-minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
    // The ascending form; the descending melodic minor is natural minor, a property of
    // how it's played rather than of the scale's identity.
    "melodic-minor": [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    "major-pentatonic": [0, 2, 4, 7, 9],
    "minor-pentatonic": [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    "whole-tone": [0, 2, 4, 6, 8, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const SCALE_IDS = Object.keys(SCALE_STEPS) as ScaleId[];

// The scale as sounding notes from a tonic, closing on the octave above — a scale that
// stopped on its leading note would sound unfinished.
export function scalePitches(tonic: number, scale: ScaleId): number[] {
    return [...SCALE_STEPS[scale].map((step) => tonic + step), tonic + SEMITONES_PER_OCTAVE];
}

// ---------------------------------------------------------------------------
// Diatonic degrees (chords within a key)
// ---------------------------------------------------------------------------

// The seven triads a major key is built from, named by Roman numeral. The numeral is
// itself the identity — case carries the quality (upper is major, lower is minor) and the
// ° marks the diminished — and it reads the same in every language, so unlike a chord's
// spelled-out quality it is notation, not a word to translate.
export type ChordDegree = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii°";

export const CHORD_DEGREES: ChordDegree[] = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];

// Each degree's triad quality and the semitones its root sits above the key's tonic.
const DIATONIC_TRIADS: Record<ChordDegree, { quality: ChordQuality; step: number }> = {
    I: { quality: "major", step: 0 },
    ii: { quality: "minor", step: 2 },
    iii: { quality: "minor", step: 4 },
    IV: { quality: "major", step: 5 },
    V: { quality: "major", step: 7 },
    vi: { quality: "minor", step: 9 },
    "vii°": { quality: "diminished", step: 11 },
};

// The sounding notes of a degree's triad in a key with the given tonic — its root placed
// in the key, then stacked as its quality.
export function degreePitches(tonic: number, degree: ChordDegree): number[] {
    const { quality, step } = DIATONIC_TRIADS[degree];
    return chordPitches(tonic + step, quality);
}
