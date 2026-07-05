// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { browserStore } from "../adapters/browserStore";
export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "plinky:theme";
const KEY = THEME_STORAGE_KEY;

export function loadTheme(): Theme {
    const stored = browserStore.get(KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function saveTheme(theme: Theme): void {
    browserStore.set(KEY, theme);
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
