// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A theme is two independent choices: which colours (the palette) and how dark (the
// mode). Any palette works in any mode, so they are kept apart rather than listed as
// combinations — two palettes and four modes are six answers to learn, where the
// combinations would be eight.
//
// These are the one lists of valid choices. parseTheme and the pre-paint bootstrap
// script both derive from them, so a value cannot be known to one and not the other.

// `indigo` is the default: the deep indigo of the mark, forget-me-not tints and paper.
// `violet` is a brighter violet on warm paper, with gold for what you earned.
export const PALETTES = ["indigo", "violet"] as const;
export type Palette = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: Palette = "indigo";

// `black` is a dark mode with a true-black ground, for screens that switch a black pixel
// off. It is a mode rather than a palette because it answers "how dark", and either
// palette's colours read on it.
export const MODES = ["system", "light", "dark", "black"] as const;
export type Mode = (typeof MODES)[number];

export type Theme = { palette: Palette; mode: Mode };
export const DEFAULT_THEME: Theme = { palette: DEFAULT_PALETTE, mode: "system" };

// What the page is painted as once "system" is settled.
export type Shade = "light" | "dark" | "black";

// Coerce a stored value into a valid theme, each half on its own: an unknown palette
// takes the default and keeps a valid mode, and the reverse. A bare string is the form a
// device stored before there was a palette to choose — the mode alone — so it is read as
// that mode in the default palette.
export function parseTheme(value: unknown): Theme {
    const stored: unknown = typeof value === "string" ? { mode: value } : value;
    const fields =
        typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
    return {
        palette: PALETTES.includes(fields.palette as Palette)
            ? (fields.palette as Palette)
            : DEFAULT_PALETTE,
        mode: MODES.includes(fields.mode as Mode) ? (fields.mode as Mode) : "system",
    };
}

// Settle "system" to light or dark; the caller supplies the OS preference, so the
// resolution itself stays pure. The OS has no black preference, so black is only ever
// chosen.
export function resolveShade(mode: Mode, systemPrefersDark: boolean): Shade {
    if (mode !== "system") {
        return mode;
    }
    return systemPrefersDark ? "dark" : "light";
}
