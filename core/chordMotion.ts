// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What happens between two chords.
//
// The lessons teach chords one at a time, which is where every course starts and where
// most players get stuck: knowing C and knowing F does not tell you why one follows the
// other easily and another change fights the hand. What answers that is the notes the two
// share and how far the rest have to move — and both are plain arithmetic that nobody
// shows you, because a chart of shapes cannot say anything about a pair.
//
// Pure: pitch numbers in, pitch numbers out. Nothing here knows what a key looks like or
// what language the reader has.

import { type PitchClass, pitchClassOf, SEMITONES_PER_OCTAVE } from "./theory";

// The pitch classes two chords have in common — the notes a hand can simply keep.
//
// By pitch class, not by sounding note: a C an octave up is the same note of the chord,
// and a player holding it does not move a finger either way.
export function commonTones(one: readonly number[], other: readonly number[]): PitchClass[] {
    const held = new Set(other.map(pitchClassOf));
    return [...new Set(one.map(pitchClassOf))].filter((value) => held.has(value)).sort((a, b) => a - b);
}

// How far one note has to move to become another, in semitones, by the shorter way round.
// A step from B to C is one semitone, not eleven — the hand takes the near route.
export function shortestStep(from: number, to: number): number {
    const distance = Math.abs(pitchClassOf(to) - pitchClassOf(from));
    return Math.min(distance, SEMITONES_PER_OCTAVE - distance);
}

export type Motion = {
    // The pitch classes both chords hold.
    common: PitchClass[];
    // Every note of the first chord paired with the note of the second it most easily
    // becomes, and how far that is. A note that stays put is a move of zero.
    moves: { from: PitchClass; to: PitchClass; semitones: number }[];
    // The total distance the hand travels, which is the number to compare two changes by.
    distance: number;
};

// The smoothest way to get from one chord to the other.
//
// Voice leading, which is the thing the ear actually notices: the same two chords can be
// a shuffle of the fingers or a leap, depending on which note goes where. This finds the
// pairing that moves least — trying every one of them, which for triads and sevenths is
// at most twenty-four and costs nothing.
//
// Chords of different sizes are paired as far as they go, shorter first, and the extra
// notes of the longer one are simply arrived at; a seventh added to a triad is a finger
// put down, not a finger moved.
export function smoothestMotion(one: readonly number[], other: readonly number[]): Motion {
    const from = [...new Set(one.map(pitchClassOf))].sort((a, b) => a - b);
    const to = [...new Set(other.map(pitchClassOf))].sort((a, b) => a - b);
    const common = commonTones(one, other);

    if (from.length === 0 || to.length === 0) {
        return { common, moves: [], distance: 0 };
    }

    // Pair the shorter list into the longer one, so every note that must move has
    // somewhere to go and nothing is counted twice.
    const [shorter, longer] = from.length <= to.length ? [from, to] : [to, from];
    const flipped = from.length > to.length;

    let best: { moves: Motion["moves"]; distance: number } | null = null;
    for (const choice of choices(longer, shorter.length)) {
        const moves = shorter.map((note, index) => {
            const partner = choice[index]!;
            const [start, end] = flipped ? [partner, note] : [note, partner];
            return { from: start, to: end, semitones: shortestStep(note, partner) };
        });
        const distance = moves.reduce((total, move) => total + move.semitones, 0);
        if (best === null || distance < best.distance) {
            best = { moves, distance };
        }
    }
    return { common, moves: best!.moves, distance: best!.distance };
}

// Every ordered selection of `size` items from `items`, which for a chord is every way of
// deciding which note becomes which.
function choices<T>(items: readonly T[], size: number): T[][] {
    if (size === 0) {
        return [[]];
    }
    return items.flatMap((item, index) =>
        choices(
            items.filter((_, other) => other !== index),
            size - 1,
        ).map((rest) => [item, ...rest]),
    );
}
