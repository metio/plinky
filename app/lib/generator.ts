// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generate a random five-finger phrase as MusicXML for the sight-reading sprint,
// so the notes are fresh every run and can't be memorised, and render on the same
// OSMD engine as every other piece. The rng is injectable for deterministic tests.

import { alterFor, type BuiltPitch, buildScore } from "./musicxmlBuild";

export type SprintKey = "C" | "G" | "F" | "D";

export type SprintOptions = {
    bars: number;
    beatsPerBar: number;
    twoHands: boolean;
    key?: SprintKey;
};

type Position = { step: string; octave: number };

// "C5 D5 E5" → positions. The octaves place the right hand around C5 and the left
// around C4, matching the computer keyboard's two key rows.
function positions(spec: string): Position[] {
    return spec.split(" ").map((token) => ({
        step: token[0] ?? "C",
        octave: Number(token.slice(1)),
    }));
}

// Each key's five-finger position per hand, plus its key-signature fifths; the
// signature supplies the sharps and flats so the steps stay plain letters.
const KEYS: Record<SprintKey, { fifths: number; treble: Position[]; bass: Position[] }> = {
    C: { fifths: 0, treble: positions("C5 D5 E5 F5 G5"), bass: positions("C4 D4 E4 F4 G4") },
    G: { fifths: 1, treble: positions("G4 A4 B4 C5 D5"), bass: positions("G3 A3 B3 C4 D4") },
    F: { fifths: -1, treble: positions("F4 G4 A4 B4 C5"), bass: positions("F3 G3 A3 B3 C4") },
    D: { fifths: 2, treble: positions("D4 E4 F4 G4 A4"), bass: positions("D3 E3 F3 G3 A3") },
};

function line(scale: Position[], count: number, fifths: number, rng: () => number): BuiltPitch[] {
    const notes: BuiltPitch[] = [];
    for (let i = 0; i < count; i++) {
        const position = scale[Math.floor(rng() * scale.length)] ?? scale[0];
        const at = position ?? { step: "C", octave: 4 };
        notes.push({ step: at.step, octave: at.octave, alter: alterFor(at.step, fifths) });
    }
    return notes;
}

export function generatePhrase(options: SprintOptions, rng: () => number = Math.random): string {
    const { bars, beatsPerBar, twoHands, key = "C" } = options;
    const scale = KEYS[key] ?? KEYS.C;
    const count = bars * beatsPerBar;
    return buildScore({
        title: "Sprint",
        fifths: scale.fifths,
        beatsPerBar,
        treble: line(scale.treble, count, scale.fifths, rng),
        bass: twoHands ? line(scale.bass, count, scale.fifths, rng) : undefined,
    });
}
