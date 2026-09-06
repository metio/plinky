// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { withChordSymbols } from "../../core/chordSymbols";
import { domXmlCodec } from "../adapters/domXmlCodec";

// The symbols this writes are only worth writing if the engraver draws them: a
// `<harmony>` the engraver ignored would be a reading aid nobody could read.
const note = (step: string, octave: number, duration: number, staff: 1 | 2) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;
const XML = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>${note("E", 5, 8, 1)}${note("G", 5, 8, 1)}<backup><duration>16</duration></backup>${note("C", 3, 4, 2)}${note("G", 3, 4, 2)}${note("E", 3, 4, 2)}${note("G", 3, 4, 2)}</measure><measure number="2">${note("F", 5, 8, 1)}${note("D", 5, 8, 1)}<backup><duration>16</duration></backup>${note("G", 2, 4, 2)}${note("B", 2, 4, 2)}${note("F", 3, 4, 2)}${note("B", 2, 4, 2)}</measure></part></score-partwise>`;

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

describe("chord symbols written into a score", () => {
    it("are drawn by the engraver above the staff", async () => {
        host = document.createElement("div");
        host.style.width = "800px";
        document.body.appendChild(host);
        const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
        await osmd.load(withChordSymbols(domXmlCodec, XML));
        osmd.render();
        const drawn = Array.from(host.querySelectorAll("text")).map(
            (text) => text.textContent ?? "",
        );
        expect(drawn.some((text) => text.replace(/\s/g, "") === "C")).toBe(true);
        expect(drawn.some((text) => text.replace(/\s/g, "") === "G7")).toBe(true);
    });
});
