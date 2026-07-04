// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";

// Spike + contract: confirm OSMD draws <technical><fingering> on the staff under
// the same "compact" config the score viewer uses, so fingering can move off the
// keyboard and into the notes.

const note = (step: string, octave: number, finger: number | null) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration><type>quarter</type>${
        finger
            ? `<notations><technical><fingering>${finger}</fingering></technical></notations>`
            : ""
    }</note>`;

const score = (fingered: boolean) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    ${note("C", 4, fingered ? 1 : null)}${note("D", 4, fingered ? 2 : null)}${note("E", 4, fingered ? 3 : null)}${note("F", 4, fingered ? 4 : null)}
  </measure></part>
</score-partwise>`;

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

async function renderTexts(xml: string, options: object): Promise<string[]> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, options);
    await osmd.load(xml);
    osmd.render();
    return [...host.querySelectorAll("text, tspan")].map((node) => node.textContent?.trim() ?? "");
}

function counts(texts: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of texts) {
        out[t] = (out[t] ?? 0) + 1;
    }
    return out;
}

describe("OSMD fingering rendering", () => {
    it("draws fingering numbers under the compact drawing parameters", async () => {
        const options = { autoResize: true, drawingParameters: "compact" };
        const plain = counts(await renderTexts(score(false), options));
        const fingered = counts(await renderTexts(score(true), options));
        // Each of the four finger digits appears at least once more than it does in
        // the un-fingered score (whose only digits are the time signature etc.).
        for (const digit of ["1", "2", "3", "4"]) {
            expect(fingered[digit] ?? 0).toBeGreaterThan(plain[digit] ?? 0);
        }
    });
});
