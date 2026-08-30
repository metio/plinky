// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Plinky lockup: the name, set with its own tittle.
//
// One description of the mark, because it is drawn in three places that cannot share a
// renderer — the app header (DOM), the promo thumbnails (HTML screenshotted by Chromium)
// and an exported video (canvas) — and each carried its own copy of the geometry, written
// in its own units: `top-[0.2em]` measured from the inline box's top, `bottom:.77em`
// measured from its bottom, and nothing at all on canvas. Three spellings of one number
// drift the moment the face or the weight changes, and they had already drifted: the two
// that existed put the dot's underside 0.53em and 0.55em above the baseline.
//
// The header's own comment said "measure again rather than carrying the number anywhere
// else", which is good advice nobody could follow — so the number lives here once and
// every surface derives what it needs from it.

// Fredoka at weight 600, measured rather than guessed: rendering "i" against the dotless
// "ı" and diffing the two isolates the dot. It is 0.16em across, its underside sits 0.55em
// above the baseline, and it is centred on the stem. Valid for this face at this weight —
// which is the point of having one place to change it.
export const TITTLE = { size: 0.16, baseAbove: 0.55 } as const;

// The face's own vertical metrics, in em. An inline box's top is the ascent above the
// baseline and its bottom the descent below, so a CSS offset needs whichever end it is
// anchored to.
export const ASCENT = 0.89;
export const DESCENT = 0.22;

// The name in three parts, because the middle one is a DOTLESS ı carrying the dot the mark
// draws itself. Written as separate pieces rather than one string so no surface has to go
// looking for the stem inside it.
export const WORDMARK = { before: "Pl", stem: "ı", after: "nky" } as const;

// The domain is the wordmark's own tail rather than a second label beside it: setting the
// mark and then "plinky.fun" next to it writes the name twice.
export const DOMAIN = ".fun";

export function wordmarkText(withDomain: boolean): string {
    return WORDMARK.before + WORDMARK.stem + WORDMARK.after + (withDomain ? DOMAIN : "");
}

// The dot's top, in em, measured DOWN from the inline box's top — what a CSS `top` wants.
export function tittleFromBoxTop(): number {
    return ASCENT - TITTLE.baseAbove - TITTLE.size;
}

// The dot's underside, in em, measured UP from the inline box's bottom — what a CSS
// `bottom` wants.
export function tittleFromBoxBottom(): number {
    return DESCENT + TITTLE.baseAbove;
}

// The dot as a circle in drawing coordinates: `stemCenterX` is the middle of the ı's stem
// and `baselineY` the text baseline, both in pixels. For a canvas or an SVG, which place
// things absolutely rather than against a box.
export function tittleCircle(
    stemCenterX: number,
    baselineY: number,
    fontSize: number,
): { cx: number; cy: number; r: number } {
    const diameter = fontSize * TITTLE.size;
    return {
        cx: stemCenterX,
        // The underside sits baseAbove over the baseline, so the centre is half a diameter
        // further up.
        cy: baselineY - fontSize * TITTLE.baseAbove - diameter / 2,
        r: diameter / 2,
    };
}
