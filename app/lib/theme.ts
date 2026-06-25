// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "plinky:theme";
const KEY = THEME_STORAGE_KEY;

export function loadTheme(): Theme {
    try {
        const stored = localStorage.getItem(KEY);
        return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    } catch {
        return "system";
    }
}

export function saveTheme(theme: Theme): void {
    try {
        localStorage.setItem(KEY, theme);
    } catch {
        // Persisting the theme is best-effort; a private-mode failure is harmless.
    }
}

// Resolve "system" to the effective light/dark using the OS preference.
export function resolveTheme(theme: Theme): "light" | "dark" {
    if (theme !== "system") {
        return theme;
    }
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}
