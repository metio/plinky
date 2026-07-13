// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { BEAM_AUTO_MAX_HIDDEN_GRADE, beamsVisible, stripBeams } from "./beams";

const eighth = (step: string, beam?: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type>${
        beam === undefined ? "" : `<beam number="1">${beam}</beam>`
    }</note>`;

const score = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;

function beamCount(xml: string): number {
    const doc = domXmlCodec.parse(xml);
    return doc ? doc.querySelectorAll("beam").length : -1;
}

describe("stripBeams", () => {
    it("removes every beam element so short notes render with flags", () => {
        const xml = score(eighth("C", "begin") + eighth("D", "end"));
        expect(beamCount(xml)).toBe(2);
        expect(beamCount(stripBeams(domXmlCodec, xml))).toBe(0);
    });

    it("leaves the notes and their durations untouched", () => {
        const xml = score(eighth("C", "begin") + eighth("D", "end"));
        const stripped = stripBeams(domXmlCodec, xml);
        const doc = domXmlCodec.parse(stripped);
        const steps = [...(doc?.querySelectorAll("note > pitch > step") ?? [])].map(
            (s) => s.textContent,
        );
        expect(steps).toEqual(["C", "D"]);
        expect(doc?.querySelectorAll("note").length).toBe(2);
    });

    it("returns the input unchanged when there are no beams", () => {
        const xml = score(eighth("C") + eighth("D"));
        expect(stripBeams(domXmlCodec, xml)).toBe(xml);
    });

    it("returns malformed input unchanged rather than throwing", () => {
        expect(stripBeams(domXmlCodec, "not xml at <all")).toBe("not xml at <all");
    });
});

describe("beamsVisible", () => {
    it("forces beams on or off regardless of grade", () => {
        expect(beamsVisible("on", 1)).toBe(true);
        expect(beamsVisible("on", 8)).toBe(true);
        expect(beamsVisible("off", 1)).toBe(false);
        expect(beamsVisible("off", 8)).toBe(false);
    });

    it("auto hides beams on the easy grades and shows them above the threshold", () => {
        for (let grade = 1; grade <= BEAM_AUTO_MAX_HIDDEN_GRADE; grade++) {
            expect(beamsVisible("auto", grade)).toBe(false);
        }
        expect(beamsVisible("auto", BEAM_AUTO_MAX_HIDDEN_GRADE + 1)).toBe(true);
        expect(beamsVisible("auto", 8)).toBe(true);
    });

    it("auto keeps standard beams when the grade is unknown", () => {
        expect(beamsVisible("auto", undefined)).toBe(true);
    });
});
