// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The one list of valid theme choices — parseTheme and the pre-paint bootstrap
// script both derive from it, so a theme value cannot be known to one and not
// the other.
export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

// Coerce a stored value into a valid theme; anything else follows the OS.
export function parseTheme(value: unknown): Theme {
    return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

// Resolve "system" to the effective light/dark; the caller supplies the OS
// preference, so the resolution itself stays pure.
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): "light" | "dark" {
    if (theme !== "system") {
        return theme;
    }
    return systemPrefersDark ? "dark" : "light";
}
