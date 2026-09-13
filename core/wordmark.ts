// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The name as the mark sets it: Fredoka at weight 600, the face the designer lettered it in
// and the one the app already ships as --font-display.
//
// One description, because the name is set in places that cannot share a renderer — the app
// header (DOM), the promo thumbnails (HTML screenshotted by Chromium), an exported video
// (canvas) and the outlined lockups in brand/mark (dev/build-mark.mjs). Each reads its
// spacing from here, so light type on a dark ground gets the same air everywhere.

export const WORDMARK = "Plinky";

// The domain rides as the name's own tail rather than as a second label beside it: setting
// the name and then "plinky.fun" next to it writes the name twice.
export const DOMAIN = ".fun";

// Letter-spacing in em. None on a light ground, as the designer set it on paper; a little on
// indigo or any dark ground, where light type needs more air to stay open.
export const TRACKING = { light: 0, dark: 0.05 } as const;

export function wordmarkText(withDomain: boolean): string {
    return WORDMARK + (withDomain ? DOMAIN : "");
}
