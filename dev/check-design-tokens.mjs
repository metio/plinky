// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Keeps colour in the design system and out of the components.
//
// Two rules, both about the same failure. A colour written as a raw palette step
// carries one theme's value, so the other theme has to be spelled out beside it
// — `text-gray-500 dark:text-gray-400`. Nothing checks that the two halves agree,
// or that the second half is there at all, so they drift: the same intent gets
// two different light values, success arrives as both `green` and `emerald`, and
// a pair with no `dark:` half renders its light colour on a dark page. Every one
// of those is invisible until someone opens that screen in that theme.
//
// A token has one definition and resolves per theme on its own, so:
//
//   1. No raw palette colour utility under app/ or core/. `bg-indigo-600` names
//      a hue; `bg-accent-solid` names a role, defined once in app.css. core/ is
//      pure but still holds class strings, and the scales living there — the
//      grade letters — drift the same way a component would.
//   2. Every token declares both themes. A token that exists only in @theme
//      would silently render its light value on a dark page — exactly the bug
//      rule 1 exists to prevent — so a missing `.dark` entry fails here.
//   3. Every token is used. An unused one is a role nothing plays, and it makes
//      the next reader reach for a name the product does not actually have.
//   4. No `hover:`/`focus:`/`active:` utility resolves to the same token as the
//      base it sits beside. Naming colours by role invites exactly this: a fill
//      and its hover were two neighbouring palette steps, and folding both onto
//      one role leaves a control that no longer responds to the pointer. The
//      class compiles, the screen just stops reacting.
//
// Pure white and black are not palette steps and stay legal: white text on a
// solid fill and a black scrim over an image mean the same thing in both themes.
//
// Token names are read out of app.css, so adding a token there is all it takes
// to make it usable — there is no list here to keep in step.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "app", "app.css"), "utf8");

// The two halves of the token layer, delimited by their own headings.
function section(from, to) {
    const start = css.indexOf(from);
    const end = css.indexOf(to);
    if (start === -1 || end === -1 || end < start) {
        console.error(`check-design-tokens: cannot find the "${from}" block in app/app.css`);
        process.exit(1);
    }
    return css.slice(start, end);
}
const declared = (src) =>
    new Map([...src.matchAll(/--color-([\w-]+):\s*var\(--color-([\w-]+)\)/g)].map((m) => [m[1], m[2]]));

const light = declared(section("/* ── The colour tokens", "/* The dark half"));
const dark = declared(section("/* The dark half", "/* Use self-hosted Inter"));

const failures = [];

for (const name of light.keys()) {
    if (!dark.has(name)) {
        failures.push(
            `app/app.css  token \`${name}\` has no dark value — add it to the .dark block`,
        );
    }
}
for (const name of dark.keys()) {
    if (!light.has(name)) {
        failures.push(
            `app/app.css  \`${name}\` is set under .dark but never declared in @theme`,
        );
    }
}

// Which palette step each token resolves to, so a rejected utility can be told
// which token already means what it was reaching for. Kept per theme: gray-400
// is `faint` in light and `muted` in dark, and quoting the wrong one sends the
// reader to a token that looks nothing like what they wrote.
const byTheme = { light: new Map(), dark: new Map() };
for (const [name, value] of light) if (!byTheme.light.has(value)) byTheme.light.set(value, name);
for (const [name, value] of dark) if (!byTheme.dark.has(value)) byTheme.dark.set(value, name);
const suggest = (step, isDark) =>
    (isDark ? byTheme.dark : byTheme.light).get(step) ??
    (isDark ? byTheme.light : byTheme.dark).get(step);

const PROP =
    "bg|text|border|ring|outline|decoration|divide|from|to|via|shadow|accent|caret|fill|stroke|placeholder";
const HUE =
    "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_UTILITY = new RegExp(`^(?:[\\w-]+:)*(${PROP})-(${HUE})-(\\d{2,3})(?:/\\d+)?$`);
