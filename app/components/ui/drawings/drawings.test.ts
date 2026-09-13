// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DRAWINGS } from "./drawing";

// The sprite is hand-drawn, so the hand is held here: one grid, one stroke, one set of inks.
const SPRITE = readFileSync(new URL("./drawings.svg", import.meta.url), "utf8");

const SYMBOLS = [
    ...SPRITE.matchAll(
        /<symbol id="([^"]+)" viewBox="([^"]+)" style="([^"]+)">([\s\S]*?)<\/symbol>/g,
    ),
].map(([, id, viewBox, style, body]) => ({
    id: id ?? "",
    viewBox: viewBox ?? "",
    style: style ?? "",
    body: body ?? "",
}));

const INKS = ["var(--s)", "var(--g)", "var(--a)", "var(--p)"];

describe("the drawings sprite", () => {
    it("draws every named drawing, and nothing that has no name", () => {
        expect(SYMBOLS.map((symbol) => symbol.id).sort()).toEqual([...DRAWINGS].sort());
        expect(SPRITE.match(/<symbol\b/g)).toHaveLength(DRAWINGS.length);
    });

    it("draws every one on the 72×56 grid", () => {
        for (const symbol of SYMBOLS) expect(symbol.viewBox, symbol.id).toBe("0 0 72 56");
    });

    it("gives every one the one stroke, round at its ends and its joins", () => {
        for (const symbol of SYMBOLS) {
            expect(symbol.style, symbol.id).toContain(
                "fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round",
            );
        }
    });

    it("takes its four inks from the art properties, and the art tokens behind them", () => {
        for (const symbol of SYMBOLS) {
            expect(symbol.style, symbol.id).toContain(
                "--s:var(--art-stroke,var(--color-art-stroke));" +
                    "--g:var(--art-fill,var(--color-art-ground));" +
                    "--a:var(--art-accent,var(--color-art-accent));" +
                    "--p:var(--art-paper,var(--color-art-paper));",
            );
        }
    });

    it("sets a soft ground behind every object, before anything else is drawn", () => {
        for (const symbol of SYMBOLS) {
            expect(symbol.body.trimStart(), symbol.id).toMatch(/^<ellipse style="fill:var\(--g\)"/);
        }
    });

    it("paints with the four inks alone", () => {
        for (const symbol of SYMBOLS) {
            for (const [, , value] of symbol.body.matchAll(/(fill|stroke):([^;"]+)/g)) {
                expect(INKS, `${symbol.id} paints ${value}`).toContain(value);
            }
        }
        // No colour written straight in, no presentation attribute a palette cannot reach,
        // and no class, which the page's styles could not reach inside a <use> anyway.
        expect(SPRITE).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        expect(SPRITE).not.toMatch(/\s(fill|stroke|class)="/);
    });

    it("draws staff lines thinner and fainter than the objects on them", () => {
        for (const symbol of SYMBOLS) {
            for (const [, width] of symbol.body.matchAll(/stroke-width:([\d.]+)/g)) {
                // 1.3 is a staff line; 1.8 is a note's stem, which a notehead's width sets.
                expect(["1.3", "1.8"], `${symbol.id} strokes at ${width}`).toContain(width);
            }
            for (const line of symbol.body.matchAll(/stroke-width:1\.3;[^"]*/g)) {
                expect(line[0], symbol.id).toContain("opacity:.75");
            }
        }
    });
});
