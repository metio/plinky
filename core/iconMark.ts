// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking the name out of the mark.
//
// Plinky's mark is a lockup: a violet tile holding piano keys, a falling note, and the word
// "Plinky" set beneath them. That is the right artwork for a social card or a poster, where
// it has room to be read. It is the wrong artwork for an app icon — at 32px the word is a
// smudge, and it costs the keys the space they need to be recognised at all.
//
// So the icon is the same artwork with the word dissolved back into the tile and what is
// left recentred. Not a crop: cropping a rounded tile squares off its corners, and the
// silhouette is the thing that makes the mark read as an icon. Every pixel of the alpha
// channel is the artwork's own, start to finish.
//
// The word is FOUND rather than assumed. Where it sits is a fact about one revision of one
// file, and a hard-coded band would go on erasing those rows of a redrawn mark whatever
// they turned out to hold — taking the keys' feet off, or leaving the word's ascenders
// behind — while every gate stayed green.

// How bright a pixel must be, on every channel, to count as part of the white artwork —
// the keys and the wordmark both. The tile behind them is saturated violet, so this
// separates them with room to spare.
const WHITE = 200;
// Below this share of a row, a scattering of white pixels is the falling note's glow or an
// antialiased edge rather than a band of content.
const ROW_SHARE = 0.02;
// A gap this many rows deep separates one band of content from the next. The keys and the
// word are set well apart; a letter's own internal gaps are far shorter.
const GAP_ROWS = 12;
// How far in from the silhouette's edge the tile's own ground is sampled, as a share of the
// width: clear of the antialiased rim, and clear of the keys and letters, which are centred
// with a wide margin either side. A share rather than a count of pixels, so the same
// judgement holds whether the artwork arrives at 1024 or at a tenth of that.
const INSET_SHARE = 0.04;
// A row narrower than this share of the width cannot hold two ground samples with the inset
// between them, so it borrows the nearest row that can — the top and bottom of the curve.
const MIN_SPAN_SHARE = 0.2;
// How solid a pixel must be to be worth moving. The artwork's own top corners are
// transparent, and sliding them under a wider row would draw a second tile edge.
const SOLID = 200;

export type Band = { top: number; bottom: number };

// The rows of white artwork, as bands separated by gaps. Reading top to bottom, a lockup
// like this one gives the falling note, then the keys, then the word.
export function whiteBands(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
): Band[] {
    const bands: Band[] = [];
    let open: Band | null = null;
    let gap = 0;
    for (let y = 0; y < height; y++) {
        let white = 0;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (
                (rgba[i] as number) > WHITE &&
                (rgba[i + 1] as number) > WHITE &&
                (rgba[i + 2] as number) > WHITE &&
                (rgba[i + 3] as number) > SOLID
            ) {
                white++;
            }
        }
        if (white > width * ROW_SHARE) {
            if (open) {
                open.bottom = y;
                gap = 0;
            } else {
                open = { top: y, bottom: y };
            }
        } else if (open) {
            gap++;
            if (gap >= GAP_ROWS) {
                bands.push(open);
                open = null;
                gap = 0;
            }
        }
    }
    if (open) {
        bands.push(open);
    }
    return bands;
}

// The word, if this artwork has one: the last band, provided something sits above it.
//
// A lockup always sets the name under the picture, so the word is the bottom-most band —
// and a mark that is only a picture has nothing below to mistake for one, which is why a
// single band returns null rather than erasing the artwork's only content.
export function wordBand(bands: readonly Band[]): Band | null {
    return bands.length >= 2 ? (bands.at(-1) ?? null) : null;
}

// The mark with its word removed and what remains centred.
//
// Returns fresh pixels; the input is not touched. Throws when the artwork carries no word
// to remove, because a caller asking for this has been handed something it did not expect
// and a silent copy would ship the lockup as the icon.
export function wordlessMark(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
): Uint8ClampedArray {
    const bands = whiteBands(rgba, width, height);
    const word = wordBand(bands);
    if (!word) {
        throw new Error("no wordmark found in this artwork: nothing to remove");
    }
    const kept = bands.slice(0, -1);
    // Erase from midway into the gap above the word, so its ascenders go with it and the
    // keys' own shadows stay.
    const erase = Math.round(((kept.at(-1)?.bottom ?? 0) + word.top) / 2);
    // What is left sat high to leave the word room; centring it is the point of the slide.
    const middle = ((kept[0]?.top ?? 0) + (kept.at(-1)?.bottom ?? 0)) / 2;
    const shift = Math.max(0, Math.round(height / 2 - middle));

    // Each row's ground is read from its own edges, so the tile's shading is reproduced
    // rather than approximated from one reference row — an approximation leaves a band
    // across the tile where it meets the artwork.
    const inset = Math.max(1, Math.round(width * INSET_SHARE));
    const minSpan = width * MIN_SPAN_SHARE;
    const edges: ({ left: number; right: number } | null)[] = [];
    for (let y = 0; y < height; y++) {
        let left = 0;
        while (left < width && (rgba[(y * width + left) * 4 + 3] as number) < SOLID) left++;
        let right = width - 1;
        while (right > 0 && (rgba[(y * width + right) * 4 + 3] as number) < SOLID) right--;
        edges.push(right - left < minSpan ? null : { left: left + inset, right: right - inset });
    }
    const nearestEdge = (y: number) => {
        for (let d = 0; d < height; d++) {
            const up = edges[y + d];
            if (up) return { y: y + d, ...up };
            const down = edges[y - d];
            if (down) return { y: y - d, ...down };
        }
        return { y, left: inset, right: width - inset };
    };
    const ground = (x: number, y: number, out: Uint8ClampedArray, at: number) => {
        const e = nearestEdge(y);
        const l = (e.y * width + e.left) * 4;
        const r = (e.y * width + e.right) * 4;
        const t = Math.max(0, Math.min(1, (x - e.left) / Math.max(1, e.right - e.left)));
        for (let k = 0; k < 3; k++) {
            const from = rgba[l + k] as number;
            const to = rgba[r + k] as number;
            out[at + k] = Math.round(from + (to - from) * t);
        }
    };

    const out = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        const from = y - shift;
        for (let x = 0; x < width; x++) {
            const at = (y * width + x) * 4;
            const source = (Math.max(0, from) * width + x) * 4;
            // Ground is painted above the slide, below the word, and anywhere the pixel
            // being moved is not solid — the artwork's own top corners are transparent, and
            // sliding them under a wider row would draw the tile's edge twice.
            //
            // Above the slide the tile's top row is continued upward rather than each row's
            // own ground: the top edge is darker than the tile's middle, so reading row by
            // row there meets the slid artwork with a lighter violet and draws a line.
            if (from < 0) {
                ground(x, 0, out, at);
            } else if (from >= erase || (rgba[source + 3] as number) < SOLID) {
                ground(x, y, out, at);
            } else {
                out[at] = rgba[source] as number;
                out[at + 1] = rgba[source + 1] as number;
                out[at + 2] = rgba[source + 2] as number;
            }
            // The silhouette is always the artwork's own, never the slid one.
            out[at + 3] = rgba[at + 3] as number;
        }
    }
    return out;
}
