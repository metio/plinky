// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { SCORE_PAGE_MARGIN } from "../../../core/scoreCanvas";
import { afterEach, describe, expect, it } from "vitest";

// How much music a phone gets on a row, pinned against the real engraver.
//
// A phone showed roughly one bar per row: of a 393px screen, the page's padding and the
// plate's own left 321px for the stave, and the engraver then took a further margin inside
// that. The fix was not smaller notes — it was giving the width back — and the reason it
// needs a test is the shape of the thing. Bars per row is a STEP, not a slope: nothing
// improves until the usable width crosses the point where another bar fits, and then it
// improves all at once. So the change cannot be verified by looking at it, half of it buys
// exactly nothing, and a later tidy-up of page padding could cross back with no visible
// clue on a desktop screen.

const CLEFS =
    '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>';
const ATTRS =
    "<attributes><divisions>2</divisions><key><fifths>2</fifths></key>" +
    `<time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>${CLEFS}</attributes>`;
const note = (step: string, octave: number, staff: number) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
    `<duration>2</duration><type>quarter</type><staff>${staff}</staff></note>`;
const bar = (n: number) =>
    `<measure number="${n}">${n === 1 ? ATTRS : ""}` +
    ["C", "D", "E", "F"].map((step) => note(step, 5, 1)).join("") +
    "<backup><duration>8</duration></backup>" +
    ["C", "B", "A", "G"].map((step, at) => note(step, at === 0 ? 3 : 2, 2)).join("") +
    "</measure>";

// Two staves, four quarter notes a hand, in D major: the shape a phone actually struggles
// with, rather than the single whole note a synthetic fixture would use.
const PIECE =
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list>' +
    '<score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${Array.from({ length: 24 }, (_, at) => bar(at + 1)).join("")}</part></score-partwise>`;

// What the app ships: the plate spans the screen below sm and keeps its own p-3, and the
// engraver's page margin is a hairline.
const PHONE_WIDTH = 393;
const PLATE_PADDING = 24;
const USABLE = PHONE_WIDTH - PLATE_PADDING;
// The very value the hook hands the engraver, so this measures what ships rather than a
// number re-typed beside it.
const MARGIN = SCORE_PAGE_MARGIN;

const hosts: HTMLDivElement[] = [];
afterEach(() => {
    for (const host of hosts.splice(0)) {
        host.remove();
    }
});

async function heightOf(width: number, margin: number | null): Promise<number> {
    const host = document.createElement("div");
    host.style.width = `${width}px`;
    document.body.appendChild(host);
    hosts.push(host);
    const osmd = new OpenSheetMusicDisplay(host, {
        drawingParameters: "compact",
        autoResize: false,
    });
    if (margin !== null) {
        const rules = (
            osmd as unknown as { rules: { PageLeftMargin: number; PageRightMargin: number } }
        ).rules;
        rules.PageLeftMargin = margin;
        rules.PageRightMargin = margin;
    }
    await osmd.load(PIECE);
    osmd.render();
    return host.querySelector("svg")?.getBoundingClientRect().height ?? 0;
}

// The engraver's own behaviour, which is what makes the two settings worth anything, and
// then the app's real render path, which is what proves it actually applies them.
describe("how much music fits on a phone", () => {
    it("draws the same score in far less scroll than the page used to allow", async () => {
        const before = await heightOf(USABLE - PLATE_PADDING * 2, null);
        const after = await heightOf(USABLE, MARGIN);
        expect(before).toBeGreaterThan(0);
        // Measured at 4665px against 2526px. Asserted as a ratio rather than the pixels,
        // so a change in the engraver's own metrics does not fail a test about layout.
        expect(after).toBeLessThan(before * 0.7);
    });

    it("needs both halves: either alone buys nothing at all", async () => {
        // The trap this guards. Giving the width back while the engraver keeps its default
        // margin, or trimming that margin inside the old narrow column, each leaves the
        // score exactly as tall as it was — the step is never crossed, and somebody
        // measuring one lever at a time would conclude the whole idea was worthless.
        const neither = await heightOf(USABLE - PLATE_PADDING * 2, null);
        const widthOnly = await heightOf(USABLE, null);
        const marginOnly = await heightOf(USABLE - PLATE_PADDING * 2, MARGIN);
        expect(widthOnly).toBe(neither);
        expect(marginOnly).toBe(neither);
    });

    it("keeps the clefs, which is why the row is not trimmed further", async () => {
        // Turning off the staff-start clefs buys another 5% and stops the engraver drawing
        // clefs at all — on a score with no clef change, not even the opening pair. The
        // width is bought back from margins, never from notation.
        const host = document.createElement("div");
        host.style.width = `${USABLE}px`;
        document.body.appendChild(host);
        hosts.push(host);
        const osmd = new OpenSheetMusicDisplay(host, {
            drawingParameters: "compact",
            autoResize: false,
        });
        const rules = (
            osmd as unknown as { rules: { PageLeftMargin: number; PageRightMargin: number } }
        ).rules;
        rules.PageLeftMargin = MARGIN;
        rules.PageRightMargin = MARGIN;
        await osmd.load(PIECE);
        osmd.render();
        expect(host.querySelectorAll(".vf-clef").length).toBeGreaterThan(2);
    });
});
