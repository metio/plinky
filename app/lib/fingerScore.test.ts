// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { domXmlCodec } from "../adapters/domXmlCodec";
import { describe, expect, it } from "vitest";
import { annotateFingerings } from "./fingerScore";

const score = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;
const note = (step: string, octave: number, staff?: number) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration>${
        staff ? `<staff>${staff}</staff>` : ""
    }</note>`;

const noSpan = { left: null, right: null };

function fingerings(xml: string): string[] {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("fingering")].map((node) => node.textContent ?? "");
}

describe("annotateFingerings", () => {
    it("writes a 1–5 fingering onto every pitched note", () => {
        const annotated = annotateFingerings(
            domXmlCodec,
            score(note("C", 4) + note("D", 4) + note("E", 4)),
            noSpan,
        );
        const fingers = fingerings(annotated);
        expect(fingers).toHaveLength(3);
        for (const finger of fingers) {
            expect(Number(finger)).toBeGreaterThanOrEqual(1);
            expect(Number(finger)).toBeLessThanOrEqual(5);
        }
    });

    it("fingers each staff independently", () => {
        const annotated = annotateFingerings(
            domXmlCodec,
            score(note("C", 4, 1) + note("C", 2, 2)),
            noSpan,
        );
        expect(fingerings(annotated)).toHaveLength(2);
    });

    it("skips rests and leaves malformed XML untouched", () => {
        const withRest = score(`${note("C", 4)}<note><rest/><duration>2</duration></note>`);
        expect(fingerings(annotateFingerings(domXmlCodec, withRest, noSpan))).toHaveLength(1);
        expect(annotateFingerings(domXmlCodec, "not xml at all", noSpan)).toBe("not xml at all");
    });

    it("prefers the player's saved fingering where they chose one", () => {
        const xml = score(note("C", 4, 1) + note("D", 4, 1) + note("E", 4, 1));
        // Saved finger 5 on bar 0, position 0, note 0 of the right hand.
        const annotated = annotateFingerings(domXmlCodec, xml, noSpan, { "right:0:0:0": 5 });
        const fingers = fingerings(annotated);
        expect(fingers[0]).toBe("5");
        // The rest fall back to the suggestion (a sensible 1–5).
        expect(Number(fingers[1])).toBeGreaterThanOrEqual(1);
    });
});
