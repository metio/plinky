// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The name as the mark sets it: Fredoka at weight 600, the face the designer lettered it in
// and the one the app already ships as --font-display, with a round pink dot over the i.
//
// One description, because the name is set in places that cannot share a renderer — the app
// header (DOM), the promo thumbnails (HTML screenshotted by Chromium), an exported video
// (canvas) and the outlined lockups in brand/mark (dev/build-mark.mjs). Each reads its
// spacing and its dot from here, so the name is one wordmark everywhere.

// What the name says. Every accessible name and every piece of text that is read rather than
// looked at uses this, never the parts below.
export const WORDMARK = "Plinky";

// The name as it is drawn: a DOTLESS ı carrying the dot the mark draws itself, so the drawn
// dot is the only one. Separate pieces, so no surface has to go looking for the stem.
export const WORDMARK_PARTS = { before: "Pl", stem: "ı", after: "nky" } as const;

// The dot, in em of the type it sits on, taken from Fredoka 600's own i: its tittle is 0.155em
// across, its underside 0.563em above the baseline, and it is centred over the stem, which on
// the dotless ı is 0.1123em from the glyph's left edge. The designer asked for the dot where
// the face puts its own, and ROUND, where the face draws a rounded square; so this is a circle
// of the tittle's width with its centre at the tittle's centre. dev/build-mark.mjs measures the
// face again on every run and fails if these drift.
export const TITTLE = { size: 0.155, baseAbove: 0.563, stemCentre: 0.1123 } as const;

// The dot's pink: the plink's own light value, which is what the dot always was. It belongs
// to the mark rather than the palette, so it is the same in every palette and mode;
// app/app.css carries it as --color-brand-dot.
export const DOT = "#aa36fc";

// The domain rides as the name's own tail rather than as a second label beside it: setting
// the name and then "plinky.fun" next to it writes the name twice.
export const DOMAIN = ".fun";

// Letter-spacing in em. None on a light ground, as the designer set it on paper; a little on
// indigo or any dark ground, where light type needs more air to stay open.
export const TRACKING = { light: 0, dark: 0.05 } as const;

// What the name reads as.
export function wordmarkText(withDomain: boolean): string {
    return WORDMARK + (withDomain ? DOMAIN : "");
}

// What the name is drawn as: the same letters with the dotless stem.
export function drawnWordmark(withDomain: boolean): string {
    return (
        WORDMARK_PARTS.before +
        WORDMARK_PARTS.stem +
        WORDMARK_PARTS.after +
        (withDomain ? DOMAIN : "")
    );
}

// The dot as a circle in drawing coordinates, for a canvas or an SVG that place things
// absolutely: `stemLeftX` is where the ı begins and `baselineY` the text baseline, both in
// the drawing's units, and `fontSize` the size the name is set at.
export function tittleCircle(
    stemLeftX: number,
    baselineY: number,
    fontSize: number,
): { cx: number; cy: number; r: number } {
    const r = (fontSize * TITTLE.size) / 2;
    return {
        cx: stemLeftX + fontSize * TITTLE.stemCentre,
        // The underside sits baseAbove over the baseline, so the centre is a radius higher.
        cy: baselineY - fontSize * TITTLE.baseAbove - r,
        r,
    };
}
