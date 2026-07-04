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

// The window to show next, given the previous one. `active` is the set of notes that
// must be visible right now (the position being played); when it's empty the window
// holds still. Returns the full piece range unchanged when it already fits, so narrow
// pieces behave exactly as before — no sliding, the whole keyboard at once.
export function nextKeyboardWindow(
    prev: Span | null,
    range: Span | null,
    active: number[],
    maxSpan: number = DEFAULT_KEYBOARD_SPAN,
): Span | null {
    if (!range) {
        return null;
    }
    if (range.to - range.from <= maxSpan) {
        return range;
    }
    if (active.length === 0) {
        return prev ?? { from: range.from, to: range.from + maxSpan };
    }
    const lo = Math.min(...active);
    const hi = Math.max(...active);
    // Still framed by the current window — leave it exactly where it is.
    if (prev && lo >= prev.from && hi <= prev.to) {
        return prev;
    }
    // Re-frame: a window wide enough for the chord, centred on it so there's reading
    // room on both sides, then clamped inside the piece's own range.
    const span = Math.max(maxSpan, hi - lo);
    const from = clampFrom(Math.round((lo + hi) / 2 - span / 2), span, range);
    return { from, to: from + span };
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
