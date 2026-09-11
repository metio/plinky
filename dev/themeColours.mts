// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The colour a token or a Tailwind class paints in each theme, read off app.css and
// Tailwind's own palette — the same two sources the stylesheet is compiled from — so a
// test can measure what a class list will look like without building it.

import { over, parseColour, type Rgb } from "./contrast.mts";

export type Theme = "light" | "dark";

// The two halves of app.css's token layer, delimited by the headings
// dev/check-design-tokens.mjs reads them by.
const LIGHT_BLOCK = ["/* ── The colour tokens", "/* The dark half"] as const;
const DARK_BLOCK = ["/* The dark half", "/* Use self-hosted Inter"] as const;

function declarations(css: string): Map<string, string> {
    return new Map(
        [...css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
    );
}

function between(css: string, [from, to]: readonly [string, string]): string {
    const start = css.indexOf(from);
    const end = css.indexOf(to, start);
    if (start === -1 || end === -1) {
        throw new Error(`cannot find the "${from}" block in app.css`);
    }
    return css.slice(start, end);
}

export type ThemeColours = {
    // What `--color-<name>` resolves to in a theme: the dark block's value where it sets
    // one, else the light one, else Tailwind's palette step of that name.
    token(theme: Theme, name: string): Rgb;
    // Every background a class list can show in a theme, each with its opacity. A
    // `hover:` fill is included in both themes because it outranks a `dark:` one: the
    // compiled `.hover\:bg-x:hover` is more specific than `.dark\:bg-x:where(.dark …)`.
    fills(theme: Theme, classes: string): { colour: Rgb; alpha: number; name: string }[];
    // The ink a class list sets its text in.
    ink(theme: Theme, classes: string): { colour: Rgb; name: string };
};

export function themeColours(appCss: string, paletteCss: string): ThemeColours {
    const light = declarations(between(appCss, LIGHT_BLOCK));
    const dark = declarations(between(appCss, DARK_BLOCK));
    const palette = declarations(paletteCss);

    const token = (theme: Theme, name: string, seen: string[] = []): Rgb => {
        if (seen.includes(name)) {
            throw new Error(`--color-${name} refers to itself: ${[...seen, name].join(" → ")}`);
        }
        const raw =
            (theme === "dark" ? dark.get(name) : undefined) ?? light.get(name) ?? palette.get(name);
        if (raw === undefined) {
            throw new Error(`--color-${name} is defined in neither app.css nor Tailwind's palette`);
        }
        const ref = /^var\(--color-([\w-]+)\)$/.exec(raw);
        return ref ? token(theme, ref[1]!, [...seen, name]) : parseColour(raw);
    };

    const BACKGROUND = /^(?:(dark|hover):)?bg-([a-z][\w-]*?)(?:\/(\d+))?$/;
    const fills: ThemeColours["fills"] = (theme, classes) => {
        const found = classes
            .split(/\s+/)
            .map((cls) => BACKGROUND.exec(cls))
            .filter((m): m is RegExpExecArray => m !== null)
            .map((m) => ({ variant: m[1], name: m[2]!, alpha: m[3] ? Number(m[3]) / 100 : 1 }));
        const base = found.filter((f) => f.variant === undefined);
        const themed = found.filter((f) => f.variant === "dark");
        const hover = found.filter((f) => f.variant === "hover");
        const shown = [...(theme === "dark" && themed.length > 0 ? themed : base), ...hover];
        return shown.map((f) => ({ colour: token(theme, f.name), alpha: f.alpha, name: f.name }));
    };

    const ink: ThemeColours["ink"] = (theme, classes) => {
        const names = classes
            .split(/\s+/)
            .map((cls) => /^text-([a-z][\w-]*)$/.exec(cls)?.[1])
            .filter((name): name is string => name !== undefined && light.has(name));
        if (names.length !== 1) {
            throw new Error(
                `expected one text colour token in "${classes}", found ${names.length}`,
            );
        }
        return { colour: token(theme, names[0]!), name: names[0]! };
    };

    return { token, fills, ink };
}

// A translucent layer over a fill, as the screen shows it.
export function layered(top: { colour: Rgb; alpha: number }, under: Rgb): Rgb {
    return over(top.colour, top.alpha, under);
}
