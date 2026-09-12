// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { LISTENED_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import {
    haloColor,
    highlightCursorNotes,
    redrawKeepingPaint,
    retargetPainted,
    trailNotes,
} from "./scoreColor";

// A four-note bar, optionally carrying fingerings — toggling them is what forces the
// re-render the repaint has to survive.
const note = (step: string, finger: number | null) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type>${
        finger
            ? `<notations><technical><fingering>${finger}</fingering></technical></notations>`
            : ""
    }</note>`;

const score = (fingered: boolean) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    ${note("C", fingered ? 1 : null)}${note("D", fingered ? 2 : null)}${note("E", fingered ? 3 : null)}${note("F", fingered ? 4 : null)}
  </measure></part>
</score-partwise>`;

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

async function fingeredScore(): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(score(true));
    osmd.render();
    return osmd;
}

// The redraw a mid-run fingering toggle triggers, as drawNow does it.
function hideFingerings(osmd: OpenSheetMusicDisplay) {
    return redrawKeepingPaint(osmd, () => {
        (osmd as unknown as { rules: { RenderFingerings: boolean } }).rules.RenderFingerings =
            false;
        osmd.updateGraphic();
        osmd.render();
    });
}

const lit = (color: string) =>
    [...host!.querySelectorAll("rect.plinky-note-halo")].filter(
        (halo) => halo.isConnected && halo.getAttribute("fill") === color,
    ).length;

// Proves the carry against a real OSMD: the walk order it relies on, the actual SVG
// noteheads, and litHalos' real geometry — the fakes in the node suite can't.
describe("note paint across an OSMD re-render", () => {
    it("survives the render a fingering toggle forces, restoring the halo it dropped", async () => {
        const osmd = await fingeredScore();

        // Paint the first position's notes, the run's trail.
        osmd.cursor.show();
        osmd.cursor.reset();
        const painted = highlightCursorNotes(osmd, WINDOW_COLOR);
        expect(painted.length).toBeGreaterThan(0);

        const redrawn = hideFingerings(osmd);
        expect(redrawn.painted).toBe(true);
        // The render discarded the painted noteheads; each fresh one wears the halo back.
        for (const { element } of painted) {
            expect(host!.contains(element)).toBe(false);
            const fresh = redrawn.remap(element);
            expect(fresh && host!.contains(fresh)).toBe(true);
            expect(haloColor(fresh!)).toBe(WINDOW_COLOR);
        }
        expect(lit(WINDOW_COLOR)).toBe(painted.length);
    });

    it("leaves one note 'now sounding' when playback moves on after the redraw", async () => {
        const osmd = await fingeredScore();

        // Listen lights the first position and holds its noteheads, to lift on the next tick.
        osmd.cursor.show();
        osmd.cursor.reset();
        const sounding = highlightCursorNotes(osmd, WINDOW_COLOR);

        // The transport follows its lit notes to the fresh noteheads.
        const { painted, remap } = hideFingerings(osmd);
        expect(painted).toBe(true);
        expect(lit(WINDOW_COLOR)).toBe(1);
        const followed = retargetPainted(sounding, remap);
        expect(followed).toHaveLength(sounding.length);
        expect(followed.every(({ element }) => host!.contains(element))).toBe(true);

        // The next tick: the note just heard joins the blue trail, the next one lights.
        trailNotes(followed, LISTENED_COLOR);
        osmd.cursor.show();
        osmd.cursor.reset();
        osmd.cursor.next();
        highlightCursorNotes(osmd, WINDOW_COLOR);

        expect(lit(WINDOW_COLOR)).toBe(1);
        expect(lit(LISTENED_COLOR)).toBe(1);
    });
});
