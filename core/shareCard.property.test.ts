// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    clampHeading,
    type Grid,
    gridEmoji,
    type Level,
    levelFor,
    SEGMENTS,
    shareText,
    svgCard,
} from "./shareCard";

// What a player posts after a run. It leaves Plinky and lands somewhere nobody can fix
// it, so the faults are permanent: a grid that reads one way on screen and another once
// shared, a card that will not render because a piece's title had an ampersand in it, a
// brag that turns out to be an advert.

const LEVELS: Level[] = ["best", "good", "ok", "weak", "none"];
const arbLevel = fc.constantFrom(...LEVELS);
const arbGrid: fc.Arbitrary<Grid> = fc.array(
    fc.array(arbLevel, { minLength: SEGMENTS, maxLength: SEGMENTS }),
    { minLength: 1, maxLength: 4 },
);
const arbValue = fc.double({ min: 0, max: 1, noNaN: true });

// A lone half of a surrogate pair makes the card's SVG ill-formed XML, which is why the
// heading is measured and cut in code points.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const arbHeading = fc.oneof(
    fc.string({ maxLength: 60 }),
    fc.constantFrom(
        "Rock & Roll",
        "<script>",
        'He said "hello"',
        "Prélude Op. 28 № 4",
        "🎹🎹🎹 Night Music 🎹🎹🎹",
        "&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&",
        "",
    ),
    fc
        .array(fc.constantFrom("🎹", "a", "&", "<"), { maxLength: 40 })
        .map((parts) => parts.join("")),
);

describe("the five bands a run is read in", () => {
    it("never reads a better run as a worse band", () => {
        fc.assert(
            fc.property(arbValue, arbValue, (lower, higher) => {
                fc.pre(lower <= higher);

                // The whole grid rests on this: a band table whose thresholds fell out
                // of order would show a better segment in a worse colour.
                expect(LEVELS.indexOf(levelFor(higher))).toBeLessThanOrEqual(
                    LEVELS.indexOf(levelFor(lower)),
                );
            }),
        );
    });

    it("answers with a band for any number at all", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    arbValue,
                    fc.constantFrom(-1, 0, 1, 2, Number.NaN, Number.POSITIVE_INFINITY),
                ),
                (value) => {
                    expect(LEVELS).toContain(levelFor(value));
                },
            ),
        );
    });

    it("can actually reach all five bands", () => {
        const reached = new Set<Level>();
        for (let value = 0; value <= 1.0001; value += 0.005) {
            reached.add(levelFor(value));
        }

        // Monotonicity alone does not catch a band that has become unreachable: a
        // threshold out of order still reads better runs as better, while one of the
        // five can never be returned and the grid quietly shows four colours.
        expect([...reached].sort()).toEqual([...LEVELS].sort());
    });

    it("keeps all five bands distinct wherever they are drawn", () => {
        // Iterated as code points, not UTF-16 units: four of the five band emoji
        // share a high surrogate, so splitting on "" counts halves rather than squares
        // — the very confusion clampHeading exists to avoid.
        const glyphs = [...gridEmoji([LEVELS])];
        const card = new DOMParser().parseFromString(svgCard([LEVELS], "x"), "image/svg+xml");
        // The first rect is the card's own ground; the rest are the bands.
        const fills = [...card.querySelectorAll("rect")]
            .slice(1)
            .map((rect) => rect.getAttribute("fill"));

        // Five levels, five glyphs, five fills. Folding a band into its neighbour — for
        // contrast, or by reusing a state colour — would quietly turn five bands into
        // four, and the emoji grid and the image card would stop agreeing.
        expect(new Set(glyphs).size).toBe(LEVELS.length);
        expect(new Set(fills).size).toBe(LEVELS.length);
    });
});

describe("the grid as a player posts it", () => {
    it("draws one square per segment, in the shape of the run", () => {
        fc.assert(
            fc.property(arbGrid, (grid) => {
                const rows = gridEmoji(grid).split("\n");

                expect(rows.length).toBe(grid.length);
                rows.forEach((row, at) => {
                    expect([...row].length).toBe((grid[at] as Level[]).length);
                });
            }),
        );
    });

    it("brags without advertising", () => {
        fc.assert(
            fc.property(arbGrid, fc.string({ maxLength: 40 }), (grid, boast) => {
                const text = shareText(boast, grid);

                expect(text.startsWith(boast)).toBe(true);
                expect(text).toContain(gridEmoji(grid));
                // No link, so a shared run reads as the player's own brag rather than
                // an ad; the credit lives on the image card instead.
                expect(text.toLowerCase()).not.toContain("http");
                expect(text.toLowerCase()).not.toContain("plinky.fun");
            }),
        );
    });
});

describe("the image card", () => {
    it("cuts a long title without breaking a character in half", () => {
        fc.assert(
            fc.property(arbHeading, (heading) => {
                const clamped = clampHeading(heading);

                expect([...clamped].length).toBeLessThanOrEqual(28);
                // Cut in code points: an emoji in a title is a surrogate pair, and half
                // of one makes the card ill-formed XML — so the share fails on exactly
                // the titles most likely to carry an emoji.
                expect(LONE_SURROGATE.test(clamped)).toBe(false);
                expect(clampHeading(clamped)).toBe(clamped);
                if ([...heading].length <= 28) {
                    expect(clamped).toBe(heading);
                }
            }),
        );
    });

    it("renders for any title a piece might have", () => {
        fc.assert(
            fc.property(arbGrid, arbHeading, (grid, heading) => {
                const svg = svgCard(grid, heading);

                const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
                // A title with an ampersand or an angle bracket is ordinary in a
                // catalogue, and an unescaped one would not render at all.
                expect(doc.querySelector("parsererror")).toBeNull();
                expect(doc.documentElement.tagName).toBe("svg");
                // One square per cell, plus the card's own ground.
                const cells = grid.reduce((sum, row) => sum + row.length, 0);
                expect(doc.querySelectorAll("rect").length).toBe(cells + 1);
            }),
        );
    });
});
