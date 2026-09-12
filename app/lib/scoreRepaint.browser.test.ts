// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { LISTENED_COLOR, WINDOW_COLOR } from "../../core/scoreCanvas";
import {
    highlightCursorNotes,
    redrawKeepingPaint,
    restoreNotePaint,
    retargetPainted,
    snapshotNotePaint,
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

// Proves the fix against a real OSMD: the walk order the snapshot relies on, the actual
// SVG noteheads, and litHalos' real geometry — the fakes in the node suite can't.
describe("note-paint snapshot across an OSMD re-render", () => {
    it("survives the render a fingering toggle forces, restoring the halo it dropped", async () => {
        host = document.createElement("div");
        host.style.width = "800px";
        document.body.appendChild(host);
        const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
        await osmd.load(score(true));
        osmd.render();

        // Paint the first position's notes (the run's trail), then capture it.
        osmd.cursor.show();
        osmd.cursor.reset();
        highlightCursorNotes(osmd, WINDOW_COLOR);
        const before = snapshotNotePaint(osmd);
        expect(before.filter((color) => color === WINDOW_COLOR).length).toBeGreaterThan(0);

        // The redraw a mid-run fingering toggle triggers: a fresh render drops every halo.
        (osmd as unknown as { rules: { RenderFingerings: boolean } }).rules.RenderFingerings =
            false;
        osmd.updateGraphic();
        osmd.render();
        expect(snapshotNotePaint(osmd).every((color) => color === null)).toBe(true);

        // Re-applying the snapshot puts the score back exactly as it was painted.
        expect(restoreNotePaint(osmd, before)).toBe(true);
        expect(snapshotNotePaint(osmd)).toEqual(before);
    });

    it("leaves one note 'now sounding' when playback moves on after the redraw", async () => {
        host = document.createElement("div");
        host.style.width = "800px";
        document.body.appendChild(host);
        const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
        await osmd.load(score(true));
        osmd.render();
        const lit = (color: string) =>
            [...host!.querySelectorAll("rect.plinky-note-halo")].filter(
                (halo) => halo.isConnected && halo.getAttribute("fill") === color,
            ).length;

        // Listen lights the first position and holds its noteheads, to lift on the next tick.
        osmd.cursor.show();
        osmd.cursor.reset();
        const sounding = highlightCursorNotes(osmd, WINDOW_COLOR);

        // The redraw a mid-playback toggle triggers, as drawNow does it, and the transport
        // following its lit notes to the fresh noteheads.
        const { painted, remap } = redrawKeepingPaint(osmd, () => {
            (osmd as unknown as { rules: { RenderFingerings: boolean } }).rules.RenderFingerings =
                false;
            osmd.updateGraphic();
            osmd.render();
        });
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
