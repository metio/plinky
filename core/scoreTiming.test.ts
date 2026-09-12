// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import {
    beatCursor,
    CURSOR_NODES,
    DEFAULT_TEMPO,
    gapTracker,
    scoreClock,
    TIMED_NODES,
} from "./scoreTiming";

// The beat each note of one part sounds on, in document order.
const beatsOf = (body: string): number[] => {
    const doc = domXmlCodec.parse(
        `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${body}</measure></part></score-partwise>`,
    );
    const cursor = beatCursor();
    return Array.from(doc!.querySelectorAll(CURSOR_NODES))
        .map((node) => cursor.read(node))
        .filter((beat) => !Number.isNaN(beat));
};

describe("beatCursor", () => {
    const n = (ticks: number, extra = "") =>
        `<note>${extra}<pitch><step>C</step><octave>4</octave></pitch><duration>${ticks}</duration></note>`;
    const divisions = (value: number) => `<attributes><divisions>${value}</divisions></attributes>`;

    it("places each note after the ones before it, in beats", () => {
        expect(beatsOf(`${divisions(2)}${n(2)}${n(4)}${n(1)}`)).toEqual([0, 1, 3]);
    });

    it("sounds a chord member with the note it joins", () => {
        expect(beatsOf(`${divisions(2)}${n(2)}${n(2, "<chord/>")}${n(2)}`)).toEqual([0, 0, 1]);
    });

    it("rewinds for a second voice, so both voices start together", () => {
        expect(
            beatsOf(`${divisions(1)}${n(1)}${n(1)}<backup><duration>2</duration></backup>${n(2)}`),
        ).toEqual([0, 1, 0]);
    });

    it("skips ahead over a forward, as over a rest", () => {
        expect(beatsOf(`${divisions(1)}<forward><duration>3</duration></forward>${n(1)}`)).toEqual([
            3,
        ]);
    });

    it("takes no time for a grace note", () => {
        expect(
            beatsOf(
                `${divisions(1)}<note><grace/><pitch><step>D</step><octave>4</octave></pitch></note>${n(1)}`,
            ),
        ).toEqual([0, 0]);
    });

    it("never rewinds before the start of the part", () => {
        expect(beatsOf(`${divisions(1)}<backup><duration>4</duration></backup>${n(1)}`)).toEqual([
            0,
        ]);
    });

    it("follows a divisions change partway through", () => {
        expect(beatsOf(`${divisions(1)}${n(1)}${divisions(4)}${n(4)}${n(4)}`)).toEqual([0, 1, 2]);
    });
});

const walk = (body: string): Element[] => {
    const doc = domXmlCodec.parse(
        `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${body}</measure></part></score-partwise>`,
    );
    return Array.from(doc!.querySelectorAll(TIMED_NODES));
};
const note = (ticks: number, extra = "") =>
    `<note>${extra}<pitch><step>C</step><octave>4</octave></pitch><duration>${ticks}</duration></note>`;

describe("scoreClock", () => {
    it("reads a note's length from the divisions and tempo in force", () => {
        const clock = scoreClock();
        const seconds = walk(
            `<attributes><divisions>4</divisions></attributes><sound tempo="120"/>${note(4)}`,
        ).map((node) => clock.read(node));
        // Four ticks is one beat; at 120bpm a beat is half a second.
        expect(seconds.at(-1)).toBeCloseTo(0.5);
    });

    it("follows a divisions change partway through", () => {
        const clock = scoreClock();
        const nodes = walk(
            `<attributes><divisions>1</divisions></attributes><sound tempo="60"/>${note(1)}` +
                `<attributes><divisions>2</divisions></attributes>${note(1)}`,
        );
        const seconds = nodes.map((node) => clock.read(node));
        expect(seconds.filter((value) => value > 0)).toEqual([1, 0.5]);
    });

    it("follows a tempo change partway through", () => {
        // The notes after a change are read at the tempo in force where they stand; a
        // clock that kept the opening tempo timed a slow coda at the allegro's pace.
        const clock = scoreClock();
        const seconds = walk(
            `<attributes><divisions>4</divisions></attributes><sound tempo="120"/>${note(4)}<sound tempo="60"/>${note(4)}`,
        ).map((node) => clock.read(node));
        expect(seconds.filter((one) => one > 0)).toEqual([0.5, 1]);
    });

    it("reads a score that names no tempo at a moderate one", () => {
        const clock = scoreClock();
        const seconds = walk(`<attributes><divisions>1</divisions></attributes>${note(1)}`).map(
            (node) => clock.read(node),
        );
        expect(seconds.at(-1)).toBeCloseTo(60 / DEFAULT_TEMPO);
    });

    it("gives a chord member and a grace note no length of their own", () => {
        const clock = scoreClock();
        const nodes = walk(
            `<attributes><divisions>1</divisions></attributes><sound tempo="60"/>` +
                note(1) +
                note(1, "<chord/>") +
                note(1, "<grace/>"),
        );
        expect(nodes.map((node) => clock.read(node))).toEqual([0, 0, 1, 0, 0]);
    });

    it("reads an unreadable duration as no time rather than as NaN", () => {
        const clock = scoreClock();
        const nodes = walk(
            `<attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>nope</duration></note>`,
        );
        expect(nodes.map((node) => clock.read(node)).every(Number.isFinite)).toBe(true);
    });
});

describe("gapTracker", () => {
    it("reports the previous position's own length as the gap", () => {
        const gaps = gapTracker();
        expect(gaps.start(2)).toBe(0);
        expect(gaps.start(3)).toBe(2);
        expect(gaps.start(1)).toBe(3);
    });

    it("adds skipped time, so a rest is time the hand can travel in", () => {
        const gaps = gapTracker();
        gaps.start(1);
        gaps.skip(4);
        expect(gaps.start(1)).toBe(5);
    });

    it("counts skipped time before the first position too", () => {
        const gaps = gapTracker();
        gaps.skip(2);
        expect(gaps.start(1)).toBe(2);
    });

    it("clears what it has skipped once a position starts", () => {
        const gaps = gapTracker();
        gaps.skip(4);
        gaps.start(1);
        expect(gaps.start(1)).toBe(1);
    });
});
