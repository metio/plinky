// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { readPedalSpans } from "../lib/scoreExpression";
import { collectListenSteps } from "./useListenPlayback";
import { collectMatchSteps } from "./useScoreMatcher";

// OSMD hangs the pedal on the same measure expressions as the dynamics, so only a real
// engraving shows whether the markings survive parsing at all.
const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const half = (step: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>half</type></note>`;

const pedal = (type: string) =>
    `<direction placement="below"><direction-type><pedal type="${type}" line="yes"/></direction-type></direction>`;

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

// The pedal goes down at the top of bar 1 and comes up halfway through bar 2, so the
// first three notes are under it and the fourth is not.
const PEDALLED = score(`
   <measure number="1">${ATTR}${pedal("start")}${half("C")}${half("D")}</measure>
   <measure number="2">${half("E")}${pedal("stop")}${half("F")}</measure>`);

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score that marks the sustain pedal", () => {
    it("reads the span the marking covers", async () => {
        const osmd = await load(PEDALLED);
        expect(readPedalSpans(osmd)).toEqual([{ from: 0, to: 1.5 }]);
    });

    it("marks the notes under it, and only those", async () => {
        const osmd = await load(PEDALLED);
        expect(collectMatchSteps(osmd, "both").map((step) => step.pedalled)).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });

    it("rings a note on until the pedal lifts", async () => {
        const osmd = await load(PEDALLED);
        const steps = collectListenSteps(osmd);
        // The first note is written as a half — two quarters — but the pedal holds it for
        // the bar and a half the marking covers: six quarters.
        expect(steps[0]?.notes[0]?.soundQuarters).toBe(6);
        // The last note is outside the marking and keeps its written length.
        expect(steps[3]?.notes[0]?.soundQuarters).toBe(2);
    });

    it("leaves an unpedalled piece exactly as it was", async () => {
        const osmd = await load(
            score(`<measure number="1">${ATTR}${half("C")}${half("D")}</measure>`),
        );
        expect(readPedalSpans(osmd)).toEqual([]);
        expect(collectMatchSteps(osmd, "both").every((step) => step.pedalled)).toBe(false);
        expect(collectListenSteps(osmd)[0]?.notes[0]?.soundQuarters).toBe(2);
    });

    it("runs a pedal the engraving never lifts to the end of the piece", async () => {
        const osmd = await load(
            score(`
   <measure number="1">${ATTR}${pedal("start")}${half("C")}${half("D")}</measure>
   <measure number="2">${half("E")}${half("F")}</measure>`),
        );
        const [span] = readPedalSpans(osmd);
        expect(span?.from).toBe(0);
        // Past the last note, which is what a reader would do with an unclosed marking.
        expect(span?.to as number).toBeGreaterThanOrEqual(1.5);
    });
});
