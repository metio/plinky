// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { drillToMusicXml } from "./drillStaff";

describe("drillToMusicXml", () => {
    it("voices a chord with stacked <chord/> notes that don't add beats", () => {
        const xml = drillToMusicXml([[60, 64, 67]], "right");
        // Three notes, two of them chord members (the first carries the beat).
        expect(xml.match(/<note>/g)).toHaveLength(3);
        expect(xml.match(/<chord\/>/g)).toHaveLength(2);
        expect(xml).toContain("<step>C</step>");
        expect(xml).toContain("<octave>4</octave>");
    });

    it("uses the treble clef for the right hand and the bass for the left", () => {
        expect(drillToMusicXml([[60]], "right")).toContain("<sign>G</sign>");
        expect(drillToMusicXml([[36]], "left")).toContain("<sign>F</sign>");
    });

    it("packs four quarter positions per bar", () => {
        const xml = drillToMusicXml([[60], [62], [64], [65], [67]], "right");
        expect(xml.match(/<measure /g)).toHaveLength(2);
    });
});
