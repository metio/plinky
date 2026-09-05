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
export const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

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

// The sounding pitch a MusicXML <pitch> element writes, as a MIDI number, or null when
// it names no letter or an unreadable alteration or octave. An absent octave reads as 4,
// the octave middle C sits in. The one reader every walk over the notation shares — the
// arithmetic was written six times and had begun to disagree about an absent octave.
export function pitchMidiOf(pitch: Element): number | null {
    const first = (tag: string): string | null =>
        pitch.getElementsByTagName(tag)[0]?.textContent?.trim() ?? null;
    const step = (first("step") ?? "").toUpperCase();
    if (SEMITONE[step] === undefined) {
        return null;
    }
    const octaveText = first("octave");
    const octave = octaveText === null || octaveText === "" ? 4 : Number(octaveText);
    const alter = Number(first("alter") ?? "0");
    if (!Number.isFinite(octave) || !Number.isFinite(alter)) {
        return null;
    }
    return midiOf(step, octave, alter);
}

// How each of the twelve pitch classes is written, sharp-side and flat-side.
//
// Both are needed and neither is "correct": the same key is A♯ climbing and B♭ falling, and
// a scale that mixes them reads as a mistake. Held here beside the other facts about
// letters, because a second copy of a spelling table is a chance for two parts of the app
// to disagree about what note somebody just played.
export const SHARP_SPELL: readonly { step: string; alter: number }[] = [
    { step: "C", alter: 0 },
    { step: "C", alter: 1 },
    { step: "D", alter: 0 },
    { step: "D", alter: 1 },
    { step: "E", alter: 0 },
    { step: "F", alter: 0 },
    { step: "F", alter: 1 },
    { step: "G", alter: 0 },
    { step: "G", alter: 1 },
    { step: "A", alter: 0 },
    { step: "A", alter: 1 },
    { step: "B", alter: 0 },
];

export const FLAT_SPELL: readonly { step: string; alter: number }[] = [
    { step: "C", alter: 0 },
    { step: "D", alter: -1 },
    { step: "D", alter: 0 },
    { step: "E", alter: -1 },
    { step: "E", alter: 0 },
    { step: "F", alter: 0 },
    { step: "G", alter: -1 },
    { step: "G", alter: 0 },
    { step: "A", alter: -1 },
    { step: "A", alter: 0 },
    { step: "B", alter: -1 },
    { step: "B", alter: 0 },
];

// A MIDI number written out: which letter, how it is altered, which octave.
//
// The rounding is not defensive tidiness. A pitch is a whole semitone by the time it reaches
// notation, but one can arrive fractional from a shared take — the code carries whatever was
// encoded — and a fractional index into the table returns nothing, so an export threw on a
// link somebody had sent rather than refusing it politely.
export function spellMidi(
    midi: number,
    flats = false,
): { step: string; alter: number; octave: number } {
    const semitone = Math.round(midi);
    const pitchClass = ((semitone % 12) + 12) % 12;
    const { step, alter } = (flats ? FLAT_SPELL : SHARP_SPELL)[pitchClass]!;
    return { step, alter, octave: Math.floor(semitone / 12) - 1 };
}
