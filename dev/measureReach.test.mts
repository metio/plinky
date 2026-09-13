// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { THINNINGS } from "../core/reduction.ts";
import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { reductionCosts } from "./measureReach.mts";

const note = (step: string, octave: number, { chord = false, staff = 1 } = {}) =>
    `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;

const chord = (steps: readonly [string, number][], staff = 1) =>
    steps.map(([step, octave], index) => note(step, octave, { chord: index > 0, staff })).join("");

// Wide right-hand chords leaping between two shapes over a left hand in fifths: a piece
// whose filling, not its tune, is what makes it hard.
const bar = (index: number) =>
    `<measure number="${index + 1}">${index === 0 ? "<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>" : ""}${[
        chord([
            ["C", 4],
            ["E", 4],
            ["G", 4],
            ["C", 5],
        ]),
        chord([
            ["F", 4],
            ["A", 4],
            ["C", 5],
            ["F", 5],
        ]),
        chord([
            ["G", 3],
            ["B", 3],
            ["D", 4],
            ["G", 4],
        ]),
        chord([
            ["C", 5],
            ["E", 5],
            ["G", 5],
            ["C", 6],
        ]),
    ].join("")}<backup><duration>4</duration></backup>${chord(
        [
            ["C", 2],
            ["G", 2],
        ],
        2,
    )}${note("F", 2, { staff: 2 })}${note("G", 2, { staff: 2 })}${note("C", 3, { staff: 2 })}</measure>`;

const chordy = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${Array.from({ length: 8 }, (_, index) => bar(index)).join("")}</part></score-partwise>`;

describe("reductionCosts", () => {
    const written = Number(rawDifficulty(linkedomXmlCodec, chordy).toFixed(3));

    it("stores what each reduction cheaper than the piece costs, mildest first", () => {
        const costs = reductionCosts(linkedomXmlCodec, "chordy", chordy, written);
        const levels = Object.keys(costs);
        expect(levels.length).toBeGreaterThan(0);
        expect(levels).toEqual(THINNINGS.filter((level) => level in costs));
        for (const cost of Object.values(costs)) {
            expect(cost).toBeLessThan(written);
            expect(cost).toBe(Number(cost.toFixed(3)));
        }
    });

    it("stores nothing a piece's own cost already undercuts", () => {
        expect(reductionCosts(linkedomXmlCodec, "chordy-cheap", chordy, 0)).toEqual({});
    });

    it("measures no reduction of a scale or arpeggio, which are single lines", () => {
        expect(reductionCosts(linkedomXmlCodec, "scale-c-major", chordy, written)).toEqual({});
    });
});
