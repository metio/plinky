// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectMatchSteps } from "./useScoreMatcher";

// Three bars of one whole note each, the first two inside a repeat, so the performance
// is C D C D E. Only a real OSMD walks the repeat — the fake cursor in the node suite
// pins the arithmetic, and this pins that OSMD really does hand back the rewound onsets
// the arithmetic exists to undo.
const note = (step: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
   <measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>
    ${note("C")}
   </measure>
   <measure number="2">${note("D")}
    <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>
   </measure>
   <measure number="3">${note("E")}</measure>
  </part>
</score-partwise>`;

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score with a repeat", () => {
    it("gives every pass its own place in time", async () => {
        host = document.createElement("div");
        host.style.width = "800px";
        document.body.appendChild(host);
        const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
        await osmd.load(XML);
        osmd.render();

        const steps = collectMatchSteps(osmd, "both");
        expect(steps.map((step) => step.pitches)).toEqual([[60], [62], [60], [62], [64]]);
        // The printed onset rewinds with the repeat — the second C is the same C.
        expect(steps.map((step) => step.whole)).toEqual([0, 1, 0, 1, 2]);
        // The moment each is due does not. The score marks no tempo, so OSMD counts it at
        // its own default of 120 — a whole note is two seconds. The dial is read against
        // that same default, so the run's clock is unchanged by the choice.
        expect(steps.map((step) => step.elapsedMs)).toEqual([0, 2000, 4000, 6000, 8000]);
    });
});
