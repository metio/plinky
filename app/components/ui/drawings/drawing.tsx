// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import sprite from "./drawings.svg?no-inline";

// Every drawing in the sprite, by the id of its symbol. drawings.test.ts holds this list and
// the sprite to each other in both directions.
export const DRAWINGS = [
    "loop",
    "metronome",
    "halfKeyboard",
    "headphones",
    "shuffledPages",
    "calendar",
    "triad",
    "staff",
    "marks",
    "keys",
    "books",
    "tuningFork",
    "rhythm",
    "pencil",
    "setList",
    "envelope",
    "circle",
    "scale",
    "changes",
    "interval",
    "stopwatch",
] as const;

export type DrawingName = (typeof DRAWINGS)[number];

// One of the drawings, drawn from the sprite: a file fetched once and cached, so a page of
// drawings adds nothing to the script a visitor downloads.
//
// The frame is sized here, from its 72×56 grid, so the space it takes is settled in the
// first layout; the sprite arriving a moment later paints into it without moving anything.
// The drawing's colours are custom properties, which reach into the sprite's copy where
// class selectors cannot, so a surface that needs other inks (a piano key stays white in the
// dark) sets `--art-stroke`, `--art-fill`, `--art-accent` and `--art-paper` around it.
//
// Decorative by definition: the words beside a drawing carry the meaning, so it is hidden
// from assistive technology and never takes focus.
export function Drawing({ name, className }: { name: DrawingName; className?: string }) {
    return (
        <svg viewBox="0 0 72 56" aria-hidden="true" focusable="false" className={className}>
            <use href={`${sprite}#${name}`} />
        </svg>
    );
}
