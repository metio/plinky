// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { readTremolos, tremoloNotes, tremoloUnitQuarters } from "./tremolo";

const total = (notes: { quarters: number }[]) => notes.reduce((sum, one) => sum + one.quarters, 0);

describe("tremoloUnitQuarters", () => {
    it("halves the repetition for each slash through the stem", () => {
        expect(tremoloUnitQuarters(1)).toBe(0.5); // quavers
        expect(tremoloUnitQuarters(2)).toBe(0.25); // semiquavers
        expect(tremoloUnitQuarters(3)).toBe(0.125); // demisemiquavers
    });

    it("refuses a slash count the notation cannot express", () => {
        // The result divides a duration, so a zero or a negative would not terminate.
        expect(tremoloUnitQuarters(0)).toBe(0.5);
        expect(tremoloUnitQuarters(-3)).toBe(0.5);
        expect(tremoloUnitQuarters(99)).toBe(2 ** -4);
    });
});

describe("tremoloNotes", () => {
    it("repeats a single note for exactly the time it was written", () => {
        // A half note (2 quarters) in semiquavers is eight notes.
        const figure = tremoloNotes([60], null, 2, 2);
        expect(figure).toHaveLength(8);
        expect(figure.every((one) => one.pitches[0] === 60)).toBe(true);
        expect(total(figure)).toBeCloseTo(2);
    });

    it("rocks between the two chords of an alternating tremolo", () => {
        // The common form on a piano — 2560 of the catalogue's marks against 1105 single.
        const figure = tremoloNotes([48], [55], 1, 2);
        expect(figure.map((one) => one.pitches[0])).toEqual([48, 55, 48, 55]);
    });

    it("keeps every pitch of each chord, so an octave tremolo stays octaves", () => {
        const figure = tremoloNotes([48, 60], [55, 67], 1, 2);
        expect(figure[0]?.pitches).toEqual([48, 60]);
        expect(figure[1]?.pitches).toEqual([55, 67]);
    });

    it("fills the written time exactly even when the rate does not divide it", () => {
        // A tremolo over a dotted note is ordinary, and the figure must neither overrun —
        // pushing the next note late — nor fall short and leave a hole in the bar.
        for (const quarters of [1.5, 3, 0.75, 2.25]) {
            expect(total(tremoloNotes([60], null, quarters, 3))).toBeCloseTo(quarters);
        }
    });

    it("is at least two notes, or it is a repetition of nothing", () => {
        const figure = tremoloNotes([60], null, 0.05, 1);
        expect(figure.length).toBeGreaterThanOrEqual(2);
        expect(total(figure)).toBeCloseTo(0.05);
    });

    it("caps a runaway figure rather than scheduling hundreds of voices", () => {
        // Every note is a scheduled voice. Past the cap the ear cannot follow them
        // individually anyway, so they are made longer rather than more numerous — the
        // shimmer is the same and the figure still fills its own time.
        const figure = tremoloNotes([60], null, 64, 4);
        expect(figure.length).toBeLessThanOrEqual(64);
        expect(total(figure)).toBeCloseTo(64);
    });

    it("has nothing to say about a rest or a note of no length", () => {
        expect(tremoloNotes([], null, 2, 2)).toEqual([]);
        expect(tremoloNotes([60], null, 0, 2)).toEqual([]);
    });

    it("treats an empty second chord as a single-note tremolo", () => {
        // A file that opens an alternating tremolo and never gives the other chord: repeat
        // the note we do have rather than alternating it with silence.
        expect(tremoloNotes([60], [], 1, 2).every((one) => one.pitches[0] === 60)).toBe(true);
    });
});

// The file's own notes, as much of them as the reader looks at.
const note = (
    whole: number,
    midi: number | null,
    tremolo: { beams: number; part: "single" | "start" | "stop" } | null,
    wholes = 0.5,
) => ({ whole, wholes, midi, marks: { tremolo } });

describe("readTremolos", () => {
    it("reads a single-note tremolo over its own note", () => {
        const spans = readTremolos([note(0, 60, { beams: 3, part: "single" }, 1)]);
        expect(spans).toEqual([{ from: 0, to: 1, beams: 3, pair: null }]);
    });

    it("gives an alternating tremolo one span per written note, both the same figure", () => {
        // Both halves spell the same alternation in the same order, so concatenated they are
        // one unbroken rock. One span covering both notes would have to suppress the second
        // position — and with it whatever the other hand was playing there.
        const spans = readTremolos([
            note(0, 48, { beams: 2, part: "start" }),
            note(0.5, 55, { beams: 2, part: "stop" }),
        ]);
        expect(spans).toHaveLength(2);
        expect(spans[0]?.from).toBe(0);
        expect(spans[1]?.from).toBe(0.5);
        expect(spans[0]?.pair).toEqual(spans[1]?.pair);
        expect(spans[0]?.pair?.map((chord) => chord.pitches)).toEqual([[48], [55]]);
    });

    it("takes every note of a chord into the pair", () => {
        const spans = readTremolos([
            note(0, 48, { beams: 2, part: "start" }),
            note(0, 60, { beams: 2, part: "start" }),
            note(0.5, 55, { beams: 2, part: "stop" }),
            note(0.5, 67, { beams: 2, part: "stop" }),
        ]);
        expect(spans[0]?.pair?.map((chord) => chord.pitches)).toEqual([
            [48, 60],
            [55, 67],
        ]);
    });

    it("opens one figure per position however many notes carry the mark", () => {
        // Every note of a chord carries the tremolo mark, and one figure is meant.
        const spans = readTremolos([
            note(0, 60, { beams: 3, part: "single" }, 1),
            note(0, 64, { beams: 3, part: "single" }, 1),
        ]);
        expect(spans).toHaveLength(1);
    });

    it("ignores a tremolo the file opens and never closes", () => {
        expect(readTremolos([note(0, 48, { beams: 2, part: "start" })])).toEqual([]);
    });

    it("ignores an unmarked note and a rest", () => {
        expect(
            readTremolos([note(0, 60, null), note(1, null, { beams: 2, part: "single" })]),
        ).toEqual([]);
    });
});
