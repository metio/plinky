// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { pianoPart, stavesPerPart, stripAccompaniment } from "./accompaniment";

const part = (id: string, staves?: number) =>
    `<part id="${id}"><measure number="1"><attributes>${
        staves === undefined ? "" : `<staves>${staves}</staves>`
    }</attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></measure></part>`;

const score = (ids: string[], parts: string) =>
    `<?xml version="1.0"?><score-partwise><part-list>${ids
        .map((id) => `<score-part id="${id}"><part-name>${id}</part-name></score-part>`)
        .join("")}</part-list>${parts}</score-partwise>`;

function ids(xml: string): string[] {
    const doc = domXmlCodec.parse(xml);
    return Array.from(doc?.querySelectorAll("score-partwise > part") ?? []).map(
        (element) => element.getAttribute("id") ?? "",
    );
}

function listed(xml: string): string[] {
    const doc = domXmlCodec.parse(xml);
    return Array.from(doc?.querySelectorAll("part-list > score-part") ?? []).map(
        (element) => element.getAttribute("id") ?? "",
    );
}

describe("stavesPerPart", () => {
    it("reads each part's staff count, defaulting to one", () => {
        const doc = domXmlCodec.parse(score(["P1", "P2"], part("P1") + part("P2", 2)));
        expect(stavesPerPart(doc as Document)).toEqual([1, 2]);
    });

    it("treats an unusable count as a single staff", () => {
        const doc = domXmlCodec.parse(score(["P1"], part("P1", 0)));
        expect(stavesPerPart(doc as Document)).toEqual([1]);
    });
});

describe("stripAccompaniment", () => {
    it("keeps the piano and drops the singer", () => {
        const xml = score(["V", "P"], part("V") + part("P", 2));
        const stripped = stripAccompaniment(domXmlCodec, xml);
        expect(ids(stripped)).toEqual(["P"]);
        // The header no longer names a musician who is not in the score.
        expect(listed(stripped)).toEqual(["P"]);
    });

    it("leaves a solo piano score untouched", () => {
        const xml = score(["P"], part("P", 2));
        expect(stripAccompaniment(domXmlCodec, xml)).toBe(xml);
    });

    it("keeps the last two-staff part when several instruments are written above it", () => {
        const xml = score(["A", "B", "P"], part("A") + part("B") + part("P", 2));
        expect(ids(stripAccompaniment(domXmlCodec, xml))).toEqual(["P"]);
    });

    it("falls back to the last part when nothing is written on two staves", () => {
        const xml = score(["A", "B"], part("A") + part("B"));
        expect(ids(stripAccompaniment(domXmlCodec, xml))).toEqual(["B"]);
    });

    it("returns malformed input unchanged", () => {
        expect(stripAccompaniment(domXmlCodec, "not xml at all <")).toBe("not xml at all <");
    });

    it("drops a bracket that would brace the one remaining system", () => {
        const xml = `<?xml version="1.0"?><score-partwise><part-list><part-group type="start" number="1"/><score-part id="V"/><score-part id="P"/><part-group type="stop" number="1"/></part-list>${part("V")}${part("P", 2)}</score-partwise>`;
        const doc = domXmlCodec.parse(stripAccompaniment(domXmlCodec, xml));
        expect(doc?.querySelectorAll("part-group")).toHaveLength(0);
    });

    it("keeps the played part's own notes", () => {
        const xml = score(["V", "P"], part("V") + part("P", 2));
        const doc = domXmlCodec.parse(stripAccompaniment(domXmlCodec, xml));
        expect(doc?.querySelectorAll("note")).toHaveLength(1);
    });
});

describe("pianoPart", () => {
    it("names the part stripAccompaniment keeps", () => {
        const song = score(["V", "P"], part("V") + part("P", 2));
        expect(pianoPart(domXmlCodec.parse(song)!)?.getAttribute("id")).toBe("P");
        const solo = domXmlCodec.parse(stripAccompaniment(domXmlCodec, song))!;
        expect(pianoPart(solo)?.getAttribute("id")).toBe("P");
    });

    it("is null for a score with no part", () => {
        expect(pianoPart(domXmlCodec.parse("<score-partwise/>")!)).toBeNull();
    });
});
