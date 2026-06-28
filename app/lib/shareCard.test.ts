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
    svgCard,
    toGrid,
} from "./shareCard";

// A note dead-on its target with no preceding mistakes — a perfect note.
function clean(): RunNote {
    return { targetMs: 0, playedMs: 0, wrongBefore: 0 };
}

// A run of evenly-spaced notes played dead on the notated tempo — the baseline a
// drift-corrected timing reads as flawless. Timing is judged per gap, so the notes
// need real spacing (unlike the all-at-zero `clean`).
function spaced(count: number): RunNote[] {
    return Array.from({ length: count }, (_, i) => ({
        targetMs: i * 100,
        playedMs: i * 100,
        wrongBefore: 0,
    }));
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

    it("ramps timing linearly to zero at 200ms off the player's pace", () => {
        // Twelve notes → two per slice. The first slice holds notes 0 and 1: note 1's
        // gap runs 200ms instead of the steady 100ms (100ms off → 0.5), note 0
        // anchors (→ 1.0), averaging 0.75.
        const notes = spaced(12);
        notes[1] = { targetMs: 100, playedMs: 200, wrongBefore: 0 };
        expect(computeSegments(notes)[0]?.timing).toBeCloseTo(0.75);
    });

    it("reads a steady run at a different tempo as full timing", () => {
        // Played at half the notated speed but perfectly even — self-paced practice,
        // so an even slow run is in time, not chronically late.
        const notes = Array.from({ length: 12 }, (_, i) => ({
            targetMs: i * 100,
            playedMs: i * 200,
            wrongBefore: 0,
        }));
        for (const segment of computeSegments(notes)) {
            expect(segment.timing).toBeCloseTo(1);
        }
    });

    it("widens the timing window for imprecise input", () => {
        // Note 1's gap is 300ms off the pace: weak on a precise run, but stronger
        // once the window is widened for an on-screen / computer-keyboard run.
        const notes = spaced(12);
        notes[1] = { targetMs: 100, playedMs: 400, wrongBefore: 0 };
        const precise = computeSegments(notes)[0]?.timing ?? 0;
        const lenient = computeSegments(notes, SEGMENTS, LENIENT_TOLERANCE)[0]?.timing ?? 0;
        expect(lenient).toBeGreaterThan(precise);
    });

    it("clamps timing at zero beyond the window rather than going negative", () => {
        // Six notes → one per slice; note 3's gap is dropped far off the pace.
        const notes = spaced(6);
        notes[3] = { targetMs: 300, playedMs: 60000, wrongBefore: 0 };
        expect(computeSegments(notes)[3]?.timing).toBe(0);
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
    it("stacks the boast over the grid with no link", () => {
        const grid = gridFor([clean()]);
        const text = shareText("My run on Plinky 🎹", grid);
        const lines = text.split("\n");
        expect(lines[0]).toBe("My run on Plinky 🎹");
        // No link — a shared run is a brag, not an ad — and no digits, since the
        // grid is the product, not a score.
        expect(text).not.toMatch(/https?:|plinky\.fun/);
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
