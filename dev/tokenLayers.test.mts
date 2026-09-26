// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, PALETTES } from "../core/theme";
import { paletteGaps, tokenLayers, tokenValueIn } from "./tokenLayers.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const appCss = readFileSync(join(root, "app", "app.css"), "utf8");

// A token layer of our own, framed by the same headings app.css uses.
const layer = (blocks: string) =>
    `/* ── The colour tokens */\n${blocks}\n/* Use self-hosted Inter */`;

const FULL = layer(`
@theme { --color-ink: #111; --color-line: #aaa; }
/* a comment { with braces } between blocks */
.dark { --color-ink: #222; --color-line: #bbb; }
[data-palette="sea"] { --color-ink: #333; }
.dark[data-palette="sea"] { --color-ink: #444; }
.dark.black { --color-ink: #555; }
`);

describe("tokenLayers", () => {
    it("reads app.css into palettes the app offers, every one complete", () => {
        const layers = tokenLayers(appCss);
        expect(new Set([DEFAULT_PALETTE, ...layers.palettes.keys()])).toEqual(new Set(PALETTES));
        expect(paletteGaps(layers)).toEqual([]);
    });

    it("settles a token the way the browser would", () => {
        const layers = tokenLayers(FULL);
        expect(tokenValueIn(layers, null, "light", "ink")).toBe("#111");
        expect(tokenValueIn(layers, null, "dark", "ink")).toBe("#222");
        expect(tokenValueIn(layers, null, "black", "ink")).toBe("#555");
        expect(tokenValueIn(layers, "sea", "light", "ink")).toBe("#333");
        expect(tokenValueIn(layers, "sea", "dark", "ink")).toBe("#444");
        // The black mode swaps the ground for either palette.
        expect(tokenValueIn(layers, "sea", "black", "ink")).toBe("#555");
        // A token the palette leaves alone keeps the default's value in each shade.
        expect(tokenValueIn(layers, "sea", "black", "line")).toBe("#bbb");
        expect(tokenValueIn(layers, "sea", "light", "line")).toBe("#aaa");
    });

    it("refuses a block nobody reads", () => {
        expect(() => tokenLayers(layer("@theme {} .dark {} .dark.black {} .sepia {}"))).toThrow(
            /nobody reads/,
        );
    });
});

describe("paletteGaps", () => {
    it("finds nothing missing in a complete palette", () => {
        expect(paletteGaps(tokenLayers(FULL))).toEqual([]);
    });

    it("names a token a palette varies in one mode and forgets in the other", () => {
        const css = layer(`
@theme { --color-ink: #111; --color-line: #aaa; }
.dark { --color-ink: #222; --color-line: #bbb; }
[data-palette="sea"] { --color-ink: #333; --color-line: #999; }
.dark[data-palette="sea"] { --color-ink: #444; }
.dark.black {}
`);
        expect(paletteGaps(tokenLayers(css))).toEqual([
            'palette "sea" sets no dark value for `line`',
        ]);
    });

    it("names a palette with no dark block at all", () => {
        const css = layer(`
@theme { --color-ink: #111; }
.dark { --color-ink: #222; }
[data-palette="sea"] { --color-ink: #333; }
.dark.black {}
`);
        expect(paletteGaps(tokenLayers(css))).toEqual(['palette "sea" has no dark block']);
    });

    it("names a token a palette invents", () => {
        const css = layer(`
@theme { --color-ink: #111; }
.dark { --color-ink: #222; }
[data-palette="sea"] { --color-ink: #333; --color-foam: #fff; }
.dark[data-palette="sea"] { --color-ink: #444; --color-foam: #eee; }
.dark.black { --color-glow: #000; }
`);
        expect(paletteGaps(tokenLayers(css))).toEqual([
            "`foam` is set by a palette but never declared in @theme",
            "`glow` is set by the black mode but never declared in @theme",
        ]);
    });
});
