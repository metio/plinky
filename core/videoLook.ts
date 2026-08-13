// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How an exported video looks, as choices rather than constants.
//
// The colour a falling note lands in and how deep the keyboard sits are taste, not
// meaning: a video is something you make to show somebody, and the person making it is
// the one who knows what it is for. Keeping them here — as named options both the export
// panel and the promo tooling read — means there is one set of looks in the app, and no
// second renderer with its own hardcoded palette drifting away from what a player sees.
//
// This is deliberately NOT the on-screen accent. In the app that colour says "sounding",
// "next" and "you played this", so a skin must never repaint it; here nothing is being
// told to the player, so the choice is free.

export type NoteColor = {
    id: string;
    // Canvas hex — the video paints on a dark stage, so these are the lit values.
    hex: string;
};

// The app's own accent first, so an export left alone looks like the app.
export const NOTE_COLORS: readonly NoteColor[] = [
    { id: "indigo", hex: "#6366f1" },
    { id: "pink", hex: "#ec4899" },
    { id: "teal", hex: "#14b8a6" },
    { id: "amber", hex: "#f59e0b" },
    { id: "lime", hex: "#84cc16" },
];

export const DEFAULT_NOTE_COLOR = "indigo";

export function noteColorHex(id: string): string {
    return NOTE_COLORS.find((color) => color.id === id)?.hex ?? NOTE_COLORS[0]!.hex;
}

// How much of the frame's height the keyboard takes in the notes-highway video. A quarter
// of the frame made each white key a long pale column and the strip read as a wall; a
// shallow keyboard keeps something like a real key's proportions and hands the room back
// to the falling notes, which are what the eye follows. Deep is there for anyone who
// wants to see the hands' shape rather than the notes.
export type KeyboardDepth = { id: string; fraction: number };

export const KEYBOARD_DEPTHS: readonly KeyboardDepth[] = [
    { id: "shallow", fraction: 0.16 },
    { id: "standard", fraction: 0.24 },
    { id: "deep", fraction: 0.32 },
];

export const DEFAULT_KEYBOARD_DEPTH = "shallow";

export function keyboardDepthFraction(id: string): number {
    return (
        KEYBOARD_DEPTHS.find((depth) => depth.id === id)?.fraction ?? KEYBOARD_DEPTHS[0]!.fraction
    );
}
