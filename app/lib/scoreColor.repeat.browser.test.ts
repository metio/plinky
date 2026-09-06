// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { PLAYED_COLOR } from "../../core/scoreCanvas";
import { clearHalosWithin, collectNoteElements, haloColor, litHalos } from "./scoreColor";

// A bar before a repeated pair, the pair, and a bar after. Whole notes in four-four, so
// each bar is one whole note and the printed onsets are 0, 1, 2 and 3.
const note = (step: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`;
const ATTR = `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
   <measure number="1">${ATTR}${note("C")}</measure>
   <measure number="2"><barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>${note("D")}</measure>
   <measure number="3">${note("E")}<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline></measure>
   <measure number="4">${note("F")}</measure>
  </part>
</score-partwise>`;

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

describe("uncolouring the bars a repeat plays again", () => {
    it("lifts the halos inside the repeated span and leaves the bars around it coloured", async () => {
        host = document.createElement("div");
        host.style.width = "800px";
        document.body.appendChild(host);
        const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
        await osmd.load(XML);
        osmd.render();

        // Every note played green, as a first pass through to the repeat leaves them —
        // the walk visits the repeated bars twice, so the elements repeat too.
        const steps = collectNoteElements(osmd, "both");
        const elements = [...new Set(steps.flat())];
        expect(elements).toHaveLength(4);
        litHalos(elements.map((element) => ({ element, color: PLAYED_COLOR })));

        clearHalosWithin(osmd, { from: 1, to: 2 });

        expect(elements.map((element) => haloColor(element))).toEqual([
            PLAYED_COLOR,
            null,
            null,
            PLAYED_COLOR,
        ]);
    });
});
