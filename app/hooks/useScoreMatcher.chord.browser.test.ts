// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectMatchSteps } from "./useScoreMatcher";

// Two notes struck together but written apart — a held voice under a moving one, which is
// how a chord comes to carry two different instructions at one position. OSMD hangs
// articulations on the voice entry rather than the note, so a single-voice chord shares
// them by construction; it is separate voices (and separate staves) that make a position
// ask for two things at once, and that is what the per-pitch model is for.
const ATTRIBUTES = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const staccato = "<notations><articulations><staccato/></articulations></notations>";

const voiceNote = (step: string, duration: number, type: string, voice: number, marks = "") =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${type}</type>${marks}</note>`;

const backup = (duration: number) => `<backup><duration>${duration}</duration></backup>`;

const rest = (duration: number, type: string, voice: number) =>
    `<note><rest/><duration>${duration}</duration><voice>${voice}</voice><type>${type}</type></note>`;

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

describe("a position whose notes are not all the same", () => {
    it("asks each key for its own length", async () => {
        // Voice 1 holds C for the whole bar; voice 2 plays a staccato G on the first beat
        // and rests out. The two are struck together and asked for very different lengths.
        const osmd = await load(
            score(`<measure number="1">${ATTRIBUTES}
                ${voiceNote("C", 16, "whole", 1)}
                ${backup(16)}
                ${voiceNote("G", 4, "quarter", 2, staccato)}
                ${rest(12, "half", 2)}
            </measure>`),
        );

        const step = collectMatchSteps(osmd, "both")[0];
        expect(step?.pitches).toEqual([60, 67]);
        const [held, clipped] = step?.expected ?? [];
        // The held voice keeps ringing for the bar; the staccato quarter is clipped to a
        // fraction of it, and neither is told to do what the other was told.
        expect(held?.holdMs).toBeGreaterThan(0);
        expect(clipped?.holdMs).toBeLessThan((held?.holdMs ?? 0) / 4);
        // The chord's own ringing length is still its longest note.
        expect(step?.holdMs).toBe(held?.holdMs);
        // The written lengths split the same way, before articulation narrows them: a
        // whole note and a quarter, four to one. This is what each key's own hold
        // indicator drains on.
        expect(clipped?.writtenHoldMs).toBeCloseTo((held?.writtenHoldMs ?? 0) / 4);
        // Staccato shortens the sound, never the written value the indicator draws.
        expect(clipped?.writtenHoldMs).toBeGreaterThan(clipped?.holdMs ?? 0);
    });

    it("gives a slow hand and a fast one their own hold lengths", async () => {
        // The ordinary two-hand case: the left holds a whole note while the right plays
        // a quaver. Drawing both fills at the position's own length leaves the right
        // hand's key draining at the left hand's pace long after that hand moved on.
        const osmd = await load(
            score(`<measure number="1">${ATTRIBUTES}
                ${voiceNote("C", 16, "whole", 1)}
                ${backup(16)}
                ${voiceNote("G", 2, "eighth", 2)}
                ${rest(14, "half", 2)}
            </measure>`),
        );

        const step = collectMatchSteps(osmd, "both")[0];
        const [slow, fast] = step?.expected ?? [];
        expect(slow?.writtenHoldMs).toBeCloseTo((fast?.writtenHoldMs ?? 0) * 8);
        expect(fast?.writtenHoldMs).toBeGreaterThan(0);
    });
});
