// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { spellChord, spellChordPitch, spellChordTone, type Spelling } from "./chordSpelling";
import type { ChordSpan } from "./harmony";
import type { ChordQuality } from "./theory";

// A spelling as it is read: letter, then # or b per alter.
const name = ({ step, alter }: Spelling) =>
    `${step}${alter > 0 ? "#".repeat(alter) : "b".repeat(-alter)}`;

const major = (tonic: number, fifths: number) => ({ tonic, mode: "major" as const, fifths });
const minor = (tonic: number, fifths: number) => ({ tonic, mode: "minor" as const, fifths });

const chord = (root: number, quality: ChordQuality, key: ChordSpan["key"]) =>
    spellChord({ root, quality, key }).map(name);

describe("spellChord", () => {
    it("writes a flat minor key's dominant with the sharp its leading tone carries", () => {
        // D minor, one flat: V is A–C♯–E, V7 adds G, vii°7 is C♯–E–G–B♭.
        expect(chord(9, "major", minor(2, -1))).toEqual(["A", "C#", "E"]);
        expect(chord(9, "dominant-seventh", minor(2, -1))).toEqual(["A", "C#", "E", "G"]);
        expect(chord(1, "diminished-seventh", minor(2, -1))).toEqual(["C#", "E", "G", "Bb"]);
    });

    it("writes G minor's dominant with F♯", () => {
        expect(chord(2, "major", minor(7, -2))).toEqual(["D", "F#", "A"]);
        expect(chord(6, "diminished", minor(7, -2))).toEqual(["F#", "A", "C"]);
    });

    it("spells the sharpest keys with sharps and the flattest with flats", () => {
        expect(chord(6, "major", major(6, 6))).toEqual(["F#", "A#", "C#"]);
        expect(chord(1, "major", major(1, 7))).toEqual(["C#", "E#", "G#"]);
        // C♯ major's dominant seventh: G♯–B♯–D♯–F♯.
        expect(chord(8, "dominant-seventh", major(1, 7))).toEqual(["G#", "B#", "D#", "F#"]);
        expect(chord(6, "major", major(6, -6))).toEqual(["Gb", "Bb", "Db"]);
        expect(chord(11, "major", major(11, -7))).toEqual(["Cb", "Eb", "Gb"]);
        // D♯ minor, six sharps, and its leading-tone seventh on C𝄪.
        expect(chord(3, "minor", minor(3, 6))).toEqual(["D#", "F#", "A#"]);
        expect(chord(2, "diminished-seventh", minor(3, 6))).toEqual(["C##", "E#", "G#", "B"]);
    });

    it("keeps the spellings a plain key already had", () => {
        expect(chord(0, "major", major(0, 0))).toEqual(["C", "E", "G"]);
        expect(chord(7, "dominant-seventh", major(0, 0))).toEqual(["G", "B", "D", "F"]);
        expect(chord(3, "major", major(3, -3))).toEqual(["Eb", "G", "Bb"]);
        expect(chord(4, "major", minor(9, 0))).toEqual(["E", "G#", "B"]);
    });

    it("writes the upper tones on their own letters", () => {
        expect(chord(0, "suspended-fourth", major(0, 0))).toEqual(["C", "F", "G"]);
        expect(chord(0, "suspended-second", major(0, 0))).toEqual(["C", "D", "G"]);
        expect(chord(0, "major-sixth", major(0, 0))).toEqual(["C", "E", "G", "A"]);
        expect(chord(0, "dominant-ninth", major(0, 0))).toEqual(["C", "E", "G", "Bb", "D"]);
        expect(chord(8, "augmented", minor(0, -3))).toEqual(["Ab", "C", "E"]);
    });

    it("moves a chord to its root's other name rather than write a triple accidental", () => {
        // C augmented in F♯ minor sits on the raised fourth, B♯, whose fifth would be F♯♯♯.
        expect(chord(0, "augmented", minor(6, 3))).toEqual(["C", "E", "G#"]);
        // A diminished seventh in A♭ major would be B𝄫–D♭–F♭–A♭♭♭ on its degree's letter.
        expect(chord(9, "diminished-seventh", major(8, -4))).toEqual(["A", "C", "Eb", "Gb"]);
    });
});

describe("spellChordTone", () => {
    it("spells a chord's bass as the chord spells that tone", () => {
        expect(name(spellChordTone({ root: 9, quality: "major", key: minor(2, -1) }, 1))).toBe(
            "C#",
        );
    });

    it("spells a note outside the chord by the key signature, or the signature's side", () => {
        const dMinorTonic = { root: 2, quality: "minor" as const, key: minor(2, -1) };
        expect(name(spellChordTone(dMinorTonic, 10))).toBe("Bb");
        expect(name(spellChordTone(dMinorTonic, 8))).toBe("Ab");
        const aMajorTonic = { root: 9, quality: "major" as const, key: major(9, 3) };
        expect(name(spellChordTone(aMajorTonic, 3))).toBe("D#");
    });
});

describe("spellChordPitch", () => {
    it("puts a letter spelled across the octave line in the letter's own octave", () => {
        // C♯ major's B♯ sounds as C: B♯3 is MIDI 60.
        const dominant = { root: 8, quality: "dominant-seventh" as const, key: major(1, 7) };
        expect(spellChordPitch(dominant, 60)).toEqual({ step: "B", alter: 1, octave: 3 });
        // C♭ major's tonic sounds as B: C♭4 is MIDI 59.
        const tonic = { root: 11, quality: "major" as const, key: major(11, -7) };
        expect(spellChordPitch(tonic, 59)).toEqual({ step: "C", alter: -1, octave: 4 });
    });
});
