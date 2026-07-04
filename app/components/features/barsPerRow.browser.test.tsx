// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";

// Verifies the bars-per-row lever the ScoreViewer uses: forcing fewer bars per row
// (RenderXMeasuresPerLineAkaSystem) wraps an eight-bar piece onto more, taller rows —
// the readability control a phone needs. Tests the same `rules` access path the viewer
// casts to.

const ATTRS =
    "<attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes>";
const bar = (n: number) =>
    `<measure number="${n}">${n === 1 ? ATTRS : ""}` +
    "<note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></measure>";
const PIECE =
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list>' +
    '<score-part id="P1"><part-name>M</part-name></score-part></part-list>' +
    `<part id="P1">${Array.from({ length: 8 }, (_, i) => bar(i + 1)).join("")}</part></score-partwise>`;

const hosts: HTMLDivElement[] = [];
afterEach(() => {
    for (const h of hosts.splice(0)) {
        h.remove();
    }
});

async function renderHeight(barsPerRow: number): Promise<number> {
    const host = document.createElement("div");
    host.style.width = "1600px";
    document.body.appendChild(host);
    hosts.push(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    (
        osmd as unknown as { rules: { RenderXMeasuresPerLineAkaSystem: number } }
    ).rules.RenderXMeasuresPerLineAkaSystem = barsPerRow;
    await osmd.load(PIECE);
    osmd.render();
    return host.querySelector("svg")?.getBoundingClientRect().height ?? 0;
}

describe("bars-per-row", () => {
    it("forcing fewer bars per row makes a taller, more readable layout", async () => {
        const auto = await renderHeight(0);
        const forcedTwo = await renderHeight(2);
        expect(auto).toBeGreaterThan(0);
        // Eight bars at two per row is four rows — taller than fitting them to width.
        expect(forcedTwo).toBeGreaterThan(auto);
    });
});
