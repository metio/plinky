// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { resolveTheme, type Theme } from "../../core/theme";

// Stamp the resolved theme onto the document — the one DOM mutation of the
// theme feature, shared by the layout (on mount and OS changes) and the toggle.
export function applyTheme(theme: Theme): void {
    const systemPrefersDark =
        typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle(
        "dark",
        resolveTheme(theme, systemPrefersDark) === "dark",
    );
}
