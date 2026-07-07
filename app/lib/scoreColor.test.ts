// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { describe, expect, it } from "vitest";
import {
    clearBarSelection,
    highlightCursorNotes,
    paintBarSelection,
    paintPlayedNotes,
    restoreNotes,
} from "./scoreColor";
import {
    NOTE_COLOR,
    PLAYED_COLOR,
    SELECT_COLOR,
    WINDOW_COLOR,
    measureAtPoint,
    type MeasureBox,
} from "../../core/scoreCanvas";

const SVG_NS = "http://www.w3.org/2000/svg";

// A graphical note backed by a real <g><path/></g>, mirroring OSMD's VexFlow
// output: halfTone + 12 is the MIDI pitch, and getSVGGElement yields the group.
// getStemSVG yields a separate stroked <path>, the way OSMD exposes the stem, and
// getBeamSVGs the separate beam paths joining short notes.
function gNote(midi: number, withElement = true, rest = false) {
    const group = document.createElementNS(SVG_NS, "g");
    group.appendChild(document.createElementNS(SVG_NS, "path"));
    const stem = document.createElementNS(SVG_NS, "path");
    const beam = document.createElementNS(SVG_NS, "path");
    return {
        sourceNote: { halfTone: midi - 12, isRest: () => rest },
        getSVGGElement: () => (withElement ? group : undefined),
        getStemSVG: () => stem,
        getBeamSVGs: () => [beam],
        group,
        stem,
        beam,
    };
}

function fakeOsmd(notes: ReturnType<typeof gNote>[]): OpenSheetMusicDisplay {
    return { cursor: { GNotesUnderCursor: () => notes } } as unknown as OpenSheetMusicDisplay;
}

describe("measureAtPoint", () => {
    // Two bars on the top row, two on the row below — a wrapped two-line score.
    const boxes: MeasureBox[] = [
        { measure: 0, x: 0, y: 0, width: 100, height: 40 },
        { measure: 1, x: 100, y: 0, width: 100, height: 40 },
        { measure: 2, x: 0, y: 100, width: 100, height: 40 },
        { measure: 3, x: 100, y: 100, width: 100, height: 40 },
    ];

    it("returns null when nothing has rendered", () => {
        expect(measureAtPoint([], 50, 20)).toBeNull();
    });

    it("returns the bar the point lands inside", () => {
        expect(measureAtPoint(boxes, 50, 20)).toBe(0);
        expect(measureAtPoint(boxes, 150, 20)).toBe(1);
        expect(measureAtPoint(boxes, 150, 120)).toBe(3);
    });

    it("picks the nearest bar when the click lands in a bar's empty space", () => {
        // Between the notes of bar 1 (past its right edge, still on the top row).
        expect(measureAtPoint(boxes, 205, 20)).toBe(1);
    });

    it("keeps the pick on the clicked row, not a nearer bar on the line above", () => {
        // Horizontally nearest to bar 1 (x 100–200) but clearly on the lower row's band.
        expect(measureAtPoint(boxes, 150, 118)).toBe(3);
    });
});

describe("paintBarSelection / clearBarSelection", () => {
    const SVG_NS_URL = "http://www.w3.org/2000/svg";
    const boxes: MeasureBox[] = [
        { measure: 0, x: 0, y: 0, width: 100, height: 40 },
        { measure: 1, x: 100, y: 0, width: 100, height: 40 },
        { measure: 2, x: 200, y: 0, width: 100, height: 40 },
    ];
    const makeSvg = () => {
        const svg = document.createElementNS(SVG_NS_URL, "svg");
        const note = document.createElementNS(SVG_NS_URL, "g");
        svg.appendChild(note); // an existing note group to sit in front of the backdrop
        return { svg, note };
    };

    it("fills one backdrop rect per bar in the inclusive range", () => {
        const { svg } = makeSvg();
        paintBarSelection(svg, boxes, 0, 1);
        const rects = svg.querySelectorAll("rect.plinky-bar-selection");
        expect(rects).toHaveLength(2);
        expect(rects[0]?.getAttribute("fill")).toBe(SELECT_COLOR);
        // Translucent, and never eating the clicks meant for selecting a bar.
        expect(rects[0]?.getAttribute("fill-opacity")).toBe("0.2");
        expect(rects[0]?.getAttribute("pointer-events")).toBe("none");
    });

    it("draws the backdrop behind the notes", () => {
        const { svg, note } = makeSvg();
        paintBarSelection(svg, boxes, 0, 0);
        // The selection rect is inserted before the existing note group.
        expect(svg.firstElementChild?.classList.contains("plinky-bar-selection")).toBe(true);
        expect(svg.lastElementChild).toBe(note);
    });

    it("replaces a prior selection rather than stacking", () => {
        const { svg } = makeSvg();
        paintBarSelection(svg, boxes, 0, 2);
        paintBarSelection(svg, boxes, 1, 1);
        expect(svg.querySelectorAll("rect.plinky-bar-selection")).toHaveLength(1);
    });

    it("clears every backdrop rect", () => {
        const { svg, note } = makeSvg();
        paintBarSelection(svg, boxes, 0, 2);
        clearBarSelection(svg);
        expect(svg.querySelectorAll("rect.plinky-bar-selection")).toHaveLength(0);
        expect(svg.firstElementChild).toBe(note); // the note group is untouched
    });
});

