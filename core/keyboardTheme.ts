// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Cosmetic skins for the on-screen keyboard's resting keys — the unpressed white and
// black key colours. Purely decorative: the lit / expected-next / wrong-note feedback
// colours are untouched (they carry meaning, so a skin never dims them), and so are the
// keys' shape and behaviour. Every skin is free and available from the first day — Plinky
// never locks looks behind progress. "classic" is the default and byte-identical to the
// keyboard's original palette, so the app looks unchanged until a skin is chosen.
export type KeyboardTheme = {
    id: string;
    // The resting white / black key classes (base colour + hover + dark variant), slotted
    // into the keyboard where its default palette would otherwise sit.
    white: string;
    black: string;
};

export const KEYBOARD_THEMES: KeyboardTheme[] = [
    {
        id: "classic",
        white: "bg-white hover:bg-gray-50 dark:bg-gray-100",
        black: "bg-gray-900 hover:bg-gray-800",
    },
    {
        id: "sunset",
        white: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-100",
        black: "bg-rose-900 hover:bg-rose-800",
    },
    {
        id: "forest",
        white: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-100",
        black: "bg-emerald-950 hover:bg-emerald-900",
    },
    {
        id: "berry",
        white: "bg-fuchsia-50 hover:bg-fuchsia-100 dark:bg-fuchsia-100",
        black: "bg-purple-900 hover:bg-purple-800",
    },
];

export const DEFAULT_THEME = KEYBOARD_THEMES[0]!;
