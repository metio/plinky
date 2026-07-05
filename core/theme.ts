// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

export type Theme = "light" | "dark" | "system";

// Coerce a stored value into a valid theme; anything else follows the OS.
export function parseTheme(value: unknown): Theme {
    return value === "light" || value === "dark" || value === "system" ? value : "system";
}

// Resolve "system" to the effective light/dark; the caller supplies the OS
// preference, so the resolution itself stays pure.
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): "light" | "dark" {
    if (theme !== "system") {
        return theme;
    }
    return systemPrefersDark ? "dark" : "light";
}
