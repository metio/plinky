// SPDX-FileCopyrightText: The Klimpi Authors
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
    paintBrowserChrome(root);
}

// The colour the browser paints its own chrome with — Android's address bar, the title bar
// of an installed window. It names the header's own ground, so the chrome continues the
// page instead of drawing a seam across the top of the app.
//
// Read off the document rather than listed here. The header is `bg-raised`, and `raised`
// is one of the tokens a palette varies: white in every light palette, but a different
// near-black in each dark one and different again under `black`. A table of those values
// here would be a second copy of app.css that nothing checks, and twelve ways to be wrong
// — so the resolved token is asked for, after the classes above have settled it.
//
// The document carries a static light value for first paint, before any of this runs. That
// is the right answer for the common case and a wrong one for a player who chose dark, by
// a frame: this corrects it on mount, on an OS change and on every pick, which is wherever
// applyTheme runs.
function paintBrowserChrome(root: HTMLElement): void {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta || typeof getComputedStyle !== "function") {
        return;
    }
    const raised = getComputedStyle(root).getPropertyValue("--color-raised").trim();
    if (raised) {
        meta.setAttribute("content", raised);
    }
}
