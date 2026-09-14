// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, PALETTES } from "../core/theme";
import { contrast } from "./contrast.mts";
import { themeColours } from "./themeColours.mts";

// The pairings the chrome is built from, measured in every palette in every shade. The
// a11y sweep audits real pages, but only in the palette and mode it is run in, so a
// palette nobody swept — or the black mode — could put its text under the floor without
// any gate seeing it. This is where that fails, at the token, before a page is built.
//
// Each floor is the one the `violet` palette already clears, so a palette may look
// different but may not read worse.

const root = fileURLToPath(new URL("..", import.meta.url));
const colours = themeColours(
    readFileSync(join(root, "app", "app.css"), "utf8"),
    readFileSync(join(root, "node_modules", "tailwindcss", "theme.css"), "utf8"),
);

// The grounds text sits on, lightest to darkest in the light shade.
const GROUNDS = ["raised", "surface", "sunken", "subtle"];
// WCAG AA: 4.5:1 for text, 3:1 for large text and for the graphics a control is made of.
const TEXT = 4.5;
const GRAPHIC = 3;

type Rule = { ink: string; ground: string; floor: number };

const RULES: Rule[] = [
    // Running text and the accent's text, on every ground.
    ...["ink", "ink-soft", "body", "muted", "accent", "accent-strong", "spark-strong"].flatMap(
        (ink) => GROUNDS.map((ground) => ({ ink, ground, floor: TEXT })),
    ),
    // Receded glyphs, the focus ring and the reward colour, which is drawn as a border and
    // a large letter.
    ...["faint", "accent-ring", "spark"].flatMap((ink) =>
        GROUNDS.map((ground) => ({ ink, ground, floor: GRAPHIC })),
    ),
    { ink: "accent-soft", ground: "surface", floor: GRAPHIC },
    // Text on the tinted panels.
    { ink: "accent-ink", ground: "accent-surface", floor: TEXT },
    { ink: "accent-ink", ground: "accent-fill", floor: TEXT },
    { ink: "accent-strong", ground: "accent-surface", floor: TEXT },
    { ink: "body", ground: "accent-surface", floor: TEXT },
    { ink: "muted", ground: "accent-surface", floor: TEXT },
    { ink: "spark-strong", ground: "spark-surface", floor: TEXT },
    { ink: "spark", ground: "spark-surface", floor: GRAPHIC },
    // White on the filled button, at rest and under the pointer.
    { ink: "white", ground: "accent-solid", floor: TEXT },
    { ink: "white", ground: "accent-solid-hover", floor: TEXT },
];

const measured = colours.looks.flatMap((look) =>
    RULES.map((rule) => ({
        name: `${look.palette} ${look.shade}: ${rule.ink} on ${rule.ground}`,
        floor: rule.floor,
        ratio: contrast(colours.token(look, rule.ink), colours.token(look, rule.ground)),
    })),
);

describe("the chrome's colour pairings", () => {
    it("covers every palette the app offers, light, dark and black", () => {
        expect(new Set(colours.looks.map((look) => look.palette))).toEqual(new Set(PALETTES));
        expect(colours.looks).toHaveLength(PALETTES.length * 3);
    });

    it.each(measured)("$name clears $floor:1", ({ ratio, floor }) => {
        expect(ratio).toBeGreaterThanOrEqual(floor);
    });

    it("measures the grey-brown pencil on a card where the eye puts it", () => {
        // #736554 on white is 5.65:1. If this drifts, the measurement has come apart from
        // what a browser shows, and every pass above means nothing.
        const look = { palette: DEFAULT_PALETTE, shade: "light" } as const;
        expect(contrast(colours.token(look, "muted"), colours.token(look, "raised"))).toBeCloseTo(
            5.65,
            1,
        );
    });

    it("paints the black mode on a true-black ground in every palette", () => {
        for (const look of colours.looks.filter((l) => l.shade === "black")) {
            expect(colours.token(look, "surface")).toEqual([0, 0, 0]);
        }
    });
});
