// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { blockChords } from "./blockChords";

const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;

const pitch = fc.record({
    step: fc.constantFrom(...STEPS),
    octave: fc.integer({ min: 2, max: 3 }),
});

// One bar of a grand staff: a held tune over four crotchets in the left hand.
const bars = fc.array(fc.array(pitch, { minLength: 4, maxLength: 4 }), {
    minLength: 1,
    maxLength: 3,
});

const note = (step: string, octave: number, staff: number) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;

const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>`;

function pianoPart(left: { step: string; octave: number }[][]): string {
    return `<part id="P1">${left
        .map(
            (notes, index) =>
                `<measure number="${index + 1}">${index === 0 ? ATTR : ""}<note><pitch><step>E</step><octave>5</octave></pitch><duration>16</duration><voice>1</voice><type>whole</type><staff>1</staff></note><backup><duration>16</duration></backup>${notes
                    .map((one) => note(one.step, one.octave, 2))
                    .join("")}</measure>`,
        )
        .join("")}</part>`;
}

function singerPart(id: string, measures: number): string {
    return `<part id="${id}">${Array.from(
        { length: measures },
        (_, index) =>
            `<measure number="${index + 1}">${index === 0 ? "<attributes><divisions>4</divisions></attributes>" : ""}<note><pitch><step>G</step><octave>4</octave></pitch><duration>16</duration><voice>1</voice><type>whole</type></note></measure>`,
    ).join("")}</part>`;
}

function scoreOf(singers: number, left: { step: string; octave: number }[][]): string {
    const ids = Array.from({ length: singers }, (_, index) => `V${index + 1}`);
    const list = [...ids, "P1"].map((id) => `<score-part id="${id}"/>`).join("");
    return `<?xml version="1.0"?><score-partwise><part-list>${list}</part-list>${ids
        .map((id) => singerPart(id, left.length))
        .join("")}${pianoPart(left)}</score-partwise>`;
}

// The notes of the piano's staff, as their voice numbers, and everything else as written.
function readBack(xml: string) {
    const doc = domXmlCodec.parse(xml);
    const piano = Array.from(doc?.querySelectorAll('part[id="P1"] note') ?? []);
    const onStaff = (staff: string) =>
        piano.filter((one) => one.querySelector("staff")?.textContent === staff);
    return {
        leftVoices: onStaff("2").map((one) => one.querySelector("voice")?.textContent),
        right: onStaff("1").map((one) => one.outerHTML),
        singers: Array.from(doc?.querySelectorAll('part[id^="V"]') ?? []).map(
            (part) => part.innerHTML,
        ),
    };
}

describe("blockChords properties", () => {
    it("rewrites the piano's left hand however many one-staff parts are written above it", () => {
        fc.assert(
            fc.property(bars, fc.integer({ min: 0, max: 3 }), (left, singers) => {
                const before = readBack(scoreOf(singers, left));
                const after = readBack(blockChords(domXmlCodec, scoreOf(singers, left)));
                // Every left-hand note is the reduction's own voice: none of the
                // composer's are left behind.
                expect(after.leftVoices.length).toBeGreaterThan(0);
                expect(after.leftVoices.every((voice) => voice === "5")).toBe(true);
                // The right hand and every singer are exactly as written.
                expect(after.right).toEqual(before.right);
                expect(after.singers).toEqual(before.singers);
            }),
            { numRuns: 60 },
        );
    });
});
