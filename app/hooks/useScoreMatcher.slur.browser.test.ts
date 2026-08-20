// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { legatoOverlap } from "../../core/expression";
import { slurredOnwardAt } from "../../core/slur";
import { readSlurSpans } from "../lib/scoreExpression";

// Slurs, read off a live engraving.
//
// The reader asks OSMD for a note's `NoteSlurs` and compares each slur's end note by
// identity. Nothing in a hand-built fixture can tell us OSMD populates that at all, or
// that the object it hands back for the slur's last note is the very one being examined —
// and if either is wrong the reader reports every note unslurred, which is silent: the
// score still plays, just without the joins. That is exactly how the dynamics reader
// stayed dead for years, so slurs get the same treatment.

const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const note = (step: string, slur?: "start" | "stop") =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>${
        slur ? `<notations><slur number="1" type="${slur}"/></notations>` : ""
    }</note>`;

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

// Per position, whether its note is joined to the next — read the way playback reads it:
// the arches lifted into spans first, then each position asked about the spans.
function slurredPerPosition(osmd: OpenSheetMusicDisplay): boolean[] {
    const spans = readSlurSpans(osmd);
    const cursor = osmd.cursor;
    cursor.reset();
    const found: boolean[] = [];
    while (!cursor.iterator.EndReached) {
        found.push(slurredOnwardAt(spans, cursor.iterator.currentTimeStamp?.RealValue ?? 0));
        cursor.next();
    }
    cursor.reset();
    return found;
}

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score that slurs its notes", () => {
    it("reads every note under the slur as joined onward, except the last", () => {
        return load(
            score(`
   <measure number="1">${ATTR}${note("C", "start")}${note("D")}${note("E")}${note("F", "stop")}</measure>`),
        ).then((osmd) => {
            // The last note of the slur ends the phrase: it has nothing to join to, and
            // holding it over would smear into whatever follows.
            expect(slurredPerPosition(osmd)).toEqual([true, true, true, false]);
        });
    });

    it("reads a score with no slurs as joining nothing", () => {
        return load(
            score(`
   <measure number="1">${ATTR}${note("C")}${note("D")}${note("E")}${note("F")}</measure>`),
        ).then((osmd) => {
            expect(slurredPerPosition(osmd)).toEqual([false, false, false, false]);
        });
    });

    it("turns what it read into a note that actually rings past its end", () => {
        // The other half of the defect: the marks were read correctly and then thrown
        // away, because a slurred note resolved to the same length a plain one already
        // had. Reading a slur is only worth doing if something sounds different.
        return load(
            score(`
   <measure number="1">${ATTR}${note("C", "start")}${note("D", "stop")}</measure>`),
        ).then((osmd) => {
            const [first, last] = slurredPerPosition(osmd);
            expect(legatoOverlap({ slurred: first === true, quarters: 1 }, 120)).toBeGreaterThan(0);
            expect(legatoOverlap({ slurred: last === true, quarters: 1 }, 120)).toBe(0);
        });
    });
});
