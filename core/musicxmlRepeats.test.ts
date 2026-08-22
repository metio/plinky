// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { type MeasureRepeats, performanceOrder, readMeasureRepeats } from "./musicxmlRepeats";

const plain = (): MeasureRepeats => ({ forward: false, backwardTimes: null, endings: [] });
const bars = (count: number) => Array.from({ length: count }, plain);

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, "application/xml");
const score = (measures: string) =>
    parse(`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1">${measures}</part></score-partwise>`);

describe("reading the repeat barlines", () => {
    it("sees a section between a forward and a backward repeat", () => {
        const read = readMeasureRepeats(
            score(
                `<measure number="1"><barline location="left"><repeat direction="forward"/></barline></measure>` +
                    `<measure number="2"><barline location="right"><repeat direction="backward"/></barline></measure>` +
                    `<measure number="3"/>`,
            ),
        );
        expect(read).toEqual([
            { forward: true, backwardTimes: null, endings: [] },
            { forward: false, backwardTimes: 2, endings: [] },
            plain(),
        ]);
    });

    it("reads how many times a repeat asks to be taken", () => {
        const read = readMeasureRepeats(
            score(
                `<measure number="1"><barline location="right"><repeat direction="backward" times="4"/></barline></measure>`,
            ),
        );
        expect(read[0]?.backwardTimes).toBe(4);
    });

    it("reads an ending bracket, including one covering two passes", () => {
        const read = readMeasureRepeats(
            score(
                `<measure number="1"><barline location="left"><ending number="1" type="start"/></barline></measure>` +
                    `<measure number="2"><barline location="left"><ending number="1, 2" type="start"/></barline></measure>`,
            ),
        );
        expect(read[0]?.endings).toEqual([1]);
        expect(read[1]?.endings).toEqual([1, 2]);
    });

    it("reads a score with no repeats as a score with no repeats", () => {
        expect(readMeasureRepeats(score(`<measure number="1"/>`))).toEqual([plain()]);
        expect(readMeasureRepeats(parse("<nonsense/>"))).toEqual([]);
    });
});

describe("the order the measures are played in", () => {
    it("plays a piece with no repeats straight through", () => {
        expect(performanceOrder(bars(3))).toEqual([0, 1, 2]);
    });

    it("takes a repeated section twice", () => {
        // The case the engraver was walking for us: C D C D E.
        const measures = bars(3);
        measures[0] = { ...plain(), forward: true };
        measures[1] = { ...plain(), backwardTimes: 2 };
        expect(performanceOrder(measures)).toEqual([0, 1, 0, 1, 2]);
    });

    it("goes back to the top when the engraving writes no opening repeat", () => {
        // A backward repeat with nothing to return to means the beginning, which is what
        // a piece with a repeat sign only at the end asks for.
        const measures = bars(3);
        measures[1] = { ...plain(), backwardTimes: 2 };
        expect(performanceOrder(measures)).toEqual([0, 1, 0, 1, 2]);
    });

    it("takes a repeat as many times as it asks", () => {
        const measures = bars(2);
        measures[0] = { ...plain(), forward: true, backwardTimes: 4 };
        expect(performanceOrder(measures)).toEqual([0, 0, 0, 0, 1]);
    });

    it("plays a first-time bar once and a second-time bar once", () => {
        // Bars: [0 forward] [1] [2 first-time, backward] [3 second-time] [4]
        const measures = bars(5);
        measures[0] = { ...plain(), forward: true };
        measures[2] = { ...plain(), backwardTimes: 2, endings: [1] };
        measures[3] = { ...plain(), endings: [2] };
        expect(performanceOrder(measures)).toEqual([0, 1, 2, 0, 1, 3, 4]);
    });

    it("plays a bracket covering both passes on both of them", () => {
        const measures = bars(3);
        measures[0] = { ...plain(), forward: true };
        measures[1] = { ...plain(), backwardTimes: 2, endings: [1, 2] };
        expect(performanceOrder(measures)).toEqual([0, 1, 0, 1, 2]);
    });

    it("handles two repeated sections one after the other", () => {
        // The pass count belongs to the section, so the second section's first-time bar is
        // not skipped because the first section already used up "pass 1".
        const measures = bars(6);
        measures[0] = { ...plain(), forward: true };
        measures[1] = { ...plain(), backwardTimes: 2 };
        measures[2] = { ...plain(), forward: true };
        measures[3] = { ...plain(), backwardTimes: 2 };
        expect(performanceOrder(measures)).toEqual([0, 1, 0, 1, 2, 3, 2, 3, 4, 5]);
    });

    it("stops rather than spinning on a structure that cannot resolve", () => {
        // Not music anybody writes, but a file can hold it, and a reader that hangs takes
        // the whole page with it.
        const measures = bars(2);
        measures[1] = { ...plain(), backwardTimes: 1_000_000 };
        const order = performanceOrder(measures);
        expect(order.length).toBeGreaterThan(0);
        expect(order.length).toBeLessThan(30000);
    });

    it("plays an empty piece as nothing", () => {
        expect(performanceOrder([])).toEqual([]);
    });
});
