// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    computeSegments,
    gridEmoji,
    gridFor,
    levelFor,
    type RunNote,
    SEGMENTS,
    shareText,
    svgCard,
    toGrid,
} from "./shareCard";

// A note dead-on its target with no preceding mistakes — a perfect note.
function clean(): RunNote {
    return { targetMs: 0, playedMs: 0, wrongBefore: 0 };
}

describe("levelFor", () => {
    it("bands a value into strong / medium / weak", () => {
        expect(levelFor(1)).toBe("strong");
        expect(levelFor(0.85)).toBe("strong");
        expect(levelFor(0.84)).toBe("medium");
        expect(levelFor(0.5)).toBe("medium");
        expect(levelFor(0.49)).toBe("weak");
        expect(levelFor(0)).toBe("weak");
    });
});

describe("computeSegments", () => {
    it("always returns one entry per segment", () => {
        expect(computeSegments([])).toHaveLength(SEGMENTS);
        expect(computeSegments([clean()])).toHaveLength(SEGMENTS);
    });

    it("scores an empty segment zero on every dimension", () => {
        const [first] = computeSegments([]);
        expect(first).toEqual({ accuracy: 0, timing: 0, flow: 0 });
    });

    it("scores a flawless run full marks across the board", () => {
        const notes = Array.from({ length: 12 }, clean);
        for (const segment of computeSegments(notes)) {
            expect(segment).toEqual({ accuracy: 1, timing: 1, flow: 1 });
        }
    });

    it("splits notes into contiguous proportional slices", () => {
        // Twelve notes over six segments → two notes each; the wrong note lands in
        // the first slice only, so accuracy and flow drop there and nowhere else.
        const notes = Array.from({ length: 12 }, clean);
        notes[0] = { targetMs: 0, playedMs: 0, wrongBefore: 1 };
        const segments = computeSegments(notes);
        expect(segments[0]?.accuracy).toBeCloseTo(2 / 3); // 2 correct, 1 wrong
        expect(segments[0]?.flow).toBe(0.5); // 1 of 2 clean
        expect(segments[1]?.accuracy).toBe(1);
        expect(segments[1]?.flow).toBe(1);
    });

    it("ramps timing linearly to zero at 200ms off", () => {
        // Twelve notes → two per slice. The first slice holds notes 0 and 1: one
        // 100ms late (→ 0.5) and one dead-on (→ 1.0), averaging 0.75.
        const notes = Array.from({ length: 12 }, clean);
        notes[0] = { targetMs: 0, playedMs: 100, wrongBefore: 0 };
        expect(computeSegments(notes)[0]?.timing).toBeCloseTo(0.75);
    });

    it("clamps timing at zero beyond the window rather than going negative", () => {
        const notes = [{ targetMs: 0, playedMs: 5000, wrongBefore: 0 }];
        expect(computeSegments(notes)[0]?.timing).toBe(0);
    });
});

describe("toGrid / gridFor", () => {
    it("has one row per dimension and one column per segment", () => {
        const grid = gridFor(Array.from({ length: 6 }, clean));
        expect(grid).toHaveLength(3);
        for (const row of grid) {
            expect(row).toHaveLength(SEGMENTS);
        }
    });

    it("maps levels in dimension order: accuracy, timing, flow", () => {
        const segments = [
            { accuracy: 1, timing: 0.6, flow: 0 },
            { accuracy: 1, timing: 0.6, flow: 0 },
        ];
        const grid = toGrid(segments);
        expect(grid[0]?.[0]).toBe("strong"); // accuracy
        expect(grid[1]?.[0]).toBe("medium"); // timing
        expect(grid[2]?.[0]).toBe("weak"); // flow
    });
});

describe("gridEmoji", () => {
    it("renders three lines of emoji squares", () => {
        const text = gridEmoji(gridFor(Array.from({ length: 6 }, clean)));
        const lines = text.split("\n");
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe("🟩".repeat(SEGMENTS));
    });
});

describe("shareText", () => {
    it("stacks the boast, grid and link", () => {
        const grid = gridFor([clean()]);
        const text = shareText("My run on Plinky 🎹", grid, "https://plinky.fun");
        const lines = text.split("\n");
        expect(lines[0]).toBe("My run on Plinky 🎹");
        expect(lines.at(-1)).toBe("https://plinky.fun");
        // No digits leak into the share — the grid is the product, not a score.
        expect(text).not.toMatch(/\d+%/);
    });
});

describe("svgCard", () => {
    it("is well-formed SVG sized for a portrait social card", () => {
        const svg = svgCard(gridFor(Array.from({ length: 6 }, clean)), "Für Elise");
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain('width="1080"');
        expect(svg).toContain('height="1350"');
        // One rect per cell plus the background.
        expect(svg.match(/<rect/g)).toHaveLength(3 * SEGMENTS + 1);
    });

    it("escapes the heading so a title cannot break the markup", () => {
        const svg = svgCard(gridFor([clean()]), 'A & B <"x">');
        expect(svg).toContain("A &amp; B &lt;&quot;x&quot;&gt;");
        expect(svg).not.toContain('<"x">');
    });
});
