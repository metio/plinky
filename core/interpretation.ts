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
): { beat: number; beats: number; index: number } | null {
    let found: XmlBar | null = null;
    // Which bar it is, not only what bar it is like — a phrase is a run of bars, so
    // something has to be able to count them.
    let index = -1;
    for (const [at, bar] of bars.entries()) {
        if (bar.from <= whole + EPSILON) {
            found = bar;
            index = at;
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
    // A position past the last declared bar belongs to a later bar of the same metre, so the
    // count carries on rather than sticking — otherwise every bar after the last time
    // signature would sit at the same place in its phrase.
    const beyond = Math.floor((whole - found.from) / barWholes);
    return {
        beat: (into < 0 ? into + barWholes : into) * found.beatType,
        beats: found.beats,
        index: index + Math.max(0, beyond),
    };
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

// How long a phrase is assumed to be where the score draws none, in bars. Four is the
// classic period, and the length a listener hears as a sentence in almost anything a
// beginner plays.
const ASSUMED_BARS = 4;

// How far the invented arch swings. Smaller than the taper a written slur gets, because
// this is a guess about the music and that is a reading of it — an arch that announced
// itself would be imposing a shape the composer did not write.
const ARCH = 0.07;

// The shape of a phrase nobody wrote down.
//
// 38% of the catalogue marks NOTHING — no dynamics, hairpins, slurs, articulation or pedal.
// A bare transcription of Handel is the ordinary case, not the exception. Played with only
// the bar's own stresses those pieces vary by a sixth in loudness and by nothing else at
// all, and the result is unmistakably a machine: every four bars identical to the last four.
//
// So where the score draws no arch, one is assumed over each group of bars: rising into the
// middle and settling at the end, which is what a player does without being asked. This
// deliberately reverses an earlier decision to invent nothing where the score wrote nothing.
// That was the right instinct about MARKS — inventing an accent the composer did not write
// changes what the piece says. A phrase is different: playing four bars at one level is not
// neutral, it is a choice, and it is the one choice no musician would make.
//
// Only where the score is silent. A written slur still wins, and a piece that phrases itself
// is played the way it asks.
export function assumedPhraseWeight(bars: readonly XmlBar[], whole: number): number {
    const place = placeInBar(bars, whole);
    if (!place) {
        return 1;
    }
    const { index, beat, beats } = place;
    if (beats <= 0) {
        return 1;
    }
    // Where this moment falls in its group of bars, 0..1.
    const through = ((index % ASSUMED_BARS) + beat / beats) / ASSUMED_BARS;
    // A single arch: nothing at the ends, most in the middle. Sine rather than a triangle so
    // the turn at the top is smooth — a peak with a corner in it reads as an accent.
    return 1 - ARCH + ARCH * Math.sin(Math.PI * through);
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
    // A written arch is a reading of the piece and wins outright. Where there is none, the
    // assumed one gives the line somewhere to go.
    const written = phraseWeight(slurs, whole);
    const phrase = written === 1 ? assumedPhraseWeight(bars, whole) : written;
    const weight = metricalWeight(bars, whole) * phrase;
    return Math.min(1, Math.max(FLOOR, weight));
}

const EPSILON = 1 / 1024;

const near = (value: number, target: number) => Math.abs(value - target) < 1 / 64;
