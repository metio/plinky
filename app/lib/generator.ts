// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generate a random C-major phrase as ABC for the sight-reading sprint, so the
// notes are fresh every run and can't be memorised. The rng is injectable for
// deterministic tests.

export type SprintOptions = {
    bars: number;
    beatsPerBar: number;
    twoHands: boolean;
};

// C major five-finger position (C–G), so generated drills fit the computer
// keyboard's five keys per hand. Lowercase is the treble octave (around C5),
// uppercase the bass octave (around C4) an octave below.
const TREBLE = ["c", "d", "e", "f", "g"];
const BASS = ["C", "D", "E", "F", "G"];

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
    const { bars, beatsPerBar, twoHands } = options;
    if (!twoHands) {
        return `X:1\nT:Sprint\nM:${beatsPerBar}/4\nL:1/4\nK:C\n${line(TREBLE, bars, beatsPerBar, rng)}`;
    }
    const treble = line(TREBLE, bars, beatsPerBar, rng);
    const bass = line(BASS, bars, beatsPerBar, rng);
    return `X:1\nT:Sprint\nM:${beatsPerBar}/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\n${treble}\nV:2\n${bass}`;
}
