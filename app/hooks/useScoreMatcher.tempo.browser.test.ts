// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { FERMATA_STRETCH } from "../../core/elapsed";
import { collectMatchSteps } from "./useScoreMatcher";

// Only a real OSMD resolves a metronome mark or a fermata out of the MusicXML: the fake
// cursor in the node suite is handed its tempo, so it can pin the arithmetic but never
// that the marks are being read at all.
const note = (step: string, marks = "") =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type>${marks}</note>`;

const mark = (bpm: number) =>
    `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`;

const ATTRIBUTES = `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const score = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;

let host: HTMLDivElement | null = null;

function load(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    return osmd.load(xml).then(() => {
        osmd.render();
        return osmd;
    });
}

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score that changes tempo", () => {
    it("gives each bar the time its own mark asks for", async () => {
        // Two bars at 120, then two at 60. A whole note is four quarters: two seconds at
        // 120, four at 60 — so the slow bars are worth twice the fast ones.
        const osmd = await load(
            score(`
   <measure number="1">${ATTRIBUTES}${mark(120)}${note("C")}</measure>
   <measure number="2">${note("D")}</measure>
   <measure number="3">${mark(60)}${note("E")}</measure>
   <measure number="4">${note("F")}</measure>`),
        );

        const steps = collectMatchSteps(osmd, "both");
        expect(steps.map((step) => step.elapsedMs)).toEqual([0, 2000, 4000, 8000]);
    });
});

describe("a score with a fermata", () => {
    it("waits at the held note, and only after it", async () => {
        const osmd = await load(
            score(`
   <measure number="1">${ATTRIBUTES}${mark(60)}${note("C")}</measure>
   <measure number="2">${note("D", '<notations><fermata type="upright"/></notations>')}</measure>
   <measure number="3">${note("E")}</measure>`),
        );

        const steps = collectMatchSteps(osmd, "both");
        // Bar 2 is a whole note at 60 — four seconds — held for the fermata's stretch, so
        // bar 3 arrives that much later. The fermata does not move the note it sits on.
        expect(steps.map((step) => step.elapsedMs)).toEqual([
            0,
            4000,
            4000 + 4000 * FERMATA_STRETCH,
        ]);
        // …and the note itself is meant to keep ringing for the whole of that wait.
        expect(steps[1]?.holdMs).toBe(4000 * FERMATA_STRETCH);
    });
});
