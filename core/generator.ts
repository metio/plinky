// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generate a random five-finger phrase as MusicXML for sight-reading, so the notes
// are fresh every run and can't be memorised, and render on the same OSMD engine as
// every other piece. The rng is injectable for deterministic tests.

import { alterFor, type BuiltNote, type BuiltPitch, buildScore, RHYTHM } from "./musicxmlBuild";

export type SprintKey = "C" | "G" | "F" | "D";

// "quarters" is one note per beat — the simplest read. "varied" mixes in on-beat
// eighth pairs and half notes so the timing has something to read against.
export type Rhythm = "quarters" | "varied";

export type SprintOptions = {
    bars: number;
    beatsPerBar: number;
    twoHands: boolean;
    key?: SprintKey;
    // The work-title written into the score; defaults to "Sprint".
    title?: string;
    // The rhythmic texture of the phrase; defaults to all quarters.
    rhythm?: Rhythm;
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

function pickPitch(scale: Position[], fifths: number, rng: () => number): BuiltPitch {
    const at = scale[Math.floor(rng() * scale.length)] ?? scale[0] ?? { step: "C", octave: 4 };
    return { step: at.step, octave: at.octave, alter: alterFor(at.step, fifths) };
}

// One note per beat, all quarters.
function quarterLine(
    scale: Position[],
    count: number,
    fifths: number,
    rng: () => number,
): BuiltNote[] {
    return Array.from({ length: count }, () => ({
        pitch: pickPitch(scale, fifths, rng),
        value: "quarter" as const,
    }));
}

// One measure of mixed rhythm. Eighths come in on-beat pairs and the half spans two
// beats, so notes never cross a barline and the reading stays beginner-simple — no
// syncopation, dotted notes or ties. The measure fills to exactly a barful.
function variedMeasure(
    scale: Position[],
    beatsPerBar: number,
    fifths: number,
    rng: () => number,
): BuiltNote[] {
    const target = beatsPerBar * RHYTHM.quarter.divisions;
    const notes: BuiltNote[] = [];
    let filled = 0;
    const push = (value: BuiltNote["value"]) => {
        notes.push({ pitch: pickPitch(scale, fifths, rng), value });
        filled += RHYTHM[value].divisions;
    };
    while (filled < target) {
        const roll = rng();
        if (target - filled >= RHYTHM.half.divisions && roll < 0.15) {
            push("half");
        } else if (roll < 0.4) {
            push("eighth");
            push("eighth");
        } else {
            push("quarter");
        }
    }
    return notes;
}

function variedLine(
    scale: Position[],
    bars: number,
    beatsPerBar: number,
    fifths: number,
    rng: () => number,
): BuiltNote[] {
    const notes: BuiltNote[] = [];
    for (let bar = 0; bar < bars; bar++) {
        notes.push(...variedMeasure(scale, beatsPerBar, fifths, rng));
    }
    return notes;
}

export function generatePhrase(options: SprintOptions, rng: () => number = Math.random): string {
    const {
        bars,
        beatsPerBar,
        twoHands,
        key = "C",
        title = "Sprint",
        rhythm = "quarters",
    } = options;
    const scale = KEYS[key] ?? KEYS.C;
    const line = (hand: Position[]): BuiltNote[] =>
        rhythm === "varied"
            ? variedLine(hand, bars, beatsPerBar, scale.fifths, rng)
            : quarterLine(hand, bars * beatsPerBar, scale.fifths, rng);
    return buildScore({
        title,
        fifths: scale.fifths,
        beatsPerBar,
        treble: line(scale.treble),
        bass: twoHands ? line(scale.bass) : undefined,
    });
}
