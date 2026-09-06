// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { keyForTonic } from "./circleOfFifths";
import { PROGRESSION_LEVELS } from "./earExercise";
import { keySlugFor } from "./exerciseGen";
import type { ChordSpan, Mode } from "./harmony";
import type { ChordDegree, PitchClass } from "./theory";

// What a piece is built on, in the terms that carry to the next piece.
//
// The chord symbols on the page say what each bar is; this says what the piece IS: its
// key, the handful of chords it uses, and the progression it keeps coming back to. Those
// are the things worth practising apart from the piece — the chord set of the key is on
// the shelf, and the ear drill can play the progression — so each is offered as somewhere
// to go.

export type PieceChords = {
    key: { tonic: PitchClass; mode: Mode };
    // The chords the piece uses, commonest first, with how many changes land on each.
    vocabulary: { numeral: string; count: number }[];
    // The four-chord loop the piece returns to most, as the triads under its numerals and
    // turned to start on I where I is in it — or null when the piece never settles into
    // one. Triads, because a loop is the same loop whether its V carries a seventh this
    // time round; and one rotation, because a loop has no first chord.
    progression: string[] | null;
    // The chord set on the shelf that drills this key's seven chords.
    chordSet: string | null;
    // The ear drill's progression level whose vocabulary covers this piece, or null for a
    // minor key (the drill plays major progressions) and for chords it never asks.
    earLevel: number | null;
};

const LOOP = 4;

export function summarizeChords(spans: readonly ChordSpan[]): PieceChords | null {
    const first = spans[0];
    if (!first) {
        return null;
    }
    const key = first.key;
    const counts = new Map<string, number>();
    // Changes, not beats: a chord held for four bars is one chord, and a piece that sits on
    // I for half its length is not "mostly I" in any sense a player needs.
    const changes: string[] = [];
    for (const span of spans) {
        if (span.key.tonic !== key.tonic || span.key.mode !== key.mode) {
            continue;
        }
        const numeral = span.numeral;
        if (changes[changes.length - 1] !== numeral) {
            changes.push(numeral);
            counts.set(numeral, (counts.get(numeral) ?? 0) + 1);
        }
    }
    const vocabulary = [...counts.entries()]
        .map(([numeral, count]) => ({ numeral, count }))
        .sort((a, b) => b.count - a.count || a.numeral.localeCompare(b.numeral));
    // The loop is read over the triads, with the duplicates that collapsing sevenths
    // creates folded again — I V7 V I is I V I.
    const triads: string[] = [];
    for (const numeral of changes.map(triadOf)) {
        if (triads[triads.length - 1] !== numeral) {
            triads.push(numeral);
        }
    }
    return {
        key,
        vocabulary,
        progression: commonLoop(triads),
        chordSet: chordSetFor(key),
        earLevel: key.mode === "major" ? earLevelFor(vocabulary.map((one) => one.numeral)) : null,
    };
}

// The four-chord window that recurs most, when it recurs at all. A progression is a loop
// by definition: one that appears once is a passage, not the piece's progression.
function commonLoop(changes: readonly string[]): string[] | null {
    const seen = new Map<string, number>();
    for (let at = 0; at + LOOP <= changes.length; at++) {
        const window = changes.slice(at, at + LOOP);
        // A window that repeats a chord is a shorter loop in disguise.
        if (new Set(window).size < LOOP) {
            continue;
        }
        const key = window.join(" ");
        seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    let best: [string, number] | null = null;
    for (const entry of seen) {
        if (best === null || entry[1] > best[1]) {
            best = entry;
        }
    }
    return best !== null && best[1] >= 2 ? canonical(best[0].split(" ")) : null;
}

// One rotation for one loop: starting on I where the loop has one, else on whichever
// rotation reads first — so I V vi IV and V vi IV I are the same progression on the shelf.
function canonical(loop: string[]): string[] {
    const rotations = loop.map((_, at) => [...loop.slice(at), ...loop.slice(0, at)]);
    const onTonic = rotations.find((one) => one[0] === "I" || one[0] === "i");
    if (onTonic) {
        return onTonic;
    }
    return rotations.sort((a, b) => a.join(" ").localeCompare(b.join(" ")))[0] ?? loop;
}

// The chord-set exercise for the key: "chords-c-major", "chords-a-minor". Null outside
// the twelve keys each mode ships.
export function chordSetFor(key: { tonic: PitchClass; mode: Mode }): string | null {
    const major = key.mode === "major" ? key.tonic : (key.tonic + 3) % 12;
    const circle = keyForTonic(major);
    if (!circle) {
        return null;
    }
    // The circle names the six-accidental key with sharps; the shelf writes that key
    // with flats (G♭, E♭ minor), so the enharmonic signature is tried too.
    const minor = key.mode === "minor";
    const slug =
        keySlugFor(circle.accidentals, minor) ??
        keySlugFor(
            circle.accidentals > 0 ? circle.accidentals - 12 : circle.accidentals + 12,
            minor,
        );
    return slug === null ? null : `chords-${slug}-${key.mode}`;
}

// The first drill level whose vocabulary holds every triad the piece uses, read by the
// triad under each numeral: V7 is V's chord, ii7 is ii's.
function earLevelFor(numerals: readonly string[]): number | null {
    const triads = numerals.map(triadOf);
    for (const [level, degrees] of PROGRESSION_LEVELS.entries()) {
        if (triads.every((one) => (degrees as readonly string[]).includes(one))) {
            return level;
        }
    }
    return null;
}

function triadOf(numeral: string): ChordDegree | string {
    // A half-diminished or diminished seventh is a diminished triad with a seventh on it.
    return numeral.replace(/(ø7|°7)$/u, "°").replace(/(Δ7|7)$/u, "");
}
