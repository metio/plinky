// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { isBlackKey } from "./fingering";

// Frame the practice keyboard around the notes a piece actually uses, so a
// narrow tune (Twinkle, Twinkle sits inside a sixth) shows a short keyboard
// instead of a fixed two octaves. The span covers every note played, padded a
// little for the odd wrong-key neighbour, snapped outward to white keys so the
// keybed reads as a clean instrument rather than one cut mid-black-key, held to
// a one-octave minimum so a two-note drill still gives the fingers somewhere to
// land, and clamped to the 88-key piano.

const PIANO_LOW = 21; // A0
const PIANO_HIGH = 108; // C8
// A whole tone of breathing room each side — the same padding the run-range
// framing uses — so a stray hit on an edge note still lands on a drawn key.
const PAD = 2;
// Never shorter than an octave; a sub-octave keybed reads as broken, not tidy.
const MIN_SPAN = 12;

// The default two-octave frame, used when a piece has no pitched notes yet
// (an empty or still-loading score).
export const DEFAULT_KEY_RANGE = { from: 60, to: 84 } as const;

function downToWhite(note: number): number {
    let current = note;
    while (current > PIANO_LOW && isBlackKey(current)) {
        current -= 1;
    }
    return current;
}

function upToWhite(note: number): number {
    let current = note;
    while (current < PIANO_HIGH && isBlackKey(current)) {
        current += 1;
    }
    return current;
}

export function songKeyRange(
    pitches: readonly number[],
    fallback: { from: number; to: number } = DEFAULT_KEY_RANGE,
): { from: number; to: number } {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const pitch of pitches) {
        if (pitch < lo) {
            lo = pitch;
        }
        if (pitch > hi) {
            hi = pitch;
        }
    }
    if (!Number.isFinite(lo)) {
        return fallback;
    }

    let from = Math.max(PIANO_LOW, lo - PAD);
    let to = Math.min(PIANO_HIGH, hi + PAD);

    // Grow a too-narrow span outward from its centre, then re-clamp so the
    // minimum still holds when the notes sit against a piano edge.
    if (to - from < MIN_SPAN) {
        const centre = Math.round((from + to) / 2);
        from = Math.max(PIANO_LOW, centre - Math.ceil(MIN_SPAN / 2));
        to = Math.min(PIANO_HIGH, from + MIN_SPAN);
        from = Math.max(PIANO_LOW, to - MIN_SPAN);
    }

    return { from: downToWhite(from), to: upToWhite(to) };
}
