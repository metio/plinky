// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { midiOf } from "./notes";
import { SEMITONE } from "./notes";
import type { XmlCodec } from "./xml";
import { LETTERS } from "./notes";
// Transposes a score's MusicXML up or down by a number of semitones, client-side,
// so a piece can be practised in a more comfortable key. Every <pitch> is respelled
// and every key signature shifts with it, the way a transposing edition is printed —
// not just nudged chromatically. OSMD then renders, plays and matches the new key.

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// How a transposition is written: how many letters every note moves up within the octave,
// and how far the key signature moves round the circle of fifths.
export type KeyShift = { letterSteps: number; fifthsDelta: number };

// The spelling of a transposition, chosen once for the whole piece from the key it opens in.
// The engraver moves every note and every signature by it, and the marks read off the file
// move their keys by it, so the key a surface names is the one the page prints.
//
// Each interval has one signature move per enharmonic name, twelve fifths apart: up a
// semitone is a minor second (C to D♭, five flats) or an augmented unison (C to C♯, seven
// sharps). The one that leaves the opening key nearest C is taken, so a sharp key moved up
// does not land on a ten-sharp signature; between two equally near, the smaller move, which
// is the plainer interval. The letters follow from the move, four to each fifth, counted the
// way whose natural span is nearest the interval: B♯ is one letter below C, not six above.
// A whole number of octaves keeps the spelling the piece had.
export function keyShift(openingFifths: number, semitones: number): KeyShift {
    const base = ((semitones % 12) + 12) % 12;
    if (base === 0) {
        return { letterSteps: 0, fifthsDelta: 0 };
    }
    const move = (base * 7) % 12;
    const fifthsDelta = [move - 12, move, move + 12].reduce((best, candidate) => {
        const nearer = Math.abs(openingFifths + candidate) - Math.abs(openingFifths + best);
        if (nearer !== 0) {
            return nearer < 0 ? candidate : best;
        }
        // Six sharps against six flats: the tritone as the augmented fourth.
        const smaller = Math.abs(candidate) - Math.abs(best);
        return smaller < 0 || (smaller === 0 && candidate > best) ? candidate : best;
    });
    const letters = (((fifthsDelta * 4) % 7) + 7) % 7;
    const letterSteps = [letters - 7, letters, letters + 7].reduce((best, candidate) =>
        Math.abs(base - (candidate * 12) / 7) < Math.abs(base - (best * 12) / 7) ? candidate : best,
    );
    return { letterSteps, fifthsDelta };
}

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

// The pitches a `<harmony>` names: its root and the bass under it, each a step with an
// optional alter and no octave. A `<degree>` is left alone, because its alter is measured
// from the chord rather than from C — the flat ninth of C7♭9 is still the flat ninth of D7♭9.
const HARMONY_PITCHES = [
    ["root", "root-step", "root-alter"],
    ["bass", "bass-step", "bass-alter"],
] as const;

// One chord-symbol pitch moved the way a note is: the letter by the same number of steps,
// the accidental by whatever bridges the new letter to the moved pitch class — so C over E
// a major second up reads D over F♯, as the transposed bass note under it does.
function moveHarmonyPitch(
    doc: Document,
    holder: Element,
    stepTag: string,
    alterTag: string,
    letterSteps: number,
    semitones: number,
): void {
    const stepNode = holder.querySelector(stepTag);
    const step = stepNode?.textContent?.trim() ?? "";
    const letter = LETTER_INDEX[step];
    const semitone = SEMITONE[step];
    const alterNode = holder.querySelector(alterTag);
    const alter = Number(alterNode?.textContent ?? "0");
    if (!stepNode || letter === undefined || semitone === undefined || !Number.isFinite(alter)) {
        return;
    }
    const newLetter = LETTERS[(((letter + letterSteps) % 7) + 7) % 7] ?? "C";
    // With no octave to carry, the accidental is the smallest one that reaches the moved
    // pitch class from the new letter: -6 to 5, and in practice within a double either way.
    const gap = semitone + alter + semitones - (SEMITONE[newLetter] ?? 0);
    const newAlter = (((gap % 12) + 18) % 12) - 6;
    stepNode.textContent = newLetter;
    // A `text` attribute prints a name in place of the step (H for B); it named the old one.
    stepNode.removeAttribute("text");
    if (newAlter === 0) {
        alterNode?.remove();
    } else if (alterNode) {
        alterNode.textContent = String(newAlter);
    } else {
        const element = doc.createElement(alterTag);
        element.textContent = String(newAlter);
        stepNode.after(element);
    }
}

export function transposeMusicXml(codec: XmlCodec, xml: string, semitones: number): string {
    if (semitones === 0) {
        return xml;
    }
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }

    // Split the shift into a letter-name move within the octave plus whole octaves, spelled
    // the way that lands this piece's key closest to C.
    const base = ((semitones % 12) + 12) % 12;
    const octaveShift = (semitones - base) / 12;
    const { letterSteps, fifthsDelta } = keyShift(initialFifths(doc), semitones);
    const stepShift = letterSteps + 7 * octaveShift;

    for (const pitch of doc.querySelectorAll("note > pitch")) {
        const step = pitch.querySelector("step")?.textContent?.trim() ?? "";
        const letter = LETTER_INDEX[step];
        const semitone = SEMITONE[step];
        if (letter === undefined || semitone === undefined) {
            continue;
        }
        const octave = Number(pitch.querySelector("octave")?.textContent ?? "4");
        const alter = Number(pitch.querySelector("alter")?.textContent ?? "0");
        const midi = midiOf(step, octave, alter);

        const movedLetter = letter + stepShift;
        // The index is reduced into 0–6, so a letter is always found; the ?? only
        // satisfies the no-unchecked-index rule.
        const newLetter = LETTERS[((movedLetter % 7) + 7) % 7] ?? "C";
        const newOctave = octave + Math.floor(movedLetter / 7);
        // The chromatic pitch moves by the exact semitone count; the new accidental
        // is whatever bridges the new letter at the new octave to that pitch.
        const newMidi = midi + semitones;
        const newAlter = newMidi - ((newOctave + 1) * 12 + (SEMITONE[newLetter] ?? 0));

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

    // A written chord symbol moves with the notes under it, spelled by the same rule.
    for (const [holderTag, stepTag, alterTag] of HARMONY_PITCHES) {
        for (const holder of doc.querySelectorAll(`harmony > ${holderTag}`)) {
            moveHarmonyPitch(doc, holder, stepTag, alterTag, letterSteps, semitones);
        }
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