// A colour written straight into the class, which no theme can reach either —
// as a literal, or pulled back out of the palette through `theme(colors.…)`
// inside an arbitrary value, where it hides from the utility pattern above.
const LITERAL_UTILITY = new RegExp(`^(?:[\\w-]+:)*(?:${PROP})-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\()`);
const THEME_ESCAPE = /theme\(\s*colors\./;
// `dark:hover:bg-x` → prefix `dark:`, state `hover`, so the base it would have
// to differ from is `dark:bg-x` and not the light-theme one.
const STATE_UTILITY = new RegExp(
    `^((?:[\\w-]+:)*?)(hover|focus|focus-visible|focus-within|active|group-hover|group-focus):(${PROP})-([\\w-]+(?:/\\d+)?)$`,
);

const SKIP = new Set(["paraglide", "__screenshots__", "__story-shots__"]);
// The keyboard skins are the one place a palette belongs in source. Each entry
// is a whole named look the player picks — "sunset", "forest" — so its colours
// are the thing itself, not a role standing in for one, and they already sit in
// a single table beside the canvas hexes the video export paints with. There is
// no light/dark pair to drift here: a skin names its own `dark:` variant because
// the key it paints does not invert.
const EXEMPT = new Set(["core/keyboardTheme.ts"]);
function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(path));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
    }
    return out;
}

// Class lists only. A template literal contributes each static chunk separately
// so a `${…}` boundary cannot merge two class lists into one.
function classLists(src) {
    const out = [];
    const re =
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.|\$(?!\{))*(?:\$\{(?:[^{}]|\{[^{}]*\})*\}(?:[^`\\$]|\\.|\$(?!\{))*)*)`/g;
    for (const hit of src.matchAll(re)) {
        if (hit[0].startsWith("/")) continue;
        if (hit[3] === undefined) {
            out.push({ text: hit[1] ?? hit[2], offset: hit.index });
            continue;
        }
        let cursor = 0;
        for (const interp of hit[3].matchAll(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g)) {
            out.push({ text: hit[3].slice(cursor, interp.index), offset: hit.index });
            cursor = interp.index + interp[0].length;
        }
        out.push({ text: hit[3].slice(cursor), offset: hit.index });
    }
    return out;
}

const used = new Set();
for (const file of [...walk(join(root, "app")), ...walk(join(root, "core"))]) {
    const rel = file.slice(root.length + 1);
    if (EXEMPT.has(rel)) continue;
    const src = readFileSync(file, "utf8");
    for (const name of light.keys()) {
        if (new RegExp(`[-:]${name}(?![\\w-])`).test(src)) used.add(name);
    }
    for (const { text, offset } of classLists(src)) {
        const classes = text.split(/\s+/).filter(Boolean);
        for (const token of classes) {
            const state = STATE_UTILITY.exec(token);
            if (state) {
                const [, prefix, , prop, value] = state;
                const base = `${prefix ?? ""}${prop}-${value}`;
                if (classes.includes(base)) {
                    const line = src.slice(0, offset).split("\n").length;
                    failures.push(
                        `${rel}:${line}  \`${token}\` resolves to the same colour as \`${base}\`, so it does nothing`,
                    );
                }
            }
            const palette = PALETTE_UTILITY.exec(token);
            const literal = !palette && (LITERAL_UTILITY.test(token) || THEME_ESCAPE.test(token));
            if (!palette && !literal) continue;
            const line = src.slice(0, offset).split("\n").length;
            const where = `${rel}:${line}`;
            if (literal) {
                failures.push(`${where}  \`${token}\` writes a colour straight into the class`);
                continue;
            }
            const [, prop, hue, step] = palette;
            const hit = suggest(`${hue}-${step}`, token.startsWith("dark:"));
            failures.push(
                `${where}  \`${token}\` names a hue, not a role` +
                    (hit ? ` — \`${prop}-${hit}\` already resolves to ${hue}-${step}` : ""),
            );
        }
    }
}

for (const name of light.keys()) {
    if (!used.has(name)) {
        failures.push(`app/app.css  token \`${name}\` is declared but nothing uses it`);
    }
}

if (failures.length > 0) {
    console.error(`check-design-tokens: ${failures.length} colour(s) outside the token layer:`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(
        "\nEvery colour is named for its role in app/app.css. Use the token, or add one\n" +
            "there (both themes) if the role is genuinely new.",
    );
    process.exit(1);
}
console.log(
    `check-design-tokens: ${light.size} tokens, both themes each; no raw palette colours.`,
);
