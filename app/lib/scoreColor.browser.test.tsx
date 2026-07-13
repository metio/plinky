// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { ColoringModes, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectSteps } from "../hooks/useScoreMatcher";
import { generatePhrase } from "../../core/generator";
import { BOOMWHACKER_SET } from "../../core/pitchColor";
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

// The class the feedback layer tags its per-note halos with.
const HALO = ".plinky-note-halo";

// Two eighth notes joined by a beam, then a quarter — a note whose beam and stem sit
// outside the notehead group, so the test can confirm the halo never touches them.
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
    it("lights a played note with a halo behind it, leaving the note's own paint alone", async () => {
        const osmd = await renderOsmd(BEAMED);
        // The cursor sits on the first beamed eighth (C4); light the two beamed pitches.
        osmd.cursor.show();
        osmd.cursor.reset();
        paintPlayedNotes(osmd, [60, 62]);
        osmd.cursor.reset();
        osmd.cursor.hide();
        // A halo is placed for each played notehead, in the played colour.
        const halos = [...document.querySelectorAll(HALO)];
        expect(halos.length).toBeGreaterThan(0);
        expect(halos.every((halo) => halo.getAttribute("fill") === PLAYED_COLOR)).toBe(true);
        // The beam and noteheads are never recoloured — the halo rides behind them.
        const beams = [...document.querySelectorAll('[id*="-beam"]')];
        expect(beams.length).toBeGreaterThan(0);
        expect(beams.every((beam) => beam.getAttribute("fill") !== PLAYED_COLOR)).toBe(true);
    });
});

describe("Boomwhacker note colouring (real OSMD)", () => {
    it("colours noteheads by name using the custom set", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        containers.push(container);
        const osmd = new OpenSheetMusicDisplay(container, {
            autoResize: false,
            coloringEnabled: true,
            coloringMode: ColoringModes.CustomColorSet,
            coloringSetCustom: BOOMWHACKER_SET,
        });
        await osmd.load(BEAMED); // holds C, D and E notes
        osmd.render();
        // At least one rendered glyph carries a colour from the Boomwhacker set — OSMD
        // handles the notehead shape itself, so this only confirms the set reaches it.
        const set = new Set(BOOMWHACKER_SET);
        const coloured = [...container.querySelectorAll("[fill]")].some((el) =>
            set.has((el.getAttribute("fill") ?? "").toLowerCase()),
        );
        expect(coloured).toBe(true);
    });
});

describe("hidden-notes hide/reveal (real OSMD)", () => {
    it("blanks every notehead, reveals one step lit, and restores the rest", async () => {
        const { hideNoteElements, revealNoteElements, unhideNoteElements } = await import(
            "./scoreColor"
        );
        const osmd = await renderOsmd(PHRASE);
        const steps = collectNoteElements(osmd, "both");
        expect(steps.length).toBeGreaterThan(1);

        hideNoteElements(steps);
        for (const step of steps) {
            for (const element of step) {
                expect(element.getAttribute("visibility")).toBe("hidden");
            }
        }

        // Revealing a step lifts the blank and lights the verdict as a halo — not by
        // recolouring the notehead.
        revealNoteElements(steps[0]!, PLAYED_COLOR);
        for (const element of steps[0]!) {
            expect(element.getAttribute("visibility")).toBeNull();
        }
        expect(
            [...document.querySelectorAll(HALO)].some(
                (halo) => halo.getAttribute("fill") === PLAYED_COLOR,
            ),
        ).toBe(true);
        // The other steps stay blank until they resolve.
        expect(steps[1]![0]!.getAttribute("visibility")).toBe("hidden");

        // Restoring unhides everything but keeps the earned halo.
        unhideNoteElements(steps);
        expect(steps[1]![0]!.getAttribute("visibility")).toBeNull();
        expect(document.querySelectorAll(HALO).length).toBeGreaterThan(0);
    });
});
