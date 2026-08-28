// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a key is shaded — the second axis of the keyboard's look, beside its colour.
//
// A skin (core/keyboardTheme) says what colour a resting key is. This says whether it is
// drawn as a flat, friendly tile or as a solid thing lying down with light falling on it.
// The two were never choosable: the canvas painter had the shading baked into three
// constants and the page had none, so a player got a glossy keyboard in an exported video
// and a flat one in the app, with no way to ask for either.
//
// Kept as numbers rather than as CSS or canvas calls, because the same description has to
// drive both — Tailwind cannot read a canvas gradient and a video cannot read a class.
export type KeyboardFinish = {
    id: "joyful" | "glossy";
    // How much of a white key's height is its front lip — the edge you see because a key
    // is a lever lying down rather than a painted stripe. Zero draws no lip at all.
    lip: number;
    // How far the top of a key is lifted toward white, and the bottom dropped toward its
    // own shadow. A single flat fill reads as a rectangle at any size; on a long key it
    // reads as a stripe.
    sheen: number;
    shade: number;
    // The corner radius, as a fraction of the key's width. A rounder key reads as softer.
    radius: number;
    // The same shading for the page, which cannot read a number: Tailwind class names have
    // to be literal for the build to find them, so a finish carries both faces of itself —
    // exactly as a skin carries classes for the page and hexes for the canvas.
    whiteKey: string;
    blackKey: string;
    well: string;
};

// What every key wears whatever its finish: the shape, the transition, the focus ring.
// Held apart from the finish so a new finish describes only what it changes.
const KEY_BASE =
    "relative border border-line-strong transition-[transform,background-color,box-shadow] duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring";
const BLACK_BASE =
    "absolute top-0 transition-[transform,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spark-soft";

// The default, and the look the front page has always had: flat, bright, friendly. Plinky
// is for somebody who has not played before, and a toy piano is a kinder first sight than
// a concert instrument.
export const JOYFUL: KeyboardFinish = {
    id: "joyful",
    lip: 0,
    sheen: 0,
    shade: 0,
    radius: 0.18,
    whiteKey: `${KEY_BASE} rounded-b-lg shadow-sm`,
    blackKey: `${BLACK_BASE} rounded-b-md`,
    well: "rounded-2xl bg-subtle-strong p-3 shadow-inner",
};

// The instrument as a photograph of one: a lip across the front, light down the length of
// the key, a shadow at its foot. These are the numbers the video painter had baked in, so
// a clip rendered glossy looks exactly as clips did before the finish was a choice.
export const GLOSSY: KeyboardFinish = {
    id: "glossy",
    lip: 0.09,
    sheen: 0.22,
    shade: 0.14,
    radius: 0.06,
    // A highlight along the top edge is the sheen; a heavy bottom border is the lip seen
    // end-on. Both are drawn inside the key so a glossy keyboard is the same size as a
    // joyful one and switching does not move the layout.
    whiteKey: `${KEY_BASE} rounded-b-sm border-b-4 border-b-line-strong shadow-md shadow-[inset_0_2px_0_rgba(255,255,255,0.55)]`,
    blackKey: `${BLACK_BASE} rounded-b-sm shadow-[inset_0_2px_0_rgba(255,255,255,0.18)]`,
    well: "rounded-lg bg-subtle-strong p-3 shadow-inner",
};

export const KEYBOARD_FINISHES: readonly KeyboardFinish[] = [JOYFUL, GLOSSY];

// The finish a stored id names, falling back to the default rather than to nothing: an id
// from a build that knew a finish this one does not is a look we cannot draw, not an error
// worth showing somebody mid-practice. Called with nothing, it answers the default — which
// is joyful, because the app opens for somebody who may never have played before, and a
// keyboard that looks like a toy is more inviting than one that looks like an instrument.
// A promo clip asks for glossy by name, for the opposite reason.
export function finishFor(id?: string): KeyboardFinish {
    return KEYBOARD_FINISHES.find((finish) => finish.id === id) ?? JOYFUL;
}
