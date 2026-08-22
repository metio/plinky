// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { NO_SCORE_MARKS, readScoreMarks, type ScoreMarks } from "../../core/musicxmlMarks";
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

// The markings of whatever was last engraved, read from the very document the engraver was
// given — which is the path the app takes. The engraver draws the page; the file says what
// is written on it, and the two are exercised together here on purpose.
let marks: ScoreMarks = NO_SCORE_MARKS;

// The markings of a score, without engraving it — for the cases that only ask what the file
// says.
const marksOf = (xml: string) =>
    readScoreMarks(new DOMParser().parseFromString(xml, "application/xml"));

let host: HTMLDivElement | null = null;

function load(xml: string): Promise<OpenSheetMusicDisplay> {
    marks = readScoreMarks(new DOMParser().parseFromString(xml, "application/xml"));
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
    it("reads the span the marking covers", () => {
        // No engraving needed: the pedal is read from the file. What the engraving is for
        // is the tests below, where the span has to meet the positions it covers.
        expect(marksOf(PEDALLED).pedals).toEqual([{ from: 0, to: 1.5, kind: "sustain" }]);
    });

    it("marks the notes under it, and only those", async () => {
        const osmd = await load(PEDALLED);
        expect(collectMatchSteps(osmd, "both", marks).map((step) => step.pedalled)).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });

    it("rings a note on until the pedal lifts", async () => {
        const osmd = await load(PEDALLED);
        const steps = collectListenSteps(osmd, marks);
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
        expect(marks.pedals).toEqual([]);
        expect(collectMatchSteps(osmd, "both", marks).every((step) => step.pedalled)).toBe(false);
        expect(collectListenSteps(osmd, marks)[0]?.notes[0]?.soundQuarters).toBe(2);
    });

    it("runs a pedal the engraving never lifts to the end of the piece", () => {
        const [span] = marksOf(
            score(`
   <measure number="1">${ATTR}${pedal("start")}${half("C")}${half("D")}</measure>
   <measure number="2">${half("E")}${half("F")}</measure>`),
        ).pedals;
        expect(span?.from).toBe(0);
        // Past the last note, which is what a reader would do with an unclosed marking.
        expect(span?.to as number).toBeGreaterThanOrEqual(1.5);
    });
});
