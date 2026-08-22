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

// Colouring a note by the finger that plays it, rather than by one colour for the whole
// performance. Only offered because the fingering engine can answer it: a score-derived
// performance is fingered by the same cost model the fingering trainer uses, so the
// colour is the app's own advice about how to play the passage, not decoration.
export const BY_FINGER = "finger";

// The app's own accent first, so an export left alone looks like the app.
export const NOTE_COLORS: readonly NoteColor[] = [
    { id: "indigo", hex: "#6366f1" },
    { id: "pink", hex: "#ec4899" },
    { id: "teal", hex: "#14b8a6" },
    { id: "amber", hex: "#f59e0b" },
    { id: "lime", hex: "#84cc16" },
    // The by-finger option carries a hex too: it is what an unfingered note paints in, so
    // a take with no score behind it still looks deliberate.
    { id: BY_FINGER, hex: "#ffd23f" },
];

export const DEFAULT_NOTE_COLOR = "indigo";

// One colour per finger, thumb (1) to little finger (5), warm and cheerful and far
// enough apart in hue to tell at a glance on a dark stage. Fixed forever: a viewer who
// watches two clips learns that the red notes are the thumb, and that only holds if the
// mapping never moves.
export const FINGER_COLORS: readonly string[] = [
    "#ff5757", // 1 thumb — warm red
    "#ff9f45", // 2 index — orange
    "#ffd23f", // 3 middle — sunny yellow
    "#ff6fb5", // 4 ring — pink
    "#b06bff", // 5 little — violet
];

// The colour of a given finger; an unfingered note falls back to the panel's chosen
// colour, which the caller passes in, so a take nobody fingered still paints.
export function fingerColorHex(finger: number | undefined, fallback: string): string {
    return FINGER_COLORS[(finger ?? 0) - 1] ?? fallback;
}

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

// Colouring a note by the hand that plays it — the practice highway's own scheme, offered
// here too so the two pictures can be made to match.
//
// The reason it lives beside the others rather than only on the play surface: the schemes
// are a shared list on purpose. An export and a practice run draw the same falling notes,
// and a viewer who learns what a colour means while practising should not have to learn it
// again watching a video of themselves. The two renderers paint in different mediums —
// baked hexes on a dark stage, theme tokens on a page that follows the reader's light — so
// what is shared is the set of choices, not the pigments, and a test asserts every scheme
// in the list is answered by both.
export const BY_HAND = "hand";

// The hands, as the lit values the video's dark stage wants. The teal and indigo the play
// surface uses for the same job, which is the whole point of offering it.
export const HAND_COLORS: Record<"left" | "right", string> = {
    left: "#14b8a6",
    right: "#6366f1",
};

export function handColorHex(hand: "left" | "right" | undefined, fallback: string): string {
    return hand ? HAND_COLORS[hand] : fallback;
}

// Every way a falling note can be coloured, in the order a picker offers them: the flat
// colours, then the two that read something off the music.
export const HIGHWAY_SCHEMES: readonly string[] = [
    ...NOTE_COLORS.filter((color) => color.id !== BY_FINGER).map((color) => color.id),
    BY_FINGER,
    BY_HAND,
];

// What a scheme says about one note. Pure, and the one place the decision is made — each
// renderer turns the answer into its own medium rather than deciding for itself.
export type NotePaint =
    | { kind: "finger"; finger: number | undefined }
    | { kind: "hand"; hand: "left" | "right" | undefined }
    | { kind: "flat"; id: string };

export function notePaint(
    scheme: string,
    note: { finger?: number; hand?: "left" | "right" },
): NotePaint {
    if (scheme === BY_FINGER) {
        return { kind: "finger", finger: note.finger };
    }
    if (scheme === BY_HAND) {
        return { kind: "hand", hand: note.hand };
    }
    return { kind: "flat", id: scheme };
}
