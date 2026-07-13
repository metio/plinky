// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { describe, expect, it } from "vitest";
import {
    clearBarSelection,
    haloColor,
    highlightCursorNotes,
    paintBarSelection,
    paintPlayedNotes,
    restoreNotes,
} from "./scoreColor";
import {
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

// Mounts each note's group inside a shared <svg> so the halo layer can find its owner
// SVG and place a halo behind it. jsdom gives zero-size boxes, so the halo's presence and
// colour are what these assert, not its geometry.
function mount(notes: ReturnType<typeof gNote>[]): void {
    const svg = document.createElementNS(SVG_NS, "svg");
    document.body.appendChild(svg);
    for (const note of notes) {
        const group = note.getSVGGElement();
        if (group) {
            svg.appendChild(group);
        }
    }
}

describe("paintPlayedNotes", () => {
    it("lights the played note with a halo, leaving others unlit and the note itself alone", () => {
        const played = gNote(60);
        const other = gNote(64);
        mount([played, other]);
        paintPlayedNotes(fakeOsmd([played, other]), [60]);
        expect(haloColor(played.group)).toBe(PLAYED_COLOR);
        expect(haloColor(other.group)).toBeNull();
        // The notehead's own paint is never touched — the halo rides behind it.
        expect(played.group.getAttribute("fill")).toBeNull();
    });

    it("skips a note with no rendered element without throwing", () => {
        const note = gNote(60, false);
        expect(() => paintPlayedNotes(fakeOsmd([note]), [60])).not.toThrow();
        expect(haloColor(note.group)).toBeNull();
    });
});

describe("highlightCursorNotes / restoreNotes", () => {
    it("lights the cursor's notes with a halo and reports their prior halo for restoring", () => {
        const a = gNote(60);
        const b = gNote(64);
        mount([a, b]);
        const painted = highlightCursorNotes(fakeOsmd([a, b]), WINDOW_COLOR);
        expect(haloColor(a.group)).toBe(WINDOW_COLOR);
        expect(haloColor(b.group)).toBe(WINDOW_COLOR);
        expect(painted).toHaveLength(2);

        restoreNotes(painted);
        // No halo before the highlight, so each note is left unlit again.
        expect(haloColor(a.group)).toBeNull();
        expect(haloColor(b.group)).toBeNull();
    });

    it("restores a note to the mark it already wore, not blank", () => {
        const note = gNote(60);
        mount([note]);
        paintPlayedNotes(fakeOsmd([note]), [60]);
        const painted = highlightCursorNotes(fakeOsmd([note]), WINDOW_COLOR);
        expect(haloColor(note.group)).toBe(WINDOW_COLOR);
        restoreNotes(painted);
        // The note was already played-green, so lifting the highlight returns it there.
        expect(haloColor(note.group)).toBe(PLAYED_COLOR);
    });

    it("ignores rests and notes with no rendered element", () => {
        const rest = gNote(60, true, true);
        const offscreen = gNote(64, false);
        mount([rest, offscreen]);
        const painted = highlightCursorNotes(fakeOsmd([rest, offscreen]), WINDOW_COLOR);
        expect(painted).toHaveLength(0);
        expect(haloColor(rest.group)).toBeNull();
    });
});
