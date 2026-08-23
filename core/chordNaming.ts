// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the hands are holding, named.
//
// The theory page already names a chord you PICK from a list, which answers "what does a
// minor seventh sound like". This answers the question a player actually asks at the
// keyboard — "what is this thing I just found?" — which is the one nobody can look up,
// because you cannot search for a sound you cannot name.
//
// Pure arithmetic over MIDI numbers: no clock, no audio, no notation. The same function
// serves a live readout while somebody noodles, a caption under a recorded take, and a
// test.

import {
    type ChordQuality,
    CHORD_QUALITIES,
    chordPitches,
    type IntervalId,
    intervalIdOf,
    type PitchClass,
    pitchClassOf,
    SEMITONES_PER_OCTAVE,
} from "./theory";

export type HeldSound =
    | { kind: "note"; pitchClass: PitchClass }
    // Two notes are an interval, not a chord: naming C+G "C major with a note missing"
    // would tell a beginner something false about what they are hearing.
    | { kind: "interval"; interval: IntervalId; lower: PitchClass }
    | {
          kind: "chord";
          root: PitchClass;
          quality: ChordQuality;
          // 0 root position, 1 first inversion, and so on — which chord tone is underneath
          // everything else. The same three notes are a different thing to play depending
          // on what the left hand has, so the readout says which one it is.
          inversion: number;
          // The note actually underneath, which is what a chart writes after the slash.
          // Carried rather than recomputed: working it back out of the root and the
          // inversion means knowing the quality's stack, and getting that wrong names the
          // wrong bass on every chord that is not the one you tested.
          bass: PitchClass;
      };

// The pitch classes of a chord's stack, in the order the stack builds them.
const stackClasses = (quality: ChordQuality): PitchClass[] =>
    chordPitches(0, quality).map((step) => step % SEMITONES_PER_OCTAVE);

const sameSet = (one: readonly number[], other: readonly number[]): boolean =>
    one.length === other.length && one.every((value, index) => value === other[index]);

// Names a set of sounding MIDI notes.
//
// Octaves and doublings fold away first: a chord voiced across two hands with the root
// doubled is the same chord as the one under three fingers, and a reader is asking what
// it IS, not how many of it there are.
//
// Returns null for silence, and for a set of notes that is not one of the qualities the
// app teaches — which is honest. A tone cluster has a name in some theory somewhere, but
// not one worth showing to somebody learning what a triad is.
export function nameHeldNotes(pitches: readonly number[]): HeldSound | null {
    if (pitches.length === 0) {
        return null;
    }
    const classes = [...new Set(pitches.map(pitchClassOf))].sort((a, b) => a - b);
    const bass = pitchClassOf(Math.min(...pitches));

    if (classes.length === 1) {
        return { kind: "note", pitchClass: classes[0]! };
    }
    if (classes.length === 2) {
        // Measured from the lowest sounding note, so a fifth played low reads as a fifth
        // rather than as its inversion.
        const other = classes.find((value) => value !== bass) ?? bass;
        return {
            kind: "interval",
            interval: intervalIdOf((other - bass + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE),
            lower: bass,
        };
    }

    const matches: { root: PitchClass; quality: ChordQuality; inversion: number }[] = [];
    for (const root of classes) {
        const relative = classes
            .map((value) => (value - root + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE)
            .sort((a, b) => a - b);
        for (const quality of CHORD_QUALITIES) {
            const stack = stackClasses(quality);
            if (
                !sameSet(
                    relative,
                    [...stack].sort((a, b) => a - b),
                )
            ) {
                continue;
            }
            const inversion = stack.indexOf(
                bass >= root ? bass - root : bass - root + SEMITONES_PER_OCTAVE,
            );
            matches.push({ root, quality, inversion: inversion < 0 ? 0 : inversion });
        }
    }
    if (matches.length === 0) {
        return null;
    }
    // A diminished seventh is four minor thirds and an augmented triad three major ones,
    // so every rotation of them is the same set of notes and every note in one has an
    // equal claim to being the root. Nothing in the notes themselves settles it — only
    // the music around them does — so the lowest sounding note gets the name, which is
    // how a player reading their own hands would say it.
    const rooted = matches.find((match) => match.root === bass) ?? matches[0]!;
    return { kind: "chord", ...rooted, bass };
}
