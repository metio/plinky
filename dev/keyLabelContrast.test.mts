// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOLD_FILL, keyFaces } from "../core/keyFace";
import { KEYBOARD_THEMES } from "../core/keyboardTheme";
import type { KeyState } from "../core/keyState";
import { contrast } from "./contrast.mts";
import { layered, type Theme, themeColours } from "./themeColours.mts";

// Every note name the on-screen keyboard can print, measured against every fill it can sit
// on: each skin, both key colours, every state, both themes, bare and under the hold bar.
// The a11y sweep only sees the keys a page happens to render at rest, and axe does not
// score a one-letter name at all — so a label under the floor on a lit key, a pastel skin
// or a dark-theme fill is invisible to it, and this is where such a token change fails.

const root = fileURLToPath(new URL("..", import.meta.url));
const colours = themeColours(
    readFileSync(join(root, "app", "app.css"), "utf8"),
    readFileSync(join(root, "node_modules", "tailwindcss", "theme.css"), "utf8"),
);

// WCAG AA for normal text. The names are ten pixels (eight on a black key), far under the
// size at which the large-text 3:1 would apply.
const FLOOR = 4.5;
const STATES: KeyState[] = ["rest", "next", "held", "left", "right", "wrong"];
const THEMES: Theme[] = ["light", "dark"];

type Pairing = { name: string; ratio: number };

const pairings: Pairing[] = [];
for (const theme of THEMES) {
    const [hold] = colours.fills(theme, HOLD_FILL);
    for (const skin of KEYBOARD_THEMES) {
        const faces = keyFaces(skin);
        for (const colour of ["white", "black"] as const) {
            for (const state of STATES) {
                const face = faces[colour][state];
                const ink = colours.ink(theme, face.label);
                for (const fill of colours.fills(theme, face.fill)) {
                    const where = `${theme} ${skin.id} ${colour} key, ${state}: ${ink.name} on ${fill.name}`;
                    pairings.push({ name: where, ratio: contrast(ink.colour, fill.colour) });
                    pairings.push({
                        name: `${where} under the hold bar`,
                        ratio: contrast(ink.colour, layered(hold!, fill.colour)),
                    });
                }
            }
        }
    }
}

describe("the note names on the keyboard", () => {
    it.each(pairings)("$name clears 4.5:1", ({ ratio }) => {
        expect(ratio).toBeGreaterThanOrEqual(FLOOR);
    });

    it("measures every skin, both key colours and every state, in both themes", () => {
        // Two fills per resting white key (its colour and its hover), one per lit state,
        // each bare and under the bar; a count well short of this means a class list the
        // parser did not read.
        expect(pairings.length).toBeGreaterThanOrEqual(
            THEMES.length * KEYBOARD_THEMES.length * 2 * STATES.length * 2,
        );
    });

    it("would have caught the pale grey the names were printed in", () => {
        // gray-400 on a white key is the pairing the a11y sweep found once the names grew
        // past one letter. If this stops measuring under the floor, the measurement has
        // drifted from what a browser shows, and every pass above means nothing.
        const pale = colours.token("light", "gray-400");
        const white = colours.token("light", "key-white");
        expect(contrast(pale, white)).toBeLessThan(FLOOR);
        expect(contrast(pale, white)).toBeCloseTo(2.6, 1);
    });
});
