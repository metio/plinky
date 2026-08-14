// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The facts about note letters that every other module was quietly keeping its own
// copy of: which letters there are, how far each sits above C, and what a key
// signature does to them.
//
// These are not preferences or tuning knobs — they are the same in every piece of
// music ever written — so a second copy can only ever be a chance to disagree with
// the first. The generator, the exercise builder, the transposer, the MusicXML
// writer and the fingering scorer each had one.

import { pitchClass } from "./midi";
import type { NoteLabels } from "./prefs";

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

// Fixed-do solfège: which of the seven syllables a pitch class is named by, and
// whether it needs a sharp on top. Fixed-do (do is always C) is how the syllables
// are used across the Romance and Slavic traditions, where they are not a teaching
// aid but simply what the notes are called.
//
// The syllables themselves are not here: they are spelled differently from one
// language to the next (dó and ré in Portuguese, ré in French), so they live with
// the rest of the translated copy. This gives their index; the caller names them.
const SOLFEGE_DEGREE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

export type SolfegeName = { degree: number; sharp: boolean };

export function solfegeOf(midi: number): SolfegeName {
    const pc = ((midi % 12) + 12) % 12;
    const degree = SOLFEGE_DEGREE[pc] ?? 0;
    // A pitch class sharing its degree with the one below it is that note raised.
    return { degree, sharp: pc > 0 && SOLFEGE_DEGREE[pc - 1] === degree };
}

// What to print on a piano key, given how much naming the player has asked for. "all"
// letters every key; "c" prints only on the C keys, the landmark that orients a beginner;
// "solfege" names every key the way a reader raised on do-re-mi already thinks of it;
// "off" prints nothing. The solfège syllables are spelled differently from one language
// to the next, so this returns which syllable and the caller names it.
export type KeyLabel =
    | { kind: "letter"; letter: string }
    | { kind: "solfege"; degree: number; sharp: boolean }
    | null;

export function keyLabelOf(midi: number, labels: NoteLabels): KeyLabel {
    const pc = ((midi % 12) + 12) % 12;
    if (labels === "all") {
        return { kind: "letter", letter: pitchClass(midi) };
    }
    if (labels === "c") {
        return pc === 0 ? { kind: "letter", letter: "C" } : null;
    }
    if (labels === "solfege") {
        return { kind: "solfege", ...solfegeOf(midi) };
    }
    return null;
}

// The MIDI number for a written pitch. Octave 4 holds middle C (MIDI 60), the
// convention MusicXML and every module here already assume.
export function midiOf(step: string, octave: number, alter = 0): number {
    return (octave + 1) * 12 + (SEMITONE[step] ?? 0) + alter;
}
