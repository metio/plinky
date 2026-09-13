// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { resolveShade, type Theme } from "../../core/theme";

// Stamp the resolved theme onto the document — the one DOM mutation of the theme
// feature, shared by the layout (on mount and OS changes) and the Settings picker.
//
// Black is a dark mode, so it carries the `dark` class too and every `dark:` variant
// still applies; `black` only swaps the grounds. The palette is an attribute because the
// stylesheet keys the non-default palette off it (app/app.css).
export function applyTheme(theme: Theme): void {
    const systemPrefersDark =
        typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    const shade = resolveShade(theme.mode, systemPrefersDark);
    const root = document.documentElement;
    root.classList.toggle("dark", shade !== "light");
    root.classList.toggle("black", shade === "black");
    root.setAttribute("data-palette", theme.palette);
}
