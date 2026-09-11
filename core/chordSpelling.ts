// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ChordSpan } from "./harmony";
import { alterOnto, LETTERS, octaveOf, spellInKey } from "./notes";
import {
    type ChordQuality,
    chordLetterSteps,
    chordPitches,
    type PitchClass,
    pitchClassOf,
} from "./theory";

// How a chord read off a piece is written down, tone by tone.
//
// A chord's letters come from the chord, and its accidentals from the notes. The root sits
// on the letter of its degree in the key — the dominant of D minor is on A, its leading
// tone on C — and every other tone a fixed number of letters above the root, so a third is
// always two letters up. Only then does the pitch decide the accidental. That is how a
// score writes them: the dominant of D minor holds C♯ under a one-flat signature, the
// leading-tone seventh of G minor is F♯–A–C–E♭, and a chord in F♯ major is spelled with
// sharps however many of them it takes. One sharp-or-flat choice for the whole key gets
// every one of those wrong.

export type Spelling = { step: string; alter: number };

type SpelledKey = { tonic: PitchClass; mode: ChordSpan["key"]["mode"]; fifths: number };
type Chord = { root: PitchClass; quality: ChordQuality; key: SpelledKey };

// The degree a chromatic step above the tonic is written on: the minor and major forms of
// the second, third, sixth and seventh share a letter, and the tritone is the raised fourth.
const DEGREE_OF_STEP = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

// The letter of the key's tonic, as an index into LETTERS. Each sharp in the signature
// moves the major tonic a fifth — four letters — up, and the relative minor sits five
// letters above its major.
function tonicLetter(key: SpelledKey): number {
    const major = (((key.fifths * 4) % 7) + 7) % 7;
    return key.mode === "major" ? major : (major + 5) % 7;
}

// The accidental that puts the letter at an index into LETTERS on a pitch class.
const alterOntoLetter = (pitchClass: number, letter: number): number =>
    alterOnto(pitchClass, LETTERS[letter] ?? "C");

function rootLetter(chord: Chord): number {
    const step = pitchClassOf(chord.root - chord.key.tonic);
    return (tonicLetter(chord.key) + (DEGREE_OF_STEP[step] ?? 0)) % 7;
}

// The chord stacked on a root letter: each tone its number of letters above it.
function onLetter(chord: Chord, root: number): Spelling[] {
    const letters = chordLetterSteps(chord.quality);
    return chordPitches(chord.root, chord.quality).map((pitch, index) => {
        const letter = (root + (letters[index] ?? 0)) % 7;
        return {
            step: LETTERS[letter] ?? "C",
            alter: alterOntoLetter(pitchClassOf(pitch), letter),
        };
    });
}

// The chord's tones, spelled, in the order chordPitches stacks them: root, third, fifth…
//
// The root's degree letter comes first. Where that would push a tone past a double sharp or
// flat — an augmented chord on the raised fourth of F♯ minor would need an F triple sharp —
// the whole chord moves to the root's nearest other name, C–E–G♯, so its letters still
// stack in thirds rather than one tone leaping to a letter of its own.
export function spellChord(chord: Chord): Spelling[] {
    const degree = rootLetter(chord);
    const root = pitchClassOf(chord.root);
    const others = [0, 1, 2, 3, 4, 5, 6]
        .filter((letter) => letter !== degree)
        .sort((a, b) => Math.abs(alterOntoLetter(root, a)) - Math.abs(alterOntoLetter(root, b)));
    for (const letter of [degree, ...others]) {
        const spelled = onLetter(chord, letter);
        if (spelled.every((tone) => Math.abs(tone.alter) <= 2)) {
            return spelled;
        }
    }
    // No stack in CHORD_STACKS gets here: every root has a name within one accidental, and
    // every tone above it is then within two. The degree's own stack keeps the return total.
    return onLetter(chord, degree);
}

// A sounding pitch as the chord writes it, with the octave its letter is in: B♯3 sounds
// as middle C and C♭4 as the B below it, so the octave follows the letter, not the key. A
// tone of the chord takes the chord's spelling; a note outside it, the key's.
export function spellChordPitch(
    chord: Chord,
    midi: number,
): { step: string; alter: number; octave: number } {
    const sounding = Math.round(midi);
    const at = chordPitches(chord.root, chord.quality)
        .map(pitchClassOf)
        .indexOf(pitchClassOf(sounding));
    const spelled = at >= 0 ? spellChord(chord)[at] : undefined;
    if (!spelled) {
        return spellInKey(sounding, chord.key.fifths);
    }
    return { ...spelled, octave: octaveOf(sounding, spelled.step, spelled.alter) };
}

// One pitch class as the chord writes it, without an octave.
export function spellChordTone(chord: Chord, pitchClass: number): Spelling {
    const { step, alter } = spellChordPitch(chord, pitchClass);
    return { step, alter };
}
