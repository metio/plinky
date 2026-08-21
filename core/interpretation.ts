// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Playing a score rather than reciting it.
//
// Most of what makes music sound like music is not written down. A teaching study prints
// no dynamics at all — Beyer, Czerny, half the catalogue — not because every note is the
// same weight but because a player is expected to supply the weighting. Sounded literally,
// every note at one loudness, the result is a metronome with pitches: the bar has no shape,
// the phrase has no direction, and a beginner listening for guidance hears something no
// pianist would ever play.
//
// So this supplies the two things a player supplies without thinking. It is deliberately
// small — the aim is music that breathes, not a performance with opinions — and it only
// ever makes notes quieter than the score asks, never louder. What is printed is a
// ceiling; interpretation lives underneath it.
//
// **This is performance, not expectation.** It never reaches grading. A player is judged
// against what the page says, and marking them down for not guessing an unwritten accent
// would be indefensible — the same line `legatoOverlap` sits on.

import type { XmlBar } from "./musicxmlTimeline";
import type { SlurSpan } from "./slur";

// The bar a position falls in, and how far into it the position sits, in beats.
//
// Null before the first barline the file declares, which is a score that states no metre —
// there is no downbeat to be on, so nothing is stressed.
export function placeInBar(
    bars: readonly XmlBar[],
    whole: number,
): { beat: number; beats: number } | null {
    let found: XmlBar | null = null;
    for (const bar of bars) {
        if (bar.from <= whole + EPSILON) {
            found = bar;
        }
    }
    if (!found || found.beats <= 0 || found.beatType <= 0) {
        return null;
    }
    const barWholes = found.beats / found.beatType;
    if (barWholes <= 0) {
        return null;
    }
    // Where in the bar, allowing for a position past the bar's own end — a repeat brings
    // the walk back over earlier bars, and the last bar declared stands until the next.
    const into = (whole - found.from) % barWholes;
    return { beat: (into < 0 ? into + barWholes : into) * found.beatType, beats: found.beats };
}

// How much of its written loudness a note keeps, for where it sits in the bar.
//
// The downbeat keeps all of it and everything else gives a little back: a secondary strong
// beat — the third crotchet of four, the fourth quaver of six — nearly all, another beat
// slightly less, and anything falling between beats least of all. That ordering is what a
// bar IS. Played flat, four-four and three-four sound the same, which is to say the metre
// stops existing.
const DOWNBEAT = 1;
const SECONDARY = 0.95;
const ON_BEAT = 0.9;
const OFF_BEAT = 0.84;

export function metricalWeight(bars: readonly XmlBar[], whole: number): number {
    const place = placeInBar(bars, whole);
    if (!place) {
        return DOWNBEAT;
    }
    const { beat, beats } = place;
    if (near(beat, 0)) {
        return DOWNBEAT;
    }
    // Where the bar divides in two, the halfway beat carries the secondary stress: the
    // third of four, the fourth of six. An odd bar — three, five — has no such beat.
    if (beats % 2 === 0 && near(beat, beats / 2)) {
        return SECONDARY;
    }
    return near(beat, Math.round(beat)) ? ON_BEAT : OFF_BEAT;
}

// How much of its loudness a note keeps for where it sits in its phrase.
//
// A slurred group tapers: it arrives, and it settles. Ending a phrase at the same weight it
// began is the single most mechanical thing an unshaped playback does, because every arch
// then stops dead instead of resolving. Notes outside any arch are left alone — the score
// drew no phrase there, so this invents none.
const PHRASE_TAPER = 0.12;

export function phraseWeight(spans: readonly SlurSpan[], whole: number): number {
    for (const span of spans) {
        const length = span.to - span.from;
        if (length > 0 && whole >= span.from - EPSILON && whole <= span.to + EPSILON) {
            const through = Math.min(1, Math.max(0, (whole - span.from) / length));
            return 1 - PHRASE_TAPER * through;
        }
    }
    return 1;
}

// Everything together: what fraction of its written loudness this note is actually played
// at. Never above 1 — the page sets the ceiling — and never so low that a note disappears
// under the one before it.
const FLOOR = 0.7;

export function interpretedWeight(
    bars: readonly XmlBar[],
    slurs: readonly SlurSpan[],
    whole: number,
): number {
    const weight = metricalWeight(bars, whole) * phraseWeight(slurs, whole);
    return Math.min(1, Math.max(FLOOR, weight));
}

const EPSILON = 1 / 1024;

const near = (value: number, target: number) => Math.abs(value - target) < 1 / 64;
