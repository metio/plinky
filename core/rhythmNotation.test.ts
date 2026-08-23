// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { rhythmLayout, rhythmSvg } from "./rhythmNotation";
import { expectedOnsets, generateRhythm, RHYTHM_LEVELS, type RhythmPattern } from "./rhythmPattern";

const seeded = (start: number) => {
    let state = start;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
};

describe("drawing a rhythm", () => {
    it("puts one mark position on the line per note the grader counts", () => {
        // The marks are drawn under the notes by index, so a layout that counted notes
        // differently from the grader would colour the wrong ones.
        for (let level = 0; level < RHYTHM_LEVELS.length; level++) {
            const pattern = generateRhythm(level, seeded(level + 7));
            expect(rhythmLayout(pattern).noteXs).toHaveLength(expectedOnsets(pattern, 90).length);
        }
    });

    it("spaces notes in the order they are read, never backwards", () => {
        for (let level = 0; level < RHYTHM_LEVELS.length; level++) {
            const layout = rhythmLayout(generateRhythm(level, seeded(level + 21)));
            expect(layout.xs).toEqual([...layout.xs].sort((a, b) => a - b));
            expect(layout.noteXs.at(-1)).toBeLessThan(layout.width);
        }
    });

    it("draws a bar line per bar", () => {
        const pattern = generateRhythm(0, seeded(3));
        expect(rhythmLayout(pattern).barLines).toHaveLength(pattern.bars);
    });

    it("renders every level to markup with no unresolved values in it", () => {
        // A missing lookup would print "undefined" into an attribute, which draws nothing
        // and throws nothing — the failure mode a picture cannot report on its own.
        for (let level = 0; level < RHYTHM_LEVELS.length; level++) {
            const svg = rhythmSvg({ pattern: generateRhythm(level, seeded(level + 42)) });
            expect(svg.startsWith("<svg")).toBe(true);
            expect(svg).not.toContain("undefined");
            expect(svg).not.toContain("NaN");
        }
    });

    it("takes its colours from the theme rather than baking them", () => {
        // This one stays on a page that has a stylesheet, unlike the keyboard diagram that
        // leaves as a file — a rhythm drawn in fixed ink would glow white in a dark room.
        const svg = rhythmSvg({ pattern: generateRhythm(0, seeded(5)) });
        expect(svg).toContain("currentColor");
        expect(svg).not.toMatch(/#[0-9a-f]{6}/i);
    });

    it("marks the triplet as a triplet", () => {
        // Three eighths in the time of two look exactly like three eighths without it.
        const triplets = RHYTHM_LEVELS.findIndex((level) =>
            level.figures.some((figure) =>
                figure.cells.some((cell) => cell.value === "triplet-eighth"),
            ),
        );
        expect(triplets).toBeGreaterThan(-1);
        let found = false;
        for (let seed = 1; seed < 40 && !found; seed++) {
            const pattern = generateRhythm(triplets, seeded(seed));
            if (pattern.cells.some((cell) => cell.value === "triplet-eighth")) {
                found = true;
                expect(rhythmSvg({ pattern })).toContain(">3</text>");
            }
        }
        expect(found).toBe(true);
    });

    it("draws a result mark per note, and the cursor on the note that is sounding", () => {
        const pattern = generateRhythm(0, seeded(9));
        const notes = rhythmLayout(pattern).noteXs.length;
        const svg = rhythmSvg({
            pattern,
            marks: Array.from({ length: notes }, () => "perfect" as const),
            activeNote: 1,
        });
        expect([...svg.matchAll(/var\(--color-success\)/g)]).toHaveLength(notes);
        expect(svg).toContain("var(--color-accent-solid)");
    });

    it("draws no cursor for a note index that does not exist", () => {
        const svg = rhythmSvg({ pattern: generateRhythm(0, seeded(9)), activeNote: 999 });
        expect(svg).not.toContain("var(--color-accent-solid)");
    });

    it("joins two neighbouring sixteenths under one beam rather than giving each a stub", () => {
        // The shared segment is what tells a reader the pair belongs together; two stubs
        // pointing away from each other say the opposite of what the figure means.
        const pattern: RhythmPattern = {
            level: 0,
            beatsPerBar: 4,
            beatUnit: 4,
            bars: 1,
            cells: [
                { value: "eighth", beats: 0.5, rest: false, group: 0 },
                { value: "sixteenth", beats: 0.25, rest: false, group: 0 },
                { value: "sixteenth", beats: 0.25, rest: false, group: 0 },
                { value: "quarter", beats: 3, rest: true },
            ],
        };
        const layout = rhythmLayout(pattern);
        const svg = rhythmSvg({ pattern });
        // Beams are the rects of beam thickness; a rest is a rect too, and taller.
        const beams = [
            ...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="(\d+)"/g),
        ]
            .map((hit) => ({
                x: Number(hit[1]),
                y: Number(hit[2]),
                width: Number(hit[3]),
                height: Number(hit[4]),
            }))
            .filter((one) => one.height === 5);
        // Two levels of beam: one spanning the whole group, one over the two sixteenths.
        const levels = [...new Set(beams.map((beam) => beam.y))].sort((a, b) => a - b);
        expect(levels).toHaveLength(2);
        const upper = beams.filter((beam) => beam.y === levels[1]);
        expect(upper).toHaveLength(1);
        // It reaches from the first sixteenth to the second, not half-way to a neighbour.
        const gap = (layout.xs[2] as number) - (layout.xs[1] as number);
        expect(upper[0]?.width).toBeGreaterThan(gap * 0.9);
    });

    it("names the drawing for a screen reader, or hides it when it is decoration", () => {
        // A labelled wrapper around an unlabelled role="img" leaves the inner one
        // nameless, which is why the label belongs on the drawing itself.
        const pattern = generateRhythm(0, seeded(2));
        const named = rhythmSvg({ pattern, label: 'A rhythm & "more"' });
        expect(named).toContain('role="img"');
        expect(named).toContain('aria-label="A rhythm &amp; &quot;more&quot;"');
        expect(named).not.toContain("aria-hidden");

        const bare = rhythmSvg({ pattern });
        expect(bare).toContain('aria-hidden="true"');
        expect(bare).not.toContain('role="img"');
    });

    it("scales to the box it is given rather than fixing its own width", () => {
        // A staff wider than the column it sits in grows a sideways scrollbar, and a
        // reader dragging the bar they are about to tap into view is reading the page
        // instead of the rhythm.
        const svg = rhythmSvg({ pattern: generateRhythm(9, seeded(6)) });
        expect(svg).toContain('width="100%"');
        expect(svg).toMatch(/viewBox="0 0 [\d.]+ \d+"/);
        expect(svg).toContain("height:auto");
        // A fixed width on the root element would override the percentage; the shapes
        // inside are measured in the viewBox's own units and keep theirs.
        const root = svg.slice(0, svg.indexOf(">"));
        expect(root).not.toMatch(/\swidth="\d+"/);
        expect(root).not.toMatch(/\sheight="\d+"/);
    });
});
