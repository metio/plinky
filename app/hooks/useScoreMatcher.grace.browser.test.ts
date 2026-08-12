// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectStepNotes } from "../lib/scoreColor";
import { collectMatchSteps } from "./useScoreMatcher";

// A grace note and the note it decorates are printed at one cursor position, so only a
// real OSMD shows what a walk over the score is handed — and it hands back both at once.
const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const grace = (step: string) =>
    `<note><grace slash="yes"/><pitch><step>${step}</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type></note>`;

const half = (step: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>half</type></note>`;

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

describe("a note with a grace note before it", () => {
    it("is two steps, the ornament first, not one chord", async () => {
        // B is the ornament, C the note it decorates. Asking for both keys at once is
        // the opposite of what the score says, and unplayable as written.
        const osmd = await load(
            score(`<measure number="1">${ATTR}${grace("B")}${half("C")}${half("D")}</measure>`),
        );

        const steps = collectMatchSteps(osmd, "both");
        expect(steps.map((step) => step.pitches)).toEqual([[71], [60], [62]]);
    });

    it("strikes the ornament before the beat, and the principal on it", async () => {
        const osmd = await load(
            score(`<measure number="1">${ATTR}${half("C")}${grace("B")}${half("D")}</measure>`),
        );

        const [first, ornament, principal] = collectMatchSteps(osmd, "both");
        expect(ornament?.pitches).toEqual([71]);
        expect(principal?.pitches).toEqual([62]);
        // Before its principal…
        expect(ornament?.elapsedMs as number).toBeLessThan(principal?.elapsedMs as number);
        // …and after the note it follows, never reaching back over it.
        expect(ornament?.elapsedMs as number).toBeGreaterThan(first?.elapsedMs as number);
    });

    it("leaves the cursor on the decorated note while the ornament is played", async () => {
        const osmd = await load(
            score(`<measure number="1">${ATTR}${grace("B")}${half("C")}${half("D")}</measure>`),
        );

        const steps = collectMatchSteps(osmd, "both");
        // The ornament and its principal share a printed position, so only the principal
        // moves the cursor along; the last note of the bar moves it as usual.
        expect(steps.map((step) => step.advancesCursor)).toEqual([false, true, true]);
        // …and they are printed in the same place, which is why.
        expect(steps[0]?.whole).toBe(steps[1]?.whole);
    });

    it("is split the same way by the walk that colours the notes", async () => {
        // The ghost's i-th onset is matched to the i-th entry here. Two walkers splitting
        // a position differently would slide every later marker onto the wrong note.
        const osmd = await load(
            score(`<measure number="1">${ATTR}${grace("B")}${half("C")}${half("D")}</measure>`),
        );

        expect(collectStepNotes(osmd, "both")).toHaveLength(collectMatchSteps(osmd, "both").length);
    });

    it("leaves a piece with no ornaments exactly as it was", async () => {
        const osmd = await load(
            score(`<measure number="1">${ATTR}${half("C")}${half("D")}</measure>`),
        );

        const steps = collectMatchSteps(osmd, "both");
        expect(steps.map((step) => step.pitches)).toEqual([[60], [62]]);
        expect(steps.every((step) => step.advancesCursor)).toBe(true);
    });
});
