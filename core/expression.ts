// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Turns a note's written expression marks into how it should actually sound — how
// long and how loud — so Listen and the exported replay play the score the way it's
// notated rather than every note flat and full-length. The decision is pure and
// testable here; reading the marks off OSMD lives in the transport's score reader.

// The mutually exclusive length articulations, longest-held first. Staccato clips a
// note short, staccatissimo shorter; tenuto holds it its full written value with a
// touch of weight; detached-legato barely detaches. "none" is a plain note.
export type Articulation = "none" | "detachedLegato" | "tenuto" | "staccato" | "staccatissimo";

export type NoteMarks = {
    // The note's sounding length in quarter notes — for the first note of a tie, the
    // whole tie's combined length, so a held note rings through its ties.
    quarters: number;
    articulation: Articulation;
    // An accent strikes harder, a marcato (strong accent) harder still. Independent of
    // the length articulation — a note can be, say, both staccato and accented.
    accent: boolean;
    marcato: boolean;
    // The note continues into the next under a slur (it is not the slur's last note), so
    // it is held its full length to connect — the synth's release tail carries the legato.
    slurred: boolean;
    // The dynamic in force at the note as a 0..127 loudness, or null when the score marks
    // none, in which case the default velocity stands (unchanged from flat playback).
    dynamicVolume: number | null;
};

export type Performance = {
    durationSeconds: number;
    velocity: number; // 0..127 for the synth
};

// The velocity a note plays at when the score marks no dynamic — the same default the
// flat playback used, so an unmarked piece sounds exactly as before.
export const DEFAULT_VELOCITY = 90;

// The fraction of a note's written length it actually sounds, per length articulation.
const LENGTH_SCALE: Record<Articulation, number> = {
    none: 1,
    detachedLegato: 0.9,
    tenuto: 1,
    staccato: 0.5,
    staccatissimo: 0.25,
};

const ACCENT_BOOST = 1.3;
const MARCATO_BOOST = 1.5;

export function performNote(marks: NoteMarks, tempo: number): Performance {
    const beatSeconds = 60 / Math.max(1, tempo);
    const fullSeconds = Math.max(0, marks.quarters) * beatSeconds;
    // A slur means "connect to the next note", so it overrides any clip — a slurred
    // staccato (portato) still holds full here; the release tail bridges the notes.
    const scale = marks.slurred ? 1 : LENGTH_SCALE[marks.articulation];
    const durationSeconds = fullSeconds * scale;

    const base = marks.dynamicVolume ?? DEFAULT_VELOCITY;
    const boosted = marks.marcato ? base * MARCATO_BOOST : marks.accent ? base * ACCENT_BOOST : base;
    const velocity = Math.max(1, Math.min(127, Math.round(boosted)));

    return { durationSeconds, velocity };
}
