// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readTimeline } from "./musicxmlTimeline";

// Where every note sits in time, read out of the file. Everything downstream measures
// against these onsets — Listen, Play, the grader, the exports — so a note in the wrong
// place is wrong everywhere at once, silently.
//
// The generated scores here are small but awkward on purpose: two parts whose voices
// stop at different points in the bar, whole-measure rests written longer than the
// metre, chords, grace notes. Those are the shapes that made bars drift apart between
// parts, which is the failure these laws exist to catch.

const DIVISIONS = 4;
const WHOLE = DIVISIONS * 4;

type Item =
    | { kind: "note"; ticks: number; chord: boolean }
    | { kind: "rest"; ticks: number }
    | { kind: "grace" };

// One voice's worth of a bar. The content may fall short of the metre — a voice that
// stops early — or run past it, which engravings do and the reader must cap.
const arbItem: fc.Arbitrary<Item> = fc.oneof(
    fc
        .tuple(fc.constantFrom(2, 4, 8), fc.boolean())
        .map(([ticks, chord]) => ({ kind: "note" as const, ticks, chord })),
    fc.constantFrom(2, 4, 8).map((ticks) => ({ kind: "rest" as const, ticks })),
    fc.constant({ kind: "grace" as const }),
);

const arbBar = fc.array(arbItem, { minLength: 1, maxLength: 5 });
const arbPart = fc.array(arbBar, { minLength: 1, maxLength: 4 });

const itemXml = (item: Item, at: number) => {
    if (item.kind === "grace") {
        return `<note><grace/><pitch><step>D</step><octave>5</octave></pitch><voice>1</voice></note>`;
    }
    if (item.kind === "rest") {
        return `<note><rest/><duration>${item.ticks}</duration><voice>1</voice></note>`;
    }
    const step = "CDEFGAB"[at % 7] ?? "C";
    // A chord member only counts as one where something precedes it in the bar.
    const chord = item.chord && at > 0 ? "<chord/>" : "";
    return `<note>${chord}<pitch><step>${step}</step><octave>4</octave></pitch><duration>${item.ticks}</duration><voice>1</voice></note>`;
};

const attributes = `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>`;

const partXml = (bars: Item[][], id: string) =>
    `<part id="${id}">${bars
        .map(
            (items, index) =>
                `<measure number="${index + 1}">${index === 0 ? attributes : ""}${items
                    .map((item, at) => itemXml(item, at))
                    .join("")}</measure>`,
        )
        .join("")}</part>`;

const scoreOf = (parts: Item[][][]) => {
    const list = parts
        .map((_, index) => `<score-part id="P${index + 1}"><part-name>P</part-name></score-part>`)
        .join("");
    const bodies = parts.map((bars, index) => partXml(bars, `P${index + 1}`)).join("");
    return new DOMParser().parseFromString(
        `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list>${list}</part-list>${bodies}</score-partwise>`,
        "application/xml",
    );
};

// Two parts of their own shapes: the case where one hand's voice stops short of the
// barline and the other runs on.
const arbScore = fc.array(arbPart, { minLength: 1, maxLength: 2 }).map(scoreOf);

// The same bars, trimmed to what the metre asks for. A bar written longer than its metre
// keeps its notes' onsets while its advance to the next bar is capped, so its last notes
// sit past where the music is said to run to — true of the file, not a fault of the
// reader, and the reason the law below is stated only where the bars fit.
const fitting = (items: Item[]) => {
    let ticks = 0;
    return items.filter((item) => {
        if (item.kind === "grace") {
            return true;
        }
        if (item.kind === "note" && item.chord) {
            return true;
        }
        ticks += item.ticks;
        return ticks <= WHOLE;
    });
};
const arbFittingScore = fc
    .array(fc.array(arbBar.map(fitting), { minLength: 1, maxLength: 4 }), {
        minLength: 1,
        maxLength: 2,
    })
    .map(scoreOf);

describe("reading a score's timeline", () => {
    it("never places a note before the one in front of it", () => {
        fc.assert(
            fc.property(arbScore, (doc) => {
                const { notes } = readTimeline(doc);

                const onsets = notes.map((note) => note.whole);
                expect([...onsets].sort((a, b) => a - b)).toEqual(onsets);
                for (const note of notes) {
                    expect(note.whole).toBeGreaterThanOrEqual(0);
                    expect(note.wholes).toBeGreaterThanOrEqual(0);
                    expect(Number.isFinite(note.whole)).toBe(true);
                }
            }),
        );
    });

    it("starts every bar where the bar before it reached, for every part at once", () => {
        fc.assert(
            fc.property(arbScore, (doc) => {
                const { measureStarts, bars, end } = readTimeline(doc);

                const rising = [...measureStarts].sort((a, b) => a - b);
                expect(measureStarts).toEqual(rising);
                expect(measureStarts[0]).toBe(0);
                expect(bars.map((bar) => bar.from)).toEqual(measureStarts);
                for (const start of measureStarts) {
                    expect(start).toBeLessThanOrEqual(end);
                }
            }),
        );
    });

    it("gives a bar no more time than its metre asks for", () => {
        fc.assert(
            fc.property(arbScore, (doc) => {
                const { measureStarts, bars } = readTimeline(doc);

                for (const [index, bar] of bars.entries()) {
                    const next = measureStarts[index + 1];
                    if (next === undefined) {
                        continue;
                    }
                    const metre = bar.beats / bar.beatType;
                    // A bar written longer than its metre is capped; one written shorter
                    // keeps what it was given, so this is an upper bound, not an equality.
                    expect(next - bar.from).toBeLessThanOrEqual(metre + 1e-9);
                }
            }),
        );
    });

    it("keeps every note inside the music, where the bars fit their metre", () => {
        fc.assert(
            fc.property(arbFittingScore, (doc) => {
                const { notes, measureStarts, end } = readTimeline(doc);

                for (const note of notes) {
                    expect(note.whole).toBeGreaterThanOrEqual(measureStarts[0] ?? 0);
                    expect(note.whole).toBeLessThanOrEqual(end + 1e-9);
                }
            }),
        );
    });

    it("sounds a chord together, and gives a grace note no time of its own", () => {
        fc.assert(
            fc.property(arbScore, (doc) => {
                const { notes } = readTimeline(doc);

                for (const [index, note] of notes.entries()) {
                    if (note.grace) {
                        expect(note.wholes).toBe(0);
                    }
                    if (!note.chord) {
                        continue;
                    }
                    // A chord member sounds with what it was written against: some note
                    // at the same moment, in the same part.
                    const together = notes
                        .slice(0, index)
                        .some((other) => other.part === note.part && other.whole === note.whole);
                    expect(together).toBe(true);
                }
            }),
        );
    });

    it("reads the same file the same way twice", () => {
        fc.assert(
            fc.property(arbScore, (doc) => {
                const first = readTimeline(doc);
                const second = readTimeline(doc);

                expect(second.notes.map((note) => [note.whole, note.wholes, note.midi])).toEqual(
                    first.notes.map((note) => [note.whole, note.wholes, note.midi]),
                );
                expect(second.measureStarts).toEqual(first.measureStarts);
                expect(second.end).toBe(first.end);
            }),
        );
    });
});
