// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { stavesPerPart } from "../core/accompaniment.ts";
import { crowdedGrade, layoutOf, probeIndices, staleSong } from "./bakeChecks.mts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";

const tile = (grade: number) => ({ kind: "scale-arpeggio", grade });
const study = (grade: number) => ({ kind: "study", grade });

describe("crowdedGrade", () => {
    it("passes a curriculum spread across the grades", () => {
        expect(crowdedGrade([1, 2, 3, 4, 5, 6, 7, 8].map(tile))).toBeNull();
    });

    it("names the grade a collapsed curriculum piled into", () => {
        const collapsed = [...Array.from({ length: 9 }, () => tile(8)), tile(1)];
        expect(crowdedGrade(collapsed)).toContain("grade 8");
    });

    it("tolerates an uneven curriculum, which is normal", () => {
        // Four of nine in one grade: lopsided, but the boundaries are still separating.
        const uneven = [
            tile(1),
            tile(1),
            tile(1),
            tile(1),
            tile(2),
            tile(3),
            tile(4),
            tile(5),
            tile(6),
        ];
        expect(crowdedGrade(uneven)).toBeNull();
    });

    it("judges the tiles alone, since studies are graded on the piece scale", () => {
        // Every study in one grade is a fact about the studies, not about the boundaries
        // the tiles are cut by.
        const mixed = [...Array.from({ length: 20 }, () => study(1)), tile(1), tile(2)];
        expect(crowdedGrade(mixed)).toBeNull();
    });

    it("says nothing about a manifest with no tiles in it", () => {
        expect(crowdedGrade([study(1)])).toBeNull();
        expect(crowdedGrade([])).toBeNull();
    });
});

// A one-note score in the given part layout, carrying `mark` so a fake measure can tell
// the scores apart.
function scoreIn(layout: readonly number[], mark: string): string {
    const list = layout.map(
        (_, index) => `<score-part id="P${index + 1}"><part-name>${mark}</part-name></score-part>`,
    );
    const parts = layout.map((staves, index) => {
        const stated = staves === 1 && index % 2 === 0 ? "" : `<staves>${staves}</staves>`;
        return `<part id="P${index + 1}"><measure number="1"><attributes><divisions>1</divisions>${stated}</attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part>`;
    });
    return `<?xml version="1.0"?><score-partwise version="4.0"><part-list>${list.join("")}</part-list>${parts.join("")}</score-partwise>`;
}

describe("layoutOf", () => {
    it.each([
        [[2], "2"],
        [[1, 2], "1,2"],
        [[1, 1], "1,1"],
        [[1], "1"],
        [[1, 1, 1, 1, 2], "1,1,1,1,2"],
        [[3, 2], "3,2"],
    ])("reads %j as %s, as the model reads it", (layout, key) => {
        const xml = scoreIn(layout, "x");
        expect(layoutOf(xml)).toBe(key);
        const doc = linkedomXmlCodec.parse(xml);
        expect(doc).not.toBeNull();
        expect(stavesPerPart(doc!).join(",")).toBe(key);
    });

    it("does not take the part list, or a part's name, for a part", () => {
        expect(layoutOf(scoreIn([1, 2], "part"))).toBe("1,2");
    });

    it("reads a score with no parts as no layout", () => {
        expect(layoutOf("<score-partwise/>")).toBe("");
    });
});

describe("probeIndices", () => {
    it("spreads two dozen probes across a catalogue written one way", () => {
        const probes = probeIndices(Array.from({ length: 240 }, () => "2"));
        expect(probes).toHaveLength(24);
        expect(probes[0]).toBe(0);
    });

    it("probes every layout the catalogue holds, however rare", () => {
        const layouts = Array.from({ length: 3145 }, () => "2");
        layouts[1001] = "1,1";
        layouts[2003] = "1,2";
        const probes = probeIndices(layouts);
        expect(probes).toContain(1001);
        expect(probes).toContain(2003);
        expect(probes.length).toBeLessThanOrEqual(24 + 2 + 1);
    });

    it("covers each layout, and stays near two dozen probes plus one per layout", () => {
        fc.assert(
            fc.property(
                fc.array(fc.constantFrom("2", "1,2", "1", "1,1", "1,1,2", "2,2", "3"), {
                    maxLength: 400,
                }),
                (layouts) => {
                    const probes = probeIndices(layouts);
                    const reached = new Set(probes.map((index) => layouts[index]));
                    expect(reached).toEqual(new Set(layouts));
                    expect(new Set(probes).size).toBe(probes.length);
                    expect(probes.length).toBeLessThanOrEqual(25 + new Set(layouts).size);
                    for (const index of probes) {
                        expect(index).toBeGreaterThanOrEqual(0);
                        expect(index).toBeLessThan(layouts.length);
                    }
                },
            ),
        );
    });

    it("probes nothing in an empty catalogue", () => {
        expect(probeIndices([])).toEqual([]);
    });
});

describe("staleSong", () => {
    // Sixty grand-staff songs and one piano written as two parts, at an index the spread
    // steps over. The fake measure reads the cost off the part name, so a row is stale
    // exactly when its stored cost differs from what its score says.
    const catalogue = (twoPartCost: number) => {
        const songs = Array.from({ length: 60 }, (_, index) => ({
            id: `song${index}`,
            cost: 5,
            title: `Song ${index}`,
        }));
        songs.splice(37, 0, { id: "twoParts", cost: twoPartCost, title: "Two parts" });
        const xml = new Map(
            songs.map((song) => [
                song.id,
                song.id === "twoParts" ? scoreIn([1, 1], "9") : scoreIn([2], "5"),
            ]),
        );
        const read = async (song: { id: string }) => ({ xml: xml.get(song.id)! });
        return { songs, read };
    };
    const measure = (xml: string) => ({
        cost: Number(/<part-name>(\d+)<\/part-name>/.exec(xml)![1]),
        incipit: undefined,
    });

    it("catches a change confined to one layout the spread steps over", async () => {
        const { songs, read } = catalogue(5);
        expect(await staleSong(songs, read, measure)).toContain(
            "Two parts is stored at cost 5 but measures 9",
        );
    });

    it("passes a catalogue whose every probe is current", async () => {
        const { songs, read } = catalogue(9);
        expect(await staleSong(songs, read, measure)).toBeNull();
    });

    it("names a score that is not shipped, wherever it stands", async () => {
        const { songs, read } = catalogue(9);
        const missing = async (song: { id: string }) =>
            song.id === "song41" ? ({ problem: "missing" } as const) : read(song);
        expect(await staleSong(songs, missing, measure)).toContain("(song41) has no .mxl");
    });

    it("says nothing about an empty catalogue", async () => {
        expect(await staleSong([], async () => ({ problem: "missing" }), measure)).toBeNull();
    });
});
