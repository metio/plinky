// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { LENIENT_TOLERANCE } from "./rhythm";
import {
    computeSegments,
    gridEmoji,
    handGrid,
    handScores,
    handsPlayed,
    laggingHand,
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
// per-gap timing and speed have something to measure. `staff` tags which hand they're on.
function spaced(count: number, staff = 0): RunNote[] {
    return Array.from({ length: count }, (_, i) => ({
        targetMs: i * 100,
        playedMs: i * 100,
        wrongBefore: 0,
        staves: [staff],
    }));
}

// The same phrase played `factor` times slower than notated (a mouse-plodder at factor 2
// takes twice as long) — steady, but off the piece's tempo.
function slow(count: number, factor: number, staff = 0): RunNote[] {
    return Array.from({ length: count }, (_, i) => ({
        targetMs: i * 100,
        playedMs: i * 100 * factor,
        wrongBefore: 0,
        staves: [staff],
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

describe("toGrid (lifetime fingerprint)", () => {
    it("maps levels in the given dimension order", () => {
        const grid = toGrid(
            [{ accuracy: 1, timing: 0.7, flow: 0.3 }],
            ["accuracy", "timing", "flow"],
        );
        expect(grid[0]?.[0]).toBe("best"); // accuracy 1.0 → green
        expect(grid[1]?.[0]).toBe("good"); // timing 0.7 → yellow
        expect(grid[2]?.[0]).toBe("weak"); // flow 0.3 → red
    });

    it("is generic over the dimension set", () => {
        expect(toGrid([{ a: 1, b: 0 }], ["a", "b"])).toEqual([["best"], ["none"]]);
    });
});

describe("handsPlayed", () => {
    it("is the single top hand for a single-staff run", () => {
        expect(handsPlayed(spaced(6))).toEqual([0]);
    });

    it("is both hands, right (0) before left (1), for a grand-staff run", () => {
        expect(handsPlayed([...spaced(3, 1), ...spaced(3, 0)])).toEqual([0, 1]);
    });

    it("defaults to the top hand when no staff was recorded", () => {
        expect(handsPlayed([{ targetMs: 0, playedMs: 0, wrongBefore: 0 }])).toEqual([0]);
    });
});

describe("handGrid", () => {
    it("is one row of six cells for a single-hand run", () => {
        const grid = handGrid(spaced(6));
        expect(grid).toHaveLength(1);
        expect(grid[0]).toHaveLength(SEGMENTS);
    });

    it("collapses the three dimensions to the weakest, so a slow run reads red", () => {
        // Right notes, steady, but a third of the tempo: Speed 0.33 drags the cell down
        // even though Accuracy and Timing are perfect — averaging would leave it green.
        expect(handGrid(slow(12, 3))[0]?.[0]).toBe("weak");
        expect(handGrid(spaced(12))[0]?.[0]).toBe("best");
    });

    it("splits a two-hand run into a row per hand and exposes the lagging one", () => {
        // Right hand at tempo, left hand crawling — the left row goes red while the right
        // stays green: the whole point of per-hand grading.
        const grid = handGrid([...spaced(6, 0), ...slow(6, 3, 1)]);
        expect(grid).toHaveLength(2);
        expect(grid[0]?.every((cell) => cell === "best")).toBe(true); // right, at tempo
        expect(grid[1]?.every((cell) => cell === "weak")).toBe(true); // left, slow
    });

    it("counts a both-staves moment toward both hands' rows", () => {
        const both = [
            { targetMs: 0, playedMs: 0, wrongBefore: 0, staves: [0, 1] },
            { targetMs: 100, playedMs: 100, wrongBefore: 0, staves: [0, 1] },
        ];
        expect(handGrid(both)).toHaveLength(2);
    });
});

describe("handScores / laggingHand", () => {
    it("scores each hand over all its notes, not per empty segment", () => {
        // A three-note single hand at tempo — no empty-segment zeros dragging it down.
        const scores = handScores(spaced(3));
        expect(scores).toHaveLength(1);
        expect(scores[0]?.overall).toBeCloseTo(1);
    });

    it("has nothing to compare on a single-hand run", () => {
        expect(laggingHand(spaced(8))).toBeNull();
    });

    it("calls the two hands even when they kept pace", () => {
        expect(laggingHand([...spaced(6, 0), ...spaced(6, 1)])).toBe("even");
    });

    it("flags the left hand when it trails the right", () => {
        expect(laggingHand([...spaced(6, 0), ...slow(6, 3, 1)])).toBe("left");
    });

    it("flags the right hand when it trails the left", () => {
        expect(laggingHand([...slow(6, 3, 0), ...spaced(6, 1)])).toBe("right");
    });
});

describe("shareText", () => {
    it("stacks the boast over the grid with no link", () => {
        const text = shareText("My run on Plinky 🎹", handGrid(spaced(6)));
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
    it("paints an at-tempo single-hand run one green row", () => {
        expect(gridEmoji(handGrid(spaced(12)))).toMatchInlineSnapshot(`"🟩🟩🟩🟩🟩🟩"`);
    });

    it("reads a slow-but-accurate run as one red row (the weakest aspect wins)", () => {
        expect(gridEmoji(handGrid(slow(12, 3)))).toMatchInlineSnapshot(`"🟥🟥🟥🟥🟥🟥"`);
    });

    it("shows a lagging left hand as a red second row under a green right", () => {
        expect(gridEmoji(handGrid([...spaced(6, 0), ...slow(6, 3, 1)]))).toMatchInlineSnapshot(`
          "🟩🟩🟩🟩🟩🟩
          🟥🟥🟥🟥🟥🟥"
        `);
    });

    it("reads an abandoned run as one empty row", () => {
        expect(gridEmoji(handGrid([]))).toMatchInlineSnapshot(`"⬜⬜⬜⬜⬜⬜"`);
    });

    it("renders the two-hand blocks as coloured SVG rects — 6 green, 6 red", () => {
        const svg = svgCard(handGrid([...spaced(6, 0), ...slow(6, 3, 1)]), "Test");
        expect((svg.match(/#22c55e/g) ?? []).length).toBe(6); // right row green
        expect((svg.match(/#ef4444/g) ?? []).length).toBe(6); // left row red
    });
});

describe("svgCard", () => {
    it("is well-formed SVG sized for a portrait social card", () => {
        const svg = svgCard(handGrid(spaced(6)), "Für Elise");
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain('width="1080"');
        expect(svg).toContain('height="1350"');
        // One row of six cells for a single hand, plus the background rect.
        expect(svg.match(/<rect/g)).toHaveLength(SEGMENTS + 1);
    });

    it("escapes the heading so a title cannot break the markup", () => {
        const svg = svgCard(handGrid(spaced(1)), 'A & B <"x">');
        expect(svg).toContain("A &amp; B &lt;&quot;x&quot;&gt;");
        expect(svg).not.toContain('<"x">');
    });
});
