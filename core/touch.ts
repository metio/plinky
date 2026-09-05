// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type XmlBar, placeInBar } from "./interpretation";
import type { SlurSpan } from "./slur";

// The human touch: what a pianist does with TIME that a page never writes down.
//
// The loudness shaping in core/interpretation gives a bar its stresses and a phrase its
// taper, and with only that Listen still lands every note exactly on the grid — which no
// pianist ever does, and which the ear reads as a machine before it reads anything else.
// The deviations a player makes are systematic rather than random, so they can be modelled
// without inventing a performance with opinions: the phrase settles into its ending, the
// last bar broadens, the tune is struck a hair before the accompaniment under it, and
// nothing lands to the microsecond. All of it is slight, all of it is deterministic — the
// same piece always plays the same way, so a rendered clip is reproducible — and none of
// it reaches grading, which stays literal.

// How far into its phrase a position is, 0 at the start and 1 at the end: the written
// slur where the page has one, the assumed four-bar arch where it has none — the same two
// readings the loudness taper is made from, so time and loudness settle together.
export function phraseProgress(
    bars: readonly XmlBar[],
    slurs: readonly SlurSpan[],
    whole: number,
): number {
    for (const span of slurs) {
        const length = span.to - span.from;
        if (length > 0 && whole >= span.from - EPSILON && whole <= span.to + EPSILON) {
            return Math.min(1, Math.max(0, (whole - span.from) / length));
        }
    }
    const place = placeInBar(bars, whole);
    if (!place || place.beats <= 0) {
        return 0;
    }
    return ((place.index % ASSUMED_BARS) + place.beat / place.beats) / ASSUMED_BARS;
}

const ASSUMED_BARS = 4;

// A phrase settles into its ending: over its last quarter the pulse eases by up to this.
const PHRASE_EASE = 0.06;
const PHRASE_EASE_FROM = 0.75;
// The last bar of the piece broadens up to this by its end — the ritardando every
// player makes whether or not one is printed.
const FINAL_BROADENING = 0.25;

// How much longer than written a position is held for where it sits: in its phrase, and
// — `finalBar` being how far through the piece's last bar it is, or null elsewhere — at
// the very end. Multiplies the position's advance, like a fermata does.
export function rubatoStretch(phrase: number, finalBar: number | null): number {
    const into = Math.min(1, Math.max(0, (phrase - PHRASE_EASE_FROM) / (1 - PHRASE_EASE_FROM)));
    const eased = 1 + PHRASE_EASE * into * into;
    const broadened =
        finalBar === null ? 1 : 1 + FINAL_BROADENING * Math.min(1, Math.max(0, finalBar));
    return eased * broadened;
}

// The tune is struck this far ahead of the accompaniment under it. Measured in every
// recorded pianist, and the thing that makes a chord sound played rather than triggered.
export const MELODY_LEAD_MS = 20;
// Nothing lands to the microsecond: a few milliseconds either way, deterministic per note.
const JITTER_MS = 4;
// And nothing is struck at exactly the same weight twice.
const VELOCITY_JITTER = 0.03;

// A unit value in [0, 1) for a note at a position, the same every time the piece plays.
function grain(index: number, pitch: number): number {
    let hash = (index * 73_856_093) ^ (pitch * 19_349_663);
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
    hash ^= hash >>> 15;
    return (hash >>> 0) / 4_294_967_296;
}

// How long after the position's moment a note is struck: the tune on it, the notes under
// it a hair later, and every one a few milliseconds off the grid.
export function noteDelayMs(index: number, pitch: number, isTune: boolean): number {
    const jitter = (grain(index, pitch) * 2 - 1) * JITTER_MS;
    return Math.max(0, (isTune ? 0 : MELODY_LEAD_MS) + jitter);
}

// A touch heavier or lighter than the reading asked for, within a few percent.
export function touchVelocity(index: number, pitch: number): number {
    return 1 - VELOCITY_JITTER + 2 * VELOCITY_JITTER * grain(index + 1, pitch);
}

const EPSILON = 1 / 1024;
