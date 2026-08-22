// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { legatoOverlap } from "../../core/expression";
import { readScoreMarks } from "../../core/musicxmlMarks";
import { slurredOnwardAt } from "../../core/slur";

// Slurs, on a real engraving, read the way playback reads them.
//
// The arches come from the document and the positions from the engraving, which is exactly
// how the app works: the page is drawn by one and described by the other. Keeping both here
// is the point — a slur that the file describes but the engraving never reaches, or a
// position the engraving shows that the file does not place, would pass a test of either
// half on its own.

const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const note = (step: string, slur?: "start" | "stop") =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>${
        slur ? `<notations><slur number="1" type="${slur}"/></notations>` : ""
    }</note>`;

const score = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part></score-partwise>`;

let host: HTMLDivElement | null = null;

// Engrave a score and report, per position, whether its note is joined to the next.
function slurredPerPosition(measures: string): Promise<boolean[]> {
    const xml = score(measures);
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    return osmd.load(xml).then(() => {
        osmd.render();
        const spans = readScoreMarks(new DOMParser().parseFromString(xml, "application/xml")).slurs;
        const cursor = osmd.cursor;
        cursor.reset();
        const found: boolean[] = [];
        while (!cursor.iterator.EndReached) {
            found.push(slurredOnwardAt(spans, cursor.iterator.currentTimeStamp?.RealValue ?? 0));
            cursor.next();
        }
        cursor.reset();
        return found;
    });
}

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score that slurs its notes", () => {
    it("joins every note under the arch onward, except the last", () => {
        // The engraving hangs the arch on its two end notes and nothing between, so the
        // middle notes carry no mark of their own — which is why a slur is read as a span.
        // The last note ends the phrase: it has nothing to join to, and holding it over
        // would smear into whatever follows.
        return slurredPerPosition(
            `<measure number="1">${ATTR}${note("C", "start")}${note("D")}${note("E")}${note("F", "stop")}</measure>`,
        ).then((found) => {
            expect(found).toEqual([true, true, true, false]);
        });
    });

    it("joins nothing in a score that draws no arches", () => {
        return slurredPerPosition(
            `<measure number="1">${ATTR}${note("C")}${note("D")}${note("E")}${note("F")}</measure>`,
        ).then((found) => {
            expect(found).toEqual([false, false, false, false]);
        });
    });

    it("turns what it read into a note that actually rings past its end", () => {
        // The other half of the defect this file was written for: the arches were read
        // correctly and then thrown away, because a slurred note resolved to the same
        // length a plain one already had. Reading a slur is only worth doing if something
        // sounds different.
        return slurredPerPosition(
            `<measure number="1">${ATTR}${note("C", "start")}${note("D", "stop")}</measure>`,
        ).then(([first, last]) => {
            expect(legatoOverlap({ slurred: first === true, quarters: 1 }, 120)).toBeGreaterThan(0);
            expect(legatoOverlap({ slurred: last === true, quarters: 1 }, 120)).toBe(0);
        });
    });
});
