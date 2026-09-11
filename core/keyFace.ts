// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { KeyState } from "./keyState";

// What a key looks like in each state: the fill it takes, and the ink its printed name is
// set in. They are one table because they are one decision — a name is only legible
// against the fill beneath it, and every state repaints that fill. Choosing the ink
// anywhere else lets a fill change without its name following, which is how a pale grey
// label ends up on a green key.
//
// Each ink clears WCAG AA (4.5:1 at the ten-pixel size the names are set in) on its fill,
// in both themes and on every skin, both bare and under the translucent hold bar that can
// rise over any key. dev/keyLabelContrast.test.mts measures every entry against app.css.

export type KeyColour = "white" | "black";

export type KeyFace = {
    fill: string;
    label: string;
};

// The resting key classes a skin supplies (core/keyboardTheme.ts).
export type KeySkin = {
    white: string;
    black: string;
};

export type KeyFaces = Record<KeyColour, Record<KeyState, KeyFace>>;

const HELD_LIFT = "translate-y-0.5 shadow-[0_0_14px_-3px] shadow-key-held";

// The bar that drains down a key for as long as its note is written to last. It is
// translucent, so it darkens whatever fill is under it, and every ink is measured against
// that too.
export const HOLD_FILL = "bg-key-next/45 dark:bg-key-next/40";

// Every face a skin's keys can wear. Built once per skin rather than asked per key: the
// keyboard renders once an animation frame while a note is held, and a fresh object per
// key per frame was most of what that render allocated.
export function keyFaces(skin: KeySkin): KeyFaces {
    return {
        white: {
            rest: { fill: skin.white, label: "text-key-label" },
            wrong: { fill: "bg-danger-fill", label: "text-key-wrong-ink" },
            held: { fill: `${HELD_LIFT} bg-success-fill`, label: "text-key-held-ink" },
            left: { fill: "bg-hand-left-soft", label: "text-key-ink" },
            right: { fill: "bg-hand-right-soft", label: "text-key-right-ink" },
            next: { fill: "bg-accent-surface", label: "text-accent-ink" },
        },
        black: {
            rest: { fill: skin.black, label: "text-key-black-ink" },
            wrong: { fill: "bg-danger", label: "text-key-black-wrong-ink" },
            held: { fill: `${HELD_LIFT} bg-key-held`, label: "text-key-ink" },
            left: { fill: "bg-hand-left", label: "text-key-ink" },
            right: { fill: "bg-hand-right", label: "text-key-black-right-ink" },
            // An expected black key is ringed, not repainted. Filling it with the next-note
            // colour stops it being a black key — fine mid-piece, where the key is pointed at
            // rather than named, and wrong in the first lesson of all, which says "press any
            // black key" over a keyboard whose black keys have turned blue. Its fill stays
            // black, so its name keeps the pale ink that reads on black.
            next: {
                fill: `${skin.black} ring-2 ring-inset ring-key-next`,
                label: "text-key-black-ink",
            },
        },
    };
}
