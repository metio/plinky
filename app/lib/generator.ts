// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generate a random C-major phrase as ABC for the sight-reading sprint, so the
// notes are fresh every run and can't be memorised. The rng is injectable for
// deterministic tests.

export type SprintKey = "C" | "G" | "F" | "D";

export type SprintOptions = {
    bars: number;
    beatsPerBar: number;
    twoHands: boolean;
    key?: SprintKey;
};

// Each key's five-finger position (tonic plus the next four major-scale degrees).
// The ABC key signature supplies the sharps and flats, so the scale is written
// with plain letters; C's position fits the computer keyboard's five keys per
// hand, the others are for reading practice with a MIDI or on-screen piano.
const KEYS: Record<SprintKey, { signature: string; treble: string[]; bass: string[] }> = {
    C: { signature: "C", treble: ["c", "d", "e", "f", "g"], bass: ["C", "D", "E", "F", "G"] },
    G: { signature: "G", treble: ["G", "A", "B", "c", "d"], bass: ["G,", "A,", "B,", "C", "D"] },
    F: { signature: "F", treble: ["F", "G", "A", "B", "c"], bass: ["F,", "G,", "A,", "B,", "C"] },
    D: { signature: "D", treble: ["D", "E", "F", "G", "A"], bass: ["D,", "E,", "F,", "G,", "A,"] },
};

export const SPRINT_KEYS = Object.keys(KEYS) as SprintKey[];

function line(scale: string[], bars: number, beatsPerBar: number, rng: () => number): string {
    const measures: string[] = [];
    for (let bar = 0; bar < bars; bar++) {
        const beats: string[] = [];
        for (let beat = 0; beat < beatsPerBar; beat++) {
            beats.push(scale[Math.floor(rng() * scale.length)]);
        }
        measures.push(beats.join(" "));
    }
    return `${measures.join(" | ")} |`;
}

export function generatePhrase(options: SprintOptions, rng: () => number = Math.random): string {
    const { bars, beatsPerBar, twoHands, key = "C" } = options;
    const scale = KEYS[key] ?? KEYS.C;
    if (!twoHands) {
        return `X:1\nT:Sprint\nM:${beatsPerBar}/4\nL:1/4\nK:${scale.signature}\n${line(scale.treble, bars, beatsPerBar, rng)}`;
    }
    const treble = line(scale.treble, bars, beatsPerBar, rng);
    const bass = line(scale.bass, bars, beatsPerBar, rng);
    return `X:1\nT:Sprint\nM:${beatsPerBar}/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:${scale.signature}\n${treble}\nV:2\n${bass}`;
}
