// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { STEP_SEMITONES } from "./pitch";
import type { XmlCodec } from "./xml";
// Transposes a score's MusicXML up or down by a number of semitones, client-side,
// so a piece can be practised in a more comfortable key. Every <pitch> is respelled
// and every key signature shifts with it, the way a transposing edition is printed —
// not just nudged chromatically. OSMD then renders, plays and matches the new key.

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// For each chromatic step within an octave, the candidate spellings as
// [letterSteps, fifthsDelta]: how far the note's letter name moves and how the key
// signature shifts on the circle of fifths. The ambiguous (chromatic) steps carry a
// second, enharmonic candidate — a tritone up is an augmented 4th (G→C♯, +6 fifths)
// or a diminished 5th (G→D♭, −6) — and the one that keeps the resulting key nearer C
// is chosen per piece, so transposing a sharp key doesn't land on a 10-sharp signature.
const SPELLINGS: Array<Array<[number, number]>> = [
    [[0, 0]], // unison
    [
        [1, -5], // minor 2nd
        [0, 7], // augmented unison
    ],
    [[1, 2]], // major 2nd
    [
        [2, -3], // minor 3rd
        [1, 9], // augmented 2nd
    ],
    [[2, 4]], // major 3rd
    [[3, -1]], // perfect 4th
    [
        [3, 6], // augmented 4th
        [4, -6], // diminished 5th
    ],
    [[4, 1]], // perfect 5th
    [
        [5, -4], // minor 6th
        [4, 8], // augmented 5th
    ],
    [[5, 3]], // major 6th
    [
        [6, -2], // minor 7th
        [5, 10], // augmented 6th
    ],
    [[6, 5]], // major 7th
];

// The signed key signature of the first key change, or 0 (C major / A minor) when a
// score carries none — the reference for choosing the spelling that stays in range.
function initialFifths(doc: Document): number {
    const fifths = doc.querySelector("key fifths")?.textContent?.trim();
    const value = Number(fifths);
    return Number.isFinite(value) ? value : 0;
}

function setAlter(doc: Document, pitch: Element, alter: number): void {
    const existing = pitch.querySelector("alter");
    if (alter === 0) {
        existing?.remove();
        return;
    }
    if (existing) {
        existing.textContent = String(alter);
        return;
    }
    // MusicXML fixes the order step → alter → octave, so a fresh alter sits before
    // the octave rather than appended after it.
    const element = doc.createElement("alter");
    element.textContent = String(alter);
    pitch.querySelector("octave")?.before(element);
}

export function transposeMusicXml(codec: XmlCodec, xml: string, semitones: number): string {
    if (semitones === 0) {
        return xml;
    }
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }

    // Split the shift into a letter-name move within the octave plus whole octaves,
    // then pick the spelling whose key signature lands closest to C for this piece.
    const base = ((semitones % 12) + 12) % 12;
    const octaveShift = (semitones - base) / 12;
    const fifths = initialFifths(doc);
    const candidates = SPELLINGS[base] ?? [[0, 0]];
    const [letterSteps, fifthsDelta] = candidates.reduce((best, candidate) =>
        Math.abs(fifths + candidate[1]) < Math.abs(fifths + best[1]) ? candidate : best,
    );
    const stepShift = letterSteps + 7 * octaveShift;

    for (const pitch of doc.querySelectorAll("note > pitch")) {
        const step = pitch.querySelector("step")?.textContent?.trim() ?? "";
        const letter = LETTER_INDEX[step];
        const semitone = STEP_SEMITONES[step];
        if (letter === undefined || semitone === undefined) {
            continue;
        }
        const octave = Number(pitch.querySelector("octave")?.textContent ?? "4");
        const alter = Number(pitch.querySelector("alter")?.textContent ?? "0");
        const midi = (octave + 1) * 12 + semitone + alter;

        const movedLetter = letter + stepShift;
        // The index is reduced into 0–6, so a letter is always found; the ?? only
        // satisfies the no-unchecked-index rule.
        const newLetter = LETTERS[((movedLetter % 7) + 7) % 7] ?? "C";
        const newOctave = octave + Math.floor(movedLetter / 7);
        // The chromatic pitch moves by the exact semitone count; the new accidental
        // is whatever bridges the new letter at the new octave to that pitch.
        const newMidi = midi + semitones;
        const newAlter = newMidi - ((newOctave + 1) * 12 + (STEP_SEMITONES[newLetter] ?? 0));

        const stepNode = pitch.querySelector("step");
        const octaveNode = pitch.querySelector("octave");
        if (stepNode) {
            stepNode.textContent = newLetter;
        }
        if (octaveNode) {
            octaveNode.textContent = String(newOctave);
        }
        setAlter(doc, pitch, newAlter);
    }

    // Shift every key signature by the same amount so the printed key follows the
    // notes rather than leaving them awash in accidentals.
    for (const node of doc.querySelectorAll("key fifths")) {
        const current = Number(node.textContent ?? "0");
        if (Number.isFinite(current)) {
            node.textContent = String(current + fifthsDelta);
        }
    }

    return codec.serialize(doc);
}
