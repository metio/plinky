// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Where each piano key sits horizontally within a keybed spanning [from, to],
// as percentages of the keybed's width. The on-screen keyboard lays white keys
// out with flexbox (equal shares) and positions black keys over the gaps; this
// reproduces that placement as pure numbers so an overlay aligned to the keys —
// the notes-highway blocks on screen, or the same blocks drawn onto a video
// canvas — lands on the right key at any pixel width.

// The pitch classes with a white key: C D E F G A B. A note is white when its
// pitch class (folded into 0..11) is one of these.
export const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];

// The widest a white key is allowed to grow. The keybed centres and caps at this
// per white key so keys keep a piano-like proportion however few notes a piece
// spans; an overlay aligned to the keys must cap and centre to the same width.
const MAX_WHITE_KEY_PX = 44;

export function isWhite(note: number): boolean {
    return WHITE_PITCH_CLASSES.includes(((note % 12) + 12) % 12);
}

// The keybed's capped pixel width for the range — what both the keyboard and an
// aligned overlay set as their max width so their lanes line up.
export function keybedMaxWidthPx(from: number, to: number): number {
    return whiteKeys(from, to).length * MAX_WHITE_KEY_PX;
}

// The white keys in [from, to], in ascending order.
export function whiteKeys(from: number, to: number): number[] {
    const whites: number[] = [];
    for (let note = from; note <= to; note++) {
        if (isWhite(note)) {
            whites.push(note);
        }
    }
    return whites;
}

// A key's horizontal lane: its left edge and width as percentages of the keybed.
// White keys tile the full width in equal shares; a black key is 60% of a white
// key's width, straddling the gap after its lower white neighbour, clamped inside
// the keybed at the ends. Null when the note is outside [from, to].
type Lane = { leftPct: number; widthPct: number; white: boolean };

export function keyLane(note: number, from: number, to: number): Lane | null {
    if (note < from || note > to) {
        return null;
    }
    const whites = whiteKeys(from, to);
    const whiteWidth = whites.length ? 100 / whites.length : 0;
    const whitesBefore = whites.filter((white) => white < note).length;
    if (isWhite(note)) {
        return { leftPct: whitesBefore * whiteWidth, widthPct: whiteWidth, white: true };
    }
    const widthPct = whiteWidth * 0.6;
    const leftPct = Math.min(
        Math.max(0, whitesBefore * whiteWidth - whiteWidth * 0.3),
        100 - widthPct,
    );
    return { leftPct, widthPct, white: false };
}
