// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The blocks of app.css's colour-token layer, read by selector: the default palette's
// light values in @theme and its dark ones under `.dark`; every other palette's overrides
// under `[data-palette="…"]` and `.dark[data-palette="…"]`; the black mode's grounds under
// `.dark.black`. The token gate (dev/check-design-tokens.mjs) and the contrast tests
// (dev/themeColours.mts) both read the stylesheet through this, so they agree on what a
// block is and on which value wins where two set the same token.

const START = "/* ── The colour tokens";
const END = "/* Use self-hosted Inter";

// Where a block sits in the cascade. @theme is emitted inside `@layer theme`, which any
// unlayered rule outranks; the rest are unlayered and rank by specificity, then by their
// order in the file.
function rankOf(selector) {
    if (selector === "@theme") return { kind: "light", palette: null, weight: 0 };
    if (selector === ".dark") return { kind: "dark", palette: null, weight: 1 };
    if (selector === ".dark.black") return { kind: "black", palette: null, weight: 2 };
    const palette = /^(\.dark)?\[data-palette="([\w-]+)"\]$/.exec(selector);
    if (palette) {
        return {
            kind: palette[1] ? "dark" : "light",
            palette: palette[2],
            weight: palette[1] ? 2 : 1,
        };
    }
    return null;
}

export function tokenLayers(css) {
    const start = css.indexOf(START);
    const end = css.indexOf(END, start);
    if (start === -1 || end === -1) {
        throw new Error(`cannot find the colour-token layer ("${START}") in app.css`);
    }
    // Comments go first: they sit between blocks and would otherwise read as part of the
    // next selector.
    const body = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = [];
    for (const [, rawSelector, rules] of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = rawSelector.trim().replace(/\s+/g, " ");
        const rank = rankOf(selector);
        if (rank === null) {
            throw new Error(`app.css's token layer has a block nobody reads: "${selector}"`);
        }
        const tokens = new Map(
            [...rules.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
        );
        blocks.push({ selector, ...rank, order: blocks.length, tokens });
    }
    const only = (kind) => {
        const found = blocks.filter((b) => b.palette === null && b.kind === kind);
        if (found.length !== 1) {
            throw new Error(`app.css's token layer needs exactly one ${kind} block`);
        }
        return found[0].tokens;
    };
    const palettes = new Map();
    for (const block of blocks.filter((b) => b.palette !== null)) {
        const entry = palettes.get(block.palette) ?? { light: null, dark: null };
        if (entry[block.kind] !== null) {
            throw new Error(`palette "${block.palette}" has two ${block.kind} blocks in app.css`);
        }
        entry[block.kind] = block.tokens;
        palettes.set(block.palette, entry);
    }
    return { light: only("light"), dark: only("dark"), black: only("black"), palettes, blocks };
}

// The value `--color-<name>` takes for a palette (null for the default) in a shade, as
// the browser settles it: of the blocks that apply, the one with the highest weight, and
// of those the last in the file. Undefined when no block sets it.
export function tokenValueIn(layers, palette, shade, name) {
    const applies = (b) =>
        (b.palette === null || b.palette === palette) &&
        (b.kind === "light" ||
            (b.kind === "dark" && shade !== "light") ||
            (b.kind === "black" && shade === "black"));
    const winner = layers.blocks
        .filter((b) => applies(b) && b.tokens.has(name))
        .sort((a, b) => b.weight - a.weight || b.order - a.order)[0];
    return winner?.tokens.get(name);
}

// Every way a palette can leave a token unset or unknown. The default palette is complete
// by construction once @theme and `.dark` agree, which the gate checks on its own; any
// other palette has to set, in both of its blocks, every token that any palette varies —
// one it skips would render the default palette's value inside the other palette.
export function paletteGaps(layers) {
    const gaps = [];
    const varying = new Set();
    for (const { light, dark } of layers.palettes.values()) {
        for (const block of [light, dark]) {
            for (const name of block?.keys() ?? []) varying.add(name);
        }
    }
    for (const [palette, entry] of layers.palettes) {
        for (const shade of ["light", "dark"]) {
            const block = entry[shade];
            if (block === null) {
                gaps.push(`palette "${palette}" has no ${shade} block`);
                continue;
            }
            for (const name of varying) {
                if (!block.has(name)) {
                    gaps.push(`palette "${palette}" sets no ${shade} value for \`${name}\``);
                }
            }
        }
    }
    for (const name of varying) {
        if (!layers.light.has(name)) {
            gaps.push(`\`${name}\` is set by a palette but never declared in @theme`);
        }
    }
    for (const name of layers.black.keys()) {
        if (!layers.light.has(name)) {
            gaps.push(`\`${name}\` is set by the black mode but never declared in @theme`);
        }
    }
    return gaps;
}
