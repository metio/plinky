// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { isEngravableTuplet, quantiserMarks, tupletRatios } from "./transcriptionQuality";

const tuplet = (actual: number, normal: number) =>
    `<time-modification><actual-notes>${actual}</actual-notes><normal-notes>${normal}</normal-notes></time-modification>`;

describe("isEngravableTuplet", () => {
    it("accepts the ratios engraved music uses", () => {
        // The catalogue's own top ten, in order of how often they appear.
        for (const [a, b] of [
            [3, 2],
            [6, 4],
            [2, 1],
            [5, 4],
            [2, 3],
            [6, 5],
            [7, 4],
            [9, 8],
            [9, 4],
            [7, 6],
        ]) {
            expect(isEngravableTuplet(a as number, b as number)).toBe(true);
        }
    });

    it("rejects a ratio only a quantiser would write", () => {
        // Twelve in the time of seven is what the reported Für Elise carried, on a half rest
        // in a 3/8 bar. Nobody has printed that.
        for (const [a, b] of [
            [12, 7],
            [12, 11],
            [24, 17],
            [24, 23],
            [13, 12],
            [11, 2],
        ]) {
            expect(isEngravableTuplet(a as number, b as number)).toBe(false);
        }
    });

    it("reduces before judging, so an unreduced ordinary tuplet passes", () => {
        // 16:8 is a notation program writing 2:1 in the units of the bar it is in, and 20:16
        // is 5:4 the same way. Judged unreduced they read as impossible, and condemned a
        // third more of the catalogue than deserved it.
        expect(isEngravableTuplet(16, 8)).toBe(true);
        expect(isEngravableTuplet(20, 16)).toBe(true);
        expect(isEngravableTuplet(27, 24)).toBe(true);
        expect(isEngravableTuplet(9, 6)).toBe(true);
    });

    it("refuses a ratio that is not a ratio", () => {
        expect(isEngravableTuplet(0, 2)).toBe(false);
        expect(isEngravableTuplet(3, 0)).toBe(false);
        expect(isEngravableTuplet(1.5, 2)).toBe(false);
        expect(isEngravableTuplet(-3, 2)).toBe(false);
    });
});

describe("tupletRatios", () => {
    it("reads every ratio the document writes, in order", () => {
        expect(tupletRatios(`<note/>${tuplet(3, 2)}<note/>${tuplet(12, 7)}`)).toEqual([
            "3:2",
            "12:7",
        ]);
    });

    it("finds nothing in a document with no tuplets", () => {
        expect(tupletRatios("<score-partwise><note/></score-partwise>")).toEqual([]);
        expect(tupletRatios("")).toEqual([]);
    });

    it("ignores a block missing half of the ratio", () => {
        // A truncated or malformed file says nothing about the transcriber's tools.
        expect(
            tupletRatios("<time-modification><actual-notes>3</actual-notes></time-modification>"),
        ).toEqual([]);
    });

    it("survives whitespace an exporter puts where it likes", () => {
        expect(
            tupletRatios(
                "<time-modification>\n  <actual-notes> 3 </actual-notes>\n  <normal-notes>2</normal-notes>\n</time-modification>",
            ),
        ).toEqual(["3:2"]);
    });
});

describe("quantiserMarks", () => {
    it("counts only the impossible ones", () => {
        expect(quantiserMarks(tuplet(3, 2).repeat(5))).toBe(0);
        expect(quantiserMarks(tuplet(3, 2) + tuplet(12, 7) + tuplet(24, 17))).toBe(2);
    });

    it("clears a score with no tuplets at all", () => {
        // Most of the catalogue. Absence of tuplets is not evidence of anything.
        expect(quantiserMarks("<score-partwise/>")).toBe(0);
    });
});
