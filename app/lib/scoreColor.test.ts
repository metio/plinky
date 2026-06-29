// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { describe, expect, it } from "vitest";
import {
    highlightCursorNotes,
    NOTE_COLOR,
    paintPlayedNotes,
    PLAYED_COLOR,
    restoreNotes,
    WINDOW_COLOR,
} from "./scoreColor";

const SVG_NS = "http://www.w3.org/2000/svg";

// A graphical note backed by a real <g><path/></g>, mirroring OSMD's VexFlow
// output: halfTone + 12 is the MIDI pitch, and getSVGGElement yields the group.
function gNote(midi: number, withElement = true, rest = false) {
    const group = document.createElementNS(SVG_NS, "g");
    group.appendChild(document.createElementNS(SVG_NS, "path"));
    return {
        sourceNote: { halfTone: midi - 12, isRest: () => rest },
        getSVGGElement: () => (withElement ? group : undefined),
        group,
    };
}

function fakeOsmd(notes: ReturnType<typeof gNote>[]): OpenSheetMusicDisplay {
    return { cursor: { GNotesUnderCursor: () => notes } } as unknown as OpenSheetMusicDisplay;
}

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
});
