// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// A slur asks for the notes to be joined, and a note held to exactly its written length
// does not join anything: it stops at the very instant the next one starts, so the synth's
// envelope closes and reopens and the ear hears a seam. A slurred note therefore rings a
// little PAST its written end, into the note it is joined to — which is also what a pianist
// does, holding the key until the next finger is down.
//
// The overlap is a fraction of a beat rather than a fraction of the note. A slurred whole
// note wants the same small join as a slurred quaver, not one sixteen times longer, which
// is what scaling the note itself would give.
const LEGATO_OVERLAP_BEATS = 0.12;
// …but never more than a quarter of the note itself, or a very short slurred note would
// still be sounding two notes later.
const LEGATO_MAX_SHARE = 0.25;

const ACCENT_BOOST = 1.3;
const MARCATO_BOOST = 1.5;
// A tenuto asks for the note's full length AND a little weight behind it. The length half
// is already what an unmarked note gets, so without the weight the mark would ask for
// nothing at all — a score could carry it on every note and sound identical.
const TENUTO_BOOST = 1.12;

// The fraction of its written length a note is meant to sound. Split out of
// performNote because grading needs the shape of the intention without the tempo
// baked in: a staccato quarter is "a quarter of its written length" whether the
// player took it at 60 or at 120.
export function lengthScaleOf(marks: Pick<NoteMarks, "articulation" | "slurred">): number {
    // A slur means "connect to the next note", so it overrides any clip — a slurred
    // staccato (portato) still holds full here; the release tail bridges the notes.
    return marks.slurred ? 1 : LENGTH_SCALE[marks.articulation];
}

// The loudness a note is meant to be struck at, 0..127 — the standing dynamic with
// any accent applied. Split out for the same reason as lengthScaleOf.
export function velocityOf(
    marks: Pick<NoteMarks, "accent" | "marcato" | "dynamicVolume" | "articulation">,
): number {
    const base = marks.dynamicVolume ?? DEFAULT_VELOCITY;
    // One weight applies: the loudest instruction present wins rather than compounding.
    const boosted = marks.marcato
        ? base * MARCATO_BOOST
        : marks.accent
          ? base * ACCENT_BOOST
          : marks.articulation === "tenuto"
            ? base * TENUTO_BOOST
            : base;
    return Math.max(1, Math.min(127, Math.round(boosted)));
}

export function performNote(
    marks: NoteMarks,
    tempo: number,
    // What fraction of its written loudness this note is actually played at — the bar's
    // own weighting and the shape of its phrase, from `core/interpretation.ts`. One means
    // literally as written, which is what a caller with no score context should pass.
    //
    // It is applied HERE and not in `velocityOf`, and the distinction is the same one
    // `legatoOverlap` rests on: `velocityOf` is the written intention, which is what a run
    // is graded against, and marking a player down for not guessing an unwritten accent
    // would be indefensible.
    interpretation = 1,
): Performance {
    const beatSeconds = 60 / Math.max(1, tempo);
    const fullSeconds = Math.max(0, marks.quarters) * beatSeconds;
    return {
        durationSeconds:
            fullSeconds * lengthScaleOf(marks) * detachment(marks) + legatoOverlap(marks, tempo),
        velocity: Math.max(1, Math.round(velocityOf(marks) * interpretation)),
    };
}

// How much of its written length a note actually keeps.
//
// A note the score neither slurs nor articulates is written to last exactly until the next
// one begins, and played that way it does: the sound never stops, and a run of them is one
// continuous band of tone rather than a series of notes. No pianist plays like that — a
// finger lifts, and the hair of air is most of what makes a line audible as notes at all.
// On the 38% of the catalogue that marks nothing, that band of tone is a large part of why
// the playback sounds mechanical.
//
// Deliberately not part of lengthScaleOf, for the same reason legatoOverlap is not: that one
// is the shape of the written intention, which is what a run is graded against, and a player
// is not required to detach their notes to be judged as having held them. This is the
// performance, not the expectation.
//
// Only for a note with nothing written on it. A slur asks for the opposite, and every
// articulation already says exactly how long to hold.
const DETACH = 0.94;

export function detachment(marks: Pick<NoteMarks, "articulation" | "slurred">): number {
    return marks.slurred || marks.articulation !== "none" ? 1 : DETACH;
}

// How far a slurred note rings past its written end, in seconds. Zero for every note the
// score does not slur onward — including a slur's last note, which ends the phrase and has
// nothing to join to.
//
// Deliberately not part of lengthScaleOf: that one is the shape of the written intention,
// which is what a run is graded against, and a player is not required to overlap their
// notes to be judged as having held them. This is the performance, not the expectation.
export function legatoOverlap(
    marks: Pick<NoteMarks, "slurred" | "quarters">,
    tempo: number,
): number {
    if (!marks.slurred) {
        return 0;
    }
    const beatSeconds = 60 / Math.max(1, tempo);
    const fullSeconds = Math.max(0, marks.quarters) * beatSeconds;
    return Math.min(LEGATO_OVERLAP_BEATS * beatSeconds, fullSeconds * LEGATO_MAX_SHARE);
}