describe("paintPlayedNotes", () => {
    it("colours the played note's group and glyphs, leaving others untouched", () => {
        const played = gNote(60);
        const other = gNote(64);
        paintPlayedNotes(fakeOsmd([played, other]), [60]);
        expect(played.group.getAttribute("fill")).toBe(PLAYED_COLOR);
        expect(played.group.querySelector("path")?.getAttribute("fill")).toBe(PLAYED_COLOR);
        expect(other.group.getAttribute("fill")).toBeNull();
    });

    it("skips a note with no rendered element without throwing", () => {
        const note = gNote(60, false);
        expect(() => paintPlayedNotes(fakeOsmd([note]), [60])).not.toThrow();
        expect(note.group.getAttribute("fill")).toBeNull();
    });

    it("colours the whole note — head, stem and beam", () => {
        const played = gNote(60);
        paintPlayedNotes(fakeOsmd([played]), [60]);
        // The head is filled; the stem and beam are stroked paths, so their colour rides on
        // stroke. A short note left with a black beam would read as a broken colour trail.
        expect(played.group.getAttribute("fill")).toBe(PLAYED_COLOR);
        expect(played.stem.getAttribute("stroke")).toBe(PLAYED_COLOR);
        expect(played.beam.getAttribute("stroke")).toBe(PLAYED_COLOR);
    });
});

describe("highlightCursorNotes / restoreNotes", () => {
    it("lights the cursor's notes and reports their prior fill for restoring", () => {
        const a = gNote(60);
        const b = gNote(64);
        const painted = highlightCursorNotes(fakeOsmd([a, b]), WINDOW_COLOR);
        expect(a.group.getAttribute("fill")).toBe(WINDOW_COLOR);
        expect(b.group.querySelector("path")?.getAttribute("fill")).toBe(WINDOW_COLOR);
        expect(painted).toHaveLength(2);

        restoreNotes(painted);
        // No fill was set before the highlight, so each note falls back to plain black.
        expect(a.group.getAttribute("fill")).toBe(NOTE_COLOR);
        expect(b.group.getAttribute("fill")).toBe(NOTE_COLOR);
    });

    it("restores a note to the colour it already wore, not a blanket black", () => {
        const note = gNote(60);
        paintPlayedNotes(fakeOsmd([note]), [60]);
        const painted = highlightCursorNotes(fakeOsmd([note]), WINDOW_COLOR);
        expect(note.group.getAttribute("fill")).toBe(WINDOW_COLOR);
        restoreNotes(painted);
        // The note was already played-green, so lifting the highlight returns it there.
        expect(note.group.getAttribute("fill")).toBe(PLAYED_COLOR);
    });

    it("ignores rests and notes with no rendered element", () => {
        const rest = gNote(60, true, true);
        const offscreen = gNote(64, false);
        const painted = highlightCursorNotes(fakeOsmd([rest, offscreen]), WINDOW_COLOR);
        expect(painted).toHaveLength(0);
        expect(rest.group.getAttribute("fill")).toBeNull();
    });

    it("highlights and restores the stem and beam along with the head", () => {
        const note = gNote(60);
        const painted = highlightCursorNotes(fakeOsmd([note]), WINDOW_COLOR);
        expect(note.stem.getAttribute("stroke")).toBe(WINDOW_COLOR);
        expect(note.beam.getAttribute("stroke")).toBe(WINDOW_COLOR);
        restoreNotes(painted);
        // Untouched before the highlight, the stem and beam fall back to plain black, not a
        // leftover highlight outline.
        expect(note.stem.getAttribute("stroke")).toBe(NOTE_COLOR);
        expect(note.beam.getAttribute("stroke")).toBe(NOTE_COLOR);
    });

    it("restores a chord's shared stem and beam, not just the last notehead's capture", () => {
        // A chord's noteheads are separate gNotes that hand back the SAME stem and beam.
        // Capturing must happen before any painting, or the second notehead records the
        // already-highlighted shared element as its "prior" and restore leaves it stuck.
        const stem = document.createElementNS(SVG_NS, "path");
        const beam = document.createElementNS(SVG_NS, "path");
        const chordNote = (midi: number) => {
            const group = document.createElementNS(SVG_NS, "g");
            group.appendChild(document.createElementNS(SVG_NS, "path"));
            return {
                sourceNote: { halfTone: midi - 12, isRest: () => false },
                getSVGGElement: () => group,
                getStemSVG: () => stem,
                getBeamSVGs: () => [beam],
                group,
                stem,
                beam,
            };
        };
        const low = chordNote(60);
        const high = chordNote(64);
        const painted = highlightCursorNotes(fakeOsmd([low, high]), WINDOW_COLOR);
        expect(stem.getAttribute("stroke")).toBe(WINDOW_COLOR);
        expect(beam.getAttribute("stroke")).toBe(WINDOW_COLOR);
        restoreNotes(painted);
        expect(stem.getAttribute("stroke")).toBe(NOTE_COLOR);
        expect(beam.getAttribute("stroke")).toBe(NOTE_COLOR);
    });
});
