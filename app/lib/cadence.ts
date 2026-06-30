// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Letter } from "./grade";

// A short, always-major flourish played when a run finishes — the little "you did it"
// that the synth voices through scheduled note strikes. Finishing is always a win, so
// even the lowest grade gets a warm, encouraging lift, never anything that reads as a
// buzzer or a sad cadence; a stronger grade simply earns a fuller arpeggio. The notes
// sit in a fixed bright register (around C5) so the cadence is a consistent signature
// regardless of the piece's own key.
export type CadenceNote = {
    note: number; // MIDI note
    at: number; // seconds from the start of the cadence
    velocity: number; // 0..127
    duration: number; // seconds
};

const STEP = 0.11; // gap between successive strikes

// C-major over C5: the arpeggio everything is cut from. The last note rings longer and
// a touch louder so the flourish lands rather than trails off.
const C5 = 72;
const ARPEGGIO = [C5, C5 + 4, C5 + 7, C5 + 12]; // C E G C

function build(tones: number[]): CadenceNote[] {
    const last = tones.length - 1;
    return tones.map((note, index) => ({
        note,
        at: index * STEP,
        velocity: index === last ? 96 : 82,
        duration: index === last ? 1.1 : 0.5,
    }));
}

// The flourish for a finished run's grade: the full four-note rise for an aced run
// (S/A), a resolved triad for a solid one (B/C), and a gentle two-note lift for the
// rest — encouragement, never a penalty.
export function cadence(letter: Letter): CadenceNote[] {
    if (letter === "S" || letter === "A") {
        return build(ARPEGGIO);
    }
    if (letter === "B" || letter === "C") {
        return build(ARPEGGIO.slice(0, 3)); // C E G
    }
    return build([ARPEGGIO[0]!, ARPEGGIO[2]!]); // C G — a warm perfect fifth
}
