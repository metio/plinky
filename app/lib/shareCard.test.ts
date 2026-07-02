// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { LENIENT_TOLERANCE } from "./rhythm";
import {
    computeSegments,
    gridEmoji,
    gridFor,
    levelFor,
    type RunNote,
    SEGMENTS,
    shareText,
    speedFactors,
    svgCard,
    toGrid,
} from "./shareCard";

// A note dead-on its target with no preceding mistakes — a perfect note.
function clean(): RunNote {
    return { targetMs: 0, playedMs: 0, wrongBefore: 0 };
}

// A run of evenly-spaced notes played dead on the notated tempo — flawless on timing and
// at-tempo on speed. Notes need real spacing (unlike the all-at-zero `clean`) so the
// per-gap timing and speed have something to measure.
function spaced(count: number): RunNote[] {
    return Array.from({ length: count }, (_, i) => ({
        targetMs: i * 100,
        playedMs: i * 100,
        wrongBefore: 0,
    }));
}

// The same phrase played `factor` times slower than notated (a mouse-plodder at factor 2
// takes twice as long) — steady, but off the piece's tempo.
function slow(count: number, factor: number): RunNote[] {
    return Array.from({ length: count }, (_, i) => ({
        targetMs: i * 100,
        playedMs: i * 100 * factor,
        wrongBefore: 0,
    }));
}

describe("levelFor", () => {
    it("bands a value across five tiers, good landing green and weak still coloured", () => {
        expect(levelFor(1)).toBe("best");
        expect(levelFor(0.78)).toBe("best");
        expect(levelFor(0.77)).toBe("good");
        expect(levelFor(0.58)).toBe("good");
        expect(levelFor(0.57)).toBe("ok");
        expect(levelFor(0.38)).toBe("ok");
        expect(levelFor(0.37)).toBe("weak");
        expect(levelFor(0.31)).toBe("weak");
        expect(levelFor(0.12)).toBe("weak");
        expect(levelFor(0.11)).toBe("none");
        expect(levelFor(0)).toBe("none");
    });
});

describe("speedFactors", () => {
    it("reads a run at the notated tempo as full speed", () => {
        expect(speedFactors(spaced(4))).toEqual([1, 1, 1, 1]);
    });

    it("reads a half-speed run as half speed", () => {
        // Each gap runs twice as long as notated → 100/200 = 0.5.
        expect(speedFactors(slow(4, 2))).toEqual([0.5, 0.5, 0.5, 0.5]);
    });

    it("caps playing faster than the piece at the top rather than rewarding past it", () => {
        // Gaps half the notated length → ratio 2, clamped to 1.
        expect(speedFactors(slow(4, 0.5))).toEqual([1, 1, 1, 1]);
    });

    it("scales by how the run's tempo related to the piece's", () => {
        // Played dead-on the practice tempo, but that tempo was half the piece's → 0.5.
        expect(speedFactors(spaced(4), 0.5)).toEqual([0.5, 0.5, 0.5, 0.5]);
    });

    it("gives the opening note the next note's pace, not an unmeasurable gap", () => {
        const speeds = speedFactors(slow(3, 2));
        expect(speeds[0]).toBe(speeds[1]);
    });
});

describe("computeSegments", () => {
    it("always returns one entry per segment", () => {
        expect(computeSegments([])).toHaveLength(SEGMENTS);
        expect(computeSegments([clean()])).toHaveLength(SEGMENTS);
    });

    it("scores an empty segment zero on every dimension", () => {
        const [first] = computeSegments([]);
        expect(first).toEqual({ accuracy: 0, speed: 0, timing: 0 });
    });

    it("scores an at-tempo flawless run full marks across the board", () => {
        for (const segment of computeSegments(spaced(12))) {
            expect(segment.accuracy).toBe(1);
            expect(segment.speed).toBeCloseTo(1);
            expect(segment.timing).toBeCloseTo(1);
        }
    });

    it("separates a slow, careful run: full timing but low speed", () => {
        // The mouse-plodder case — every note right and evenly spaced, but at a third of
        // the tempo. Timing (self-paced) still reads flawless; speed exposes the crawl.
        const segments = computeSegments(slow(12, 3));
        for (const segment of segments) {
            expect(segment.accuracy).toBe(1);
            expect(segment.timing).toBeCloseTo(1);
            expect(segment.speed).toBeCloseTo(1 / 3);
        }
        // …and that lands the speed row on a coloured (non-green) band.
        expect(toGrid(segments, ["accuracy", "speed", "timing"])[1]?.[0]).not.toBe("best");
    });

    it("drops accuracy in just the slice that holds a wrong note", () => {
        const notes = spaced(12);
        notes[0] = { targetMs: 0, playedMs: 0, wrongBefore: 1 };
        const segments = computeSegments(notes);
        expect(segments[0]?.accuracy).toBeCloseTo(2 / 3); // 2 correct, 1 wrong
        expect(segments[1]?.accuracy).toBe(1);
    });

    it("ramps timing linearly to zero at 200ms off the player's pace", () => {
        const notes = spaced(12);
        notes[1] = { targetMs: 100, playedMs: 200, wrongBefore: 0 };
        expect(computeSegments(notes)[0]?.timing).toBeCloseTo(0.75);
    });

    it("reads a steady run at a different tempo as full timing", () => {
        for (const segment of computeSegments(slow(12, 2))) {
            expect(segment.timing).toBeCloseTo(1);
        }
    });

    it("widens the timing window for imprecise input when asked", () => {
        const notes = spaced(12);
        notes[1] = { targetMs: 100, playedMs: 400, wrongBefore: 0 };
        const precise = computeSegments(notes)[0]?.timing ?? 0;
        const lenient =
            computeSegments(notes, SEGMENTS, { tolerance: LENIENT_TOLERANCE })[0]?.timing ?? 0;
        expect(lenient).toBeGreaterThan(precise);
    });

    it("clamps timing at zero beyond the window rather than going negative", () => {
        const notes = spaced(6);
        notes[3] = { targetMs: 300, playedMs: 60000, wrongBefore: 0 };
        expect(computeSegments(notes)[3]?.timing).toBe(0);
    });
});

