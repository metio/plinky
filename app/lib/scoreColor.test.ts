// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { describe, expect, it } from "vitest";
import { paintPlayedNotes, PLAYED_COLOR } from "./scoreColor";

const SVG_NS = "http://www.w3.org/2000/svg";

// A graphical note backed by a real <g><path/></g>, mirroring OSMD's VexFlow
// output: halfTone + 12 is the MIDI pitch, and getSVGGElement yields the group.
function gNote(midi: number, withElement = true) {
    const group = document.createElementNS(SVG_NS, "g");
    group.appendChild(document.createElementNS(SVG_NS, "path"));
    return {
        sourceNote: { halfTone: midi - 12 },
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
