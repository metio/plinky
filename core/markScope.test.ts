// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { markScope } from "./markScope";

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, "application/xml");

// A score of parts with the given ids and staff counts, one note each.
const layout = (parts: [id: string, staves: number][]) =>
    parse(
        `<?xml version="1.0"?><score-partwise><part-list>${parts
            .map(([id]) => `<score-part id="${id}"><part-name>${id}</part-name></score-part>`)
            .join("")}</part-list>${parts
            .map(
                ([id, staves]) =>
                    `<part id="${id}"><measure number="1"><attributes><staves>${staves}</staves></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></measure></part>`,
            )
            .join("")}</score-partwise>`,
    );

describe("markScope", () => {
    it("numbers an art song's piano from 0 when the singer is taken off the page", () => {
        const { engraved } = markScope(
            layout([
                ["Voice", 1],
                ["Piano", 2],
            ]),
            false,
        );
        expect(engraved("Voice", 1)).toBeNull();
        expect(engraved("Piano", 1)).toBe(0);
        expect(engraved("Piano", 2)).toBe(1);
    });

    it("numbers every part across the whole score when all of them are drawn", () => {
        const { engraved } = markScope(
            layout([
                ["Voice", 1],
                ["Piano", 2],
            ]),
            true,
        );
        expect(engraved("Voice", 1)).toBe(0);
        expect(engraved("Piano", 1)).toBe(1);
        expect(engraved("Piano", 2)).toBe(2);
    });

    it("keeps both parts of a piano written as two single-staff parts, on staves of their own", () => {
        for (const accompaniment of [false, true]) {
            const { engraved } = markScope(
                layout([
                    ["RH", 1],
                    ["LH", 1],
                ]),
                accompaniment,
            );
            expect([engraved("RH", 1), engraved("LH", 1)]).toEqual([0, 1]);
        }
    });

    it("numbers a piano below two singers from 0 or from 2", () => {
        const parts: [string, number][] = [
            ["S", 1],
            ["A", 1],
            ["P", 2],
        ];
        const hidden = markScope(layout(parts), false);
        expect([hidden.engraved("S", 1), hidden.engraved("A", 1)]).toEqual([null, null]);
        expect([hidden.engraved("P", 1), hidden.engraved("P", 2)]).toEqual([0, 1]);
        const drawn = markScope(layout(parts), true);
        expect(["S", "A"].map((id) => drawn.engraved(id, 1))).toEqual([0, 1]);
        expect([drawn.engraved("P", 1), drawn.engraved("P", 2)]).toEqual([2, 3]);
    });

    it("keeps a piano written before the other instrument at the top of the page", () => {
        const { engraved } = markScope(
            layout([
                ["Piano", 2],
                ["Violin", 1],
            ]),
            false,
        );
        expect([engraved("Piano", 1), engraved("Piano", 2)]).toEqual([0, 1]);
        expect(engraved("Violin", 1)).toBeNull();
    });

    it("draws nothing for a part the score does not have", () => {
        expect(markScope(layout([["P1", 2]]), false).engraved("P9", 1)).toBeNull();
    });
});
