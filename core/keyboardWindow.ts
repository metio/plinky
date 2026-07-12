// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

export type Span = { from: number; to: number };

// A piece can range far wider than two octaves. Framing the on-screen keyboard to the
// whole span squeezes every key thin — unplayable on a phone — so instead the keyboard
// shows a bounded window that follows the music, the way the staff auto-scrolls. The
// window only re-frames when the notes you must play next fall outside it, so the keys
// stay put (and a steady size) until the music genuinely moves on.

// Two octaves — the same width as the idle keyboard, so a key never shrinks below a
// comfortable target; widened only to fit a single chord that spans more than that.
export const DEFAULT_KEYBOARD_SPAN = 24;

function clampFrom(from: number, span: number, range: Span): number {
    return Math.max(range.from, Math.min(from, range.to - span));
}


// Free play (Compose) has no upcoming notes to frame the window around, so it follows
// the note you just played instead: it holds while that note sits in the comfortable
// middle and re-centres when you play near an edge — so tapping the end key climbs you
// to the next octave rather than trapping you in one window. `reach` bounds the slide
// (the full reachable keyboard); `span` is the chosen width (Infinity shows it all).
export function followKeyboardWindow(
    prev: Span | null,
    note: number,
    span: number,
    reach: Span,
): Span {
    if (!Number.isFinite(span) || reach.to - reach.from <= span) {
        return reach;
    }
    const framed = (): Span => {
        const from = clampFrom(Math.round(note - span / 2), span, reach);
        return { from, to: from + span };
    };
    if (!prev) {
        return framed();
    }
    // The margin by each edge is the "grab zone": a note landing there re-centres the
    // window so you can walk past the current octave; anywhere comfortably inside holds.
    const margin = Math.max(2, Math.floor(span / 5));
    if (note >= prev.from + margin && note <= prev.to - margin) {
        return prev;
    }
    return framed();
}
