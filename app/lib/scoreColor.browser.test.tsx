// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectSteps } from "../hooks/useScoreMatcher";
import { generatePhrase } from "../../core/generator";
import { PLAYED_COLOR } from "../../core/scoreCanvas";
import { collectNoteElements, paintPlayedNotes } from "./scoreColor";

// OSMD renders only in a real browser, so this runs in the browser project.
const containers: HTMLElement[] = [];
afterEach(() => {
    for (const element of containers) {
        element.remove();
    }
    containers.length = 0;
});

async function renderOsmd(xml: string): Promise<OpenSheetMusicDisplay> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const osmd = new OpenSheetMusicDisplay(container, { autoResize: false });
    await osmd.load(xml);
    osmd.render();
    return osmd;
}

const PHRASE = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);

// Two eighth notes joined by a beam, then a quarter. OSMD draws the beam as its own SVG
// element outside the notehead group, so it exercises the beam-colouring path.
const BEAMED = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>2</divisions><key><fifths>0</fifths></key>
      <time><beats>2</beats><beat-type>4</beat-type></time>
      <clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>
      <type>eighth</type><stem>up</stem><beam number="1">begin</beam></note>
    <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration>
      <type>eighth</type><stem>up</stem><beam number="1">end</beam></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration>
      <type>quarter</type></note>
  </measure></part>
</score-partwise>`;

describe("collectNoteElements", () => {
    it("produces one step per playable position, in step with the matcher", async () => {
        const osmd = await renderOsmd(PHRASE);
        expect(collectNoteElements(osmd, "both").length).toBe(collectSteps(osmd, "both").length);
    });

    it("keeps a step whose note has no rendered glyph so ghost markers stay aligned", async () => {
        const osmd = await renderOsmd(PHRASE);
        const expected = collectSteps(osmd, "both").length;
        expect(expected).toBeGreaterThan(0);
        // Simulate OSMD exposing no SVG group for any note (a glyph it didn't draw).
        // The step count must still match the matcher's, or every later ghost marker
        // lands on the wrong note.
        osmd.cursor.show();
        osmd.cursor.reset();
        while (!osmd.cursor.iterator.EndReached) {
            for (const gNote of osmd.cursor.GNotesUnderCursor()) {
                (gNote as { getSVGGElement?: () => undefined }).getSVGGElement = () => undefined;
            }
            osmd.cursor.next();
        }
        osmd.cursor.reset();
        expect(collectNoteElements(osmd, "both").length).toBe(expected);
    });
});

describe("paintPlayedNotes (real OSMD)", () => {
    it("colours a beamed note's beam, not only its head", async () => {
        const osmd = await renderOsmd(BEAMED);
        // The cursor sits on the first beamed eighth (C4); paint the two beamed pitches.
        osmd.cursor.show();
        osmd.cursor.reset();
        paintPlayedNotes(osmd, [60, 62]);
        osmd.cursor.reset();
        osmd.cursor.hide();
        // OSMD tags each beam element's id with "-beam"; VexFlow fills the beam polygon, so
        // its colour rides on fill (paintElement sets both fill and stroke regardless).
        const beams = [...document.querySelectorAll('[id*="-beam"]')];
        expect(beams.length).toBeGreaterThan(0);
        const coloured = beams.some(
            (beam) =>
                beam.getAttribute("fill") === PLAYED_COLOR ||
                beam.getAttribute("stroke") === PLAYED_COLOR,
        );
        expect(coloured).toBe(true);
    });
});
