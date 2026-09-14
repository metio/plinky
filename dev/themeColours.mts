// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The colour a token or a Tailwind class paints in each palette and shade, read off
// app.css and Tailwind's own palette — the same two sources the stylesheet is compiled
// from — so a test can measure what a class list will look like without building it.

import { DEFAULT_PALETTE } from "../core/theme";
import { over, parseColour, type Rgb } from "./contrast.mts";
import { type Shade, tokenLayers, tokenValueIn } from "./tokenLayers.mjs";

export type { Shade };

// One way the page can look: a palette, painted light, dark or black.
export type Look = { palette: string; shade: Shade };

const SHADES: Shade[] = ["light", "dark", "black"];

function declarations(css: string): Map<string, string> {
    return new Map(
        [...css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
    );
}

export type ThemeColours = {
    // Every palette the stylesheet defines, in every shade.
    looks: Look[];
    // What `--color-<name>` resolves to in a look: the value the cascade settles on
    // among app.css's blocks, else Tailwind's palette step of that name.
    token(look: Look, name: string): Rgb;
    // Every background a class list can show in a look, each with its opacity. A
    // `hover:` fill is included in every shade because it outranks a `dark:` one: the
    // compiled `.hover\:bg-x:hover` is more specific than `.dark\:bg-x:where(.dark …)`.
    fills(look: Look, classes: string): { colour: Rgb; alpha: number; name: string }[];
    // The ink a class list sets its text in.
    ink(look: Look, classes: string): { colour: Rgb; name: string };
};

export function themeColours(appCss: string, paletteCss: string): ThemeColours {
    const layers = tokenLayers(appCss);
    const tailwind = declarations(paletteCss);
    const palettes = [DEFAULT_PALETTE as string, ...layers.palettes.keys()];
    const looks = palettes.flatMap((palette) => SHADES.map((shade) => ({ palette, shade })));

    const token = (look: Look, name: string, seen: string[] = []): Rgb => {
        if (seen.includes(name)) {
            throw new Error(`--color-${name} refers to itself: ${[...seen, name].join(" → ")}`);
        }
        const palette = look.palette === DEFAULT_PALETTE ? null : look.palette;
        const raw = tokenValueIn(layers, palette, look.shade, name) ?? tailwind.get(name);
        if (raw === undefined) {
            throw new Error(`--color-${name} is defined in neither app.css nor Tailwind's palette`);
        }
        const ref = /^var\(--color-([\w-]+)\)$/.exec(raw);
        return ref ? token(look, ref[1]!, [...seen, name]) : parseColour(raw);
    };

    const BACKGROUND = /^(?:(dark|hover):)?bg-([a-z][\w-]*?)(?:\/(\d+))?$/;
    const fills: ThemeColours["fills"] = (look, classes) => {
        const found = classes
            .split(/\s+/)
            .map((cls) => BACKGROUND.exec(cls))
            .filter((m): m is RegExpExecArray => m !== null)
            .map((m) => ({ variant: m[1], name: m[2]!, alpha: m[3] ? Number(m[3]) / 100 : 1 }));
        const base = found.filter((f) => f.variant === undefined);
        const themed = found.filter((f) => f.variant === "dark");
        const hover = found.filter((f) => f.variant === "hover");
        const isDark = look.shade !== "light";
        const shown = [...(isDark && themed.length > 0 ? themed : base), ...hover];
        return shown.map((f) => ({ colour: token(look, f.name), alpha: f.alpha, name: f.name }));
    };

    const ink: ThemeColours["ink"] = (look, classes) => {
        const names = classes
            .split(/\s+/)
            .map((cls) => /^text-([a-z][\w-]*)$/.exec(cls)?.[1])
            .filter((name): name is string => name !== undefined && layers.light.has(name));
        if (names.length !== 1) {
            throw new Error(
                `expected one text colour token in "${classes}", found ${names.length}`,
            );
        }
        return { colour: token(look, names[0]!), name: names[0]! };
    };

    return { looks, token, fills, ink };
}

// A translucent layer over a fill, as the screen shows it.
export function layered(top: { colour: Rgb; alpha: number }, under: Rgb): Rgb {
    return over(top.colour, top.alpha, under);
}
