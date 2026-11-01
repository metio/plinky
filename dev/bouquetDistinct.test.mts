// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOUQUET, PETALS } from "../core/bouquet";
import { distance } from "./contrast.mts";
import { themeColours } from "./themeColours.mts";

// The bouquet's five colours set side by side — the bar under the header, the petals of
// the greeting's flower — and the one thing asked of them is that they look like five
// colours. Nothing else checks it: each clears its contrast floor against the page on its
// own, and two fills can both clear it handsomely while being the same colour as each
// other. The a11y sweep scores neither, because decoration carries no information to lose.
//
// This is the measurement that would have caught the brand moving onto a petal: `tinkle`
// took the mark's fuchsia and landed within a degree of the pink beside it, which turned
// five petals into four in both themes and every palette at once.

const root = fileURLToPath(new URL("..", import.meta.url));
const colours = themeColours(
    readFileSync(join(root, "app", "app.css"), "utf8"),
    readFileSync(join(root, "node_modules", "tailwindcss", "theme.css"), "utf8"),
);

// Oklab distance. The closest pair that ships is `indigo`'s reward blue against the sky at
// 0.076, which reads as two colours because they differ in lightness; the collision this
// exists for measured 0.017. The floor sits between them, nearer the collision.
const APART = 0.05;

const token = (fill: string) => fill.replace(/^bg-/, "");

const pairings = colours.looks.flatMap((look) =>
    [
        { what: "the bar under the header", fills: BOUQUET },
        { what: "the greeting's petals", fills: PETALS },
    ].flatMap(({ what, fills }) =>
        fills.flatMap((one, at) =>
            fills.slice(at + 1).map((other) => ({
                name: `${look.palette} ${look.shade}, ${what}: ${token(one)} beside ${token(other)}`,
                apart: distance(colours.token(look, token(one)), colours.token(look, token(other))),
            })),
        ),
    ),
);

describe("the bouquet's five colours", () => {
    it.each(pairings)("$name are different colours", ({ apart }) => {
        expect(apart).toBeGreaterThanOrEqual(APART);
    });

    it("measures both bouquets in every palette and shade", () => {
        const pairs = (BOUQUET.length * (BOUQUET.length - 1)) / 2;
        expect(BOUQUET).toHaveLength(5);
        expect(PETALS).toHaveLength(5);
        expect(pairings).toHaveLength(colours.looks.length * pairs * 2);
    });

    it("would have caught the brand landing on the petal beside it", () => {
        // The pink `tinkle` displaced. If this stops measuring under the floor, the
        // measurement has drifted and every pass above means nothing.
        const look = { palette: "fuchsia", shade: "light" } as const;
        const brand = colours.token(look, "tinkle");
        expect(distance(brand, parse("#e0359a"))).toBeLessThan(APART);
        expect(distance(brand, colours.token(look, "bloom-violet"))).toBeGreaterThan(APART);
    });
});

function parse(hex: string) {
    const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return [0, 2, 4].map((at) =>
        toLinear(Number.parseInt(hex.slice(at + 1, at + 3), 16) / 255),
    ) as unknown as readonly [number, number, number];
}
