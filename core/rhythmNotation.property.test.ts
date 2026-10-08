// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateRhythm, type RhythmPattern, RHYTHM_LEVELS, cellBeats } from "./rhythmPattern";
import { type RhythmMark, rhythmLayout, rhythmSvg, STAFF_HEIGHT } from "./rhythmNotation";

// The rhythm as it is drawn, and the verdicts drawn under it. The pattern, the notation
// and the grading are three readings of one list of cells, and they only agree while the
// drawing puts every cell where the counting says it is: a mark under the wrong note
// tells a player they were late on a beat they played perfectly, and a surface placing
// its cursor from the layout would follow the same error.

const rngOf = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const arbPattern = fc
    .tuple(
        fc.integer({ min: 0, max: RHYTHM_LEVELS.length - 1 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
    )
    .map(([level, seed]) => generateRhythm(level, rngOf(seed)));

const arbMarks = (pattern: RhythmPattern) =>
    fc.array(fc.constantFrom<RhythmMark>("perfect", "good", "off", "missed", null), {
        minLength: pattern.cells.filter((cell) => !cell.rest).length,
        maxLength: pattern.cells.filter((cell) => !cell.rest).length,
    });

const rising = (xs: number[]) => xs.every((x, at) => at === 0 || x > (xs[at - 1] as number));

describe("where the rhythm is drawn", () => {
    it("puts one x on every cell, in the order they are counted", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                const { xs, noteXs, width, height } = rhythmLayout(pattern);

                expect(xs.length).toBe(pattern.cells.length);
                expect(noteXs.length).toBe(pattern.cells.filter((cell) => !cell.rest).length);
                expect(rising(xs)).toBe(true);
                expect(height).toBe(STAFF_HEIGHT);
                for (const x of xs) {
                    // Inside the drawing, or it is clipped off the end of the staff.
                    expect(x).toBeGreaterThan(0);
                    expect(x).toBeLessThan(width);
                }
            }),
        );
    });

    it("spaces the cells the way the counting spaces them", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                const { xs } = rhythmLayout(pattern);
                const beats = cellBeats(pattern);

                // One beat is one width wherever it falls: a cell twice as far into the
                // bar sits twice as far along, which is what lets a surface place its
                // own cursor from the layout rather than re-deriving the spacing.
                const perBeat = xs.map((x, at) => ({ x, beat: beats[at] as number }));
                const scale = (perBeat[1]?.x ?? 0) - (perBeat[0]?.x ?? 0);
                if (perBeat.length < 2 || scale === 0) {
                    return;
                }
                const unit = scale / ((perBeat[1]?.beat as number) - (perBeat[0]?.beat as number));
                for (const { x, beat } of perBeat) {
                    expect(x - (perBeat[0]?.x as number)).toBeCloseTo(
                        (beat - (perBeat[0]?.beat as number)) * unit,
                        6,
                    );
                }
            }),
        );
    });

    it("draws a barline between the bars, never on a note", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                const { barLines, xs, width } = rhythmLayout(pattern);

                expect(rising(barLines)).toBe(true);
                for (const line of barLines) {
                    expect(line).toBeGreaterThan(0);
                    expect(line).toBeLessThan(width);
                    // In the gap before the next bar's first note rather than on top of
                    // it, or the barline strikes through a notehead.
                    for (const x of xs) {
                        expect(Math.abs(line - x)).toBeGreaterThan(1);
                    }
                }
            }),
        );
    });
});

describe("the drawing itself", () => {
    it("renders as a picture a browser can read", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                const svg = rhythmSvg({ pattern });

                const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
                expect(doc.querySelector("parsererror")).toBeNull();
                expect(doc.documentElement.tagName).toBe("svg");
            }),
        );
    });

    it("names the drawing when it is given a label, and hides it when it is not", () => {
        fc.assert(
            fc.property(arbPattern, fc.stringMatching(/^[A-Za-z ]{3,30}$/), (pattern, label) => {
                const named = new DOMParser().parseFromString(
                    rhythmSvg({ pattern, label }),
                    "image/svg+xml",
                ).documentElement;
                const bare = new DOMParser().parseFromString(
                    rhythmSvg({ pattern }),
                    "image/svg+xml",
                ).documentElement;

                // A labelled wrapper around an unlabelled role="img" leaves the inner one
                // nameless, so the label belongs here; without one the drawing is
                // decorative and is hidden instead.
                expect(named.getAttribute("role")).toBe("img");
                expect(named.getAttribute("aria-label")).toBe(label);
                expect(bare.getAttribute("aria-hidden")).toBe("true");
            }),
        );
    });

    it("draws a verdict under the note it belongs to", () => {
        fc.assert(
            fc.property(
                arbPattern.chain((pattern) =>
                    arbMarks(pattern).map((marks) => ({ pattern, marks })),
                ),
                ({ pattern, marks }) => {
                    const svg = rhythmSvg({ pattern, marks });
                    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");

                    expect(doc.querySelector("parsererror")).toBeNull();
                    // One verdict per struck note, never per written cell: a rest asks
                    // for no tap, so a mark against one would shift every verdict after
                    // it onto the wrong note.
                    expect(marks.length).toBe(rhythmLayout(pattern).noteXs.length);
                },
            ),
        );
    });

    it("draws the same picture for the same rhythm", () => {
        fc.assert(
            fc.property(arbPattern, (pattern) => {
                expect(rhythmSvg({ pattern })).toBe(rhythmSvg({ pattern }));
                expect(rhythmLayout(pattern)).toEqual(rhythmLayout(pattern));
            }),
        );
    });

    it("moves the cursor onto a note that exists", () => {
        fc.assert(
            fc.property(arbPattern, fc.integer({ min: -2, max: 40 }), (pattern, active) => {
                // An index past the end is what the clock hands over as a run finishes,
                // so it must draw rather than throw.
                expect(() => rhythmSvg({ pattern, activeNote: active })).not.toThrow();
            }),
        );
    });
});
