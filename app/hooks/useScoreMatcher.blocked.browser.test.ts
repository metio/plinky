// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { simplify } from "../../core/simplify";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { collectMatchSteps } from "./useScoreMatcher";

// The block-chord reading through the real engraver: what the run asks for is the tune
// as written in the right hand and one block per chord in the left.
const note = (step: string, octave: number, duration: number, staff: 1 | 2) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><type>${duration === 8 ? "half" : "quarter"}</type><staff>${staff}</staff></note>`;
const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
const XML = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1">${ATTR}${note("E", 5, 8, 1)}${note("G", 5, 8, 1)}<backup><duration>16</duration></backup>${note("C", 3, 4, 2)}${note("G", 3, 4, 2)}${note("E", 3, 4, 2)}${note("G", 3, 4, 2)}</measure><measure number="2">${note("F", 5, 8, 1)}${note("D", 5, 8, 1)}<backup><duration>16</duration></backup>${note("G", 2, 4, 2)}${note("B", 2, 4, 2)}${note("F", 3, 4, 2)}${note("B", 2, 4, 2)}</measure></part></score-partwise>`;

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

describe("the block-chord reading on the play page", () => {
    it("asks for the tune over one block per chord", async () => {
        host = document.createElement("div");
        host.style.width = "800px";
        document.body.appendChild(host);
        const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
        await osmd.load(simplify(domXmlCodec, XML, "blocked"));
        osmd.render();
        const steps = collectMatchSteps(osmd, "both").map((step) =>
            [...step.pitches].sort((a, b) => a - b),
        );
        expect(steps).toEqual([[48, 52, 55, 76], [79], [55, 59, 62, 77], [74]]);
    });
});