describe("toGrid / gridFor", () => {
    it("has one row per dimension and one column per segment", () => {
        const grid = gridFor(spaced(6));
        expect(grid).toHaveLength(3);
        for (const row of grid) {
            expect(row).toHaveLength(SEGMENTS);
        }
    });

    it("maps levels in dimension order: accuracy, speed, timing", () => {
        const segments = [
            { accuracy: 1, speed: 0.7, timing: 0.3 },
            { accuracy: 1, speed: 0.7, timing: 0.3 },
        ];
        const grid = toGrid(segments, ["accuracy", "speed", "timing"]);
        expect(grid[0]?.[0]).toBe("best"); // accuracy 1.0 → green
        expect(grid[1]?.[0]).toBe("good"); // speed 0.7 → yellow
        expect(grid[2]?.[0]).toBe("weak"); // timing 0.3 → red
    });

    it("is generic over the dimension set", () => {
        const grid = toGrid([{ a: 1, b: 0 }], ["a", "b"]);
        expect(grid).toEqual([["best"], ["none"]]);
    });
});

describe("gridEmoji", () => {
    it("renders one line of emoji squares per dimension, with no leading glyph", () => {
        const text = gridEmoji(gridFor(spaced(6)));
        const lines = text.split("\n");
        expect(lines).toHaveLength(3);
        for (const line of lines) {
            expect(line).toBe("🟩".repeat(SEGMENTS));
        }
    });
});

describe("shareText", () => {
    it("stacks the boast over the grid with no link", () => {
        const grid = gridFor([clean()]);
        const text = shareText("My run on Plinky 🎹", grid);
        const lines = text.split("\n");
        expect(lines[0]).toBe("My run on Plinky 🎹");
        expect(text).not.toMatch(/https?:|plinky\.fun/);
        expect(text).not.toMatch(/\d+%/);
    });
});

// Visual-regression coverage of the coloured blocks. The share card's output is
// deterministic markup — an emoji grid and an SVG string — not a rasterised bitmap, so a
// snapshot is byte-identical on every platform: true visual regression with none of the
// cross-OS font/anti-aliasing flakiness that dogs pixel diffing. A snapshot change here
// means the shared card visibly changed; review it, don't blindly update it.
describe("coloured blocks (visual regression)", () => {
    it("paints an at-tempo run all green", () => {
        expect(gridEmoji(gridFor(spaced(12)))).toMatchInlineSnapshot(`
          "🟩🟩🟩🟩🟩🟩
          🟩🟩🟩🟩🟩🟩
          🟩🟩🟩🟩🟩🟩"
        `);
    });

    it("flags the speed row red for a slow-but-accurate run, notes and timing still green", () => {
        // The discrimination the rebalance exists for: right notes, steady, but a third of
        // the tempo — Accuracy and Timing stay green while Speed goes red.
        expect(gridEmoji(gridFor(slow(12, 3)))).toMatchInlineSnapshot(`
          "🟩🟩🟩🟩🟩🟩
          🟥🟥🟥🟥🟥🟥
          🟩🟩🟩🟩🟩🟩"
        `);
    });

    it("reads an abandoned run as empty blocks", () => {
        expect(gridEmoji(gridFor([]))).toMatchInlineSnapshot(`
          "⬜⬜⬜⬜⬜⬜
          ⬜⬜⬜⬜⬜⬜
          ⬜⬜⬜⬜⬜⬜"
        `);
    });

    it("renders the same blocks as coloured SVG rects — 12 green, 6 red for the slow run", () => {
        const svg = svgCard(gridFor(slow(12, 3)), "Test");
        // Accuracy + Timing rows are green (#22c55e), the Speed row red (#ef4444).
        expect((svg.match(/#22c55e/g) ?? []).length).toBe(12);
        expect((svg.match(/#ef4444/g) ?? []).length).toBe(6);
    });
});

describe("svgCard", () => {
    it("is well-formed SVG sized for a portrait social card", () => {
        const svg = svgCard(gridFor(spaced(6)), "Für Elise");
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain('width="1080"');
        expect(svg).toContain('height="1350"');
        expect(svg.match(/<rect/g)).toHaveLength(3 * SEGMENTS + 1);
    });

    it("escapes the heading so a title cannot break the markup", () => {
        const svg = svgCard(gridFor([clean()]), 'A & B <"x">');
        expect(svg).toContain("A &amp; B &lt;&quot;x&quot;&gt;");
        expect(svg).not.toContain('<"x">');
    });
});
