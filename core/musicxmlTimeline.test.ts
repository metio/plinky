// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { readTimeline } from "./musicxmlTimeline";

const parse = (xml: string): Document =>
    new DOMParser().parseFromString(xml, "application/xml");

const score = (measures: string, parts = `<score-part id="P1"><part-name>P</part-name></score-part>`) =>
    parse(`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list>${parts}</part-list><part id="P1">${measures}</part></score-partwise>`);

const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>`;

const note = (step: string, octave: number, ticks: number, extra = "") =>
    `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${ticks}</duration><voice>1</voice></note>`;

const rest = (ticks: number) => `<note><rest/><duration>${ticks}</duration><voice>1</voice></note>`;

describe("reading the timeline out of the file", () => {
    it("places notes one after another, in whole notes", () => {
        // Four crotchets at four divisions each: onsets a quarter of a whole apart.
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 4, 4)}${note("D", 4, 4)}${note("E", 4, 4)}${note("F", 4, 4)}</measure>`,
            ),
        );
        expect(notes.map((one) => one.whole)).toEqual([0, 0.25, 0.5, 0.75]);
        expect(notes.map((one) => one.wholes)).toEqual([0.25, 0.25, 0.25, 0.25]);
    });

    it("turns letters, octaves and accidentals into sounding pitch", () => {
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 4, 4)}${note("A", 4, 4)}<note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>4</duration></note></measure>`,
            ),
        );
        expect(notes.map((one) => one.midi)).toEqual([60, 69, 70]);
    });

    it("reports a rest as a rest that still takes its time", () => {
        const { notes } = readTimeline(
            score(`<measure number="1">${ATTR}${rest(4)}${note("C", 4, 4)}</measure>`),
        );
        expect(notes[0]?.midi).toBeNull();
        expect(notes[1]?.whole).toBe(0.25);
    });

    it("sounds a chord's notes together rather than one after another", () => {
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 4, 4)}${note("E", 4, 4, "<chord/>")}${note("G", 4, 4, "<chord/>")}${note("D", 4, 4)}</measure>`,
            ),
        );
        expect(notes.map((one) => one.whole)).toEqual([0, 0, 0, 0.25]);
        // …and the chord takes one note's worth of time, not three.
        expect(notes.at(-1)?.whole).toBe(0.25);
    });

    it("winds back for a second voice instead of stacking it after the first", () => {
        // The left hand is written after the right and a `<backup>` returns to the barline.
        // Read literally it would begin where the right hand ended, an entire bar late.
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 5, 8)}${note("D", 5, 8)}<backup><duration>16</duration></backup><note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><voice>2</voice><staff>2</staff></note></measure>`,
            ),
        );
        expect(notes.map((one) => [one.midi, one.whole])).toEqual([
            [72, 0],
            [48, 0],
            [74, 0.5],
        ]);
    });

    it("skips forward over a written gap", () => {
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 4, 4)}<forward><duration>4</duration></forward>${note("D", 4, 4)}</measure>`,
            ),
        );
        expect(notes.map((one) => one.whole)).toEqual([0, 0.5]);
    });

    it("carries each measure on from the last", () => {
        const { notes, measureStarts } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 4, 16)}</measure><measure number="2">${note("D", 4, 16)}</measure>`,
            ),
        );
        expect(measureStarts).toEqual([0, 1]);
        expect(notes.map((one) => one.whole)).toEqual([0, 1]);
    });

    it("follows a change of divisions mid-piece", () => {
        // Divisions are a per-file encoding detail, and a file may restate them. Reading
        // the first declaration and keeping it would misplace every later note.
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}${note("C", 4, 16)}</measure><measure number="2"><attributes><divisions>8</divisions></attributes>${note("D", 4, 8)}${note("E", 4, 8)}</measure>`,
            ),
        );
        expect(notes.map((one) => one.whole)).toEqual([0, 1, 1.25]);
    });

    it("gives a grace note no time of its own", () => {
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}<note><grace/><pitch><step>B</step><octave>4</octave></pitch></note>${note("C", 5, 16)}</measure>`,
            ),
        );
        expect(notes[0]).toMatchObject({ grace: true, wholes: 0, whole: 0 });
        // The note it decorates still begins on the beat.
        expect(notes[1]?.whole).toBe(0);
    });

    it("reads a tie from either spelling the file uses", () => {
        const tied = (extra: string) =>
            readTimeline(
                score(
                    `<measure number="1">${ATTR}<note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration>${extra}</note></measure>`,
                ),
            ).notes[0]?.tie;
        expect(tied('<tie type="start"/>')).toBe("start");
        expect(tied('<notations><tied type="stop"/></notations>')).toBe("stop");
        expect(tied('<tie type="stop"/><tie type="start"/>')).toBe("both");
        expect(tied("")).toBeNull();
    });

    it("keeps the staff a note is written on", () => {
        const { notes } = readTimeline(
            score(
                `<measure number="1">${ATTR}<note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><staff>2</staff></note></measure>`,
            ),
        );
        expect(notes[0]?.staff).toBe(2);
    });

    it("answers an empty document with an empty timeline rather than throwing", () => {
        expect(readTimeline(parse("<nonsense/>"))).toEqual({
            notes: [],
            measureStarts: [],
            directions: [],
            end: 0,
        });
    });
});
