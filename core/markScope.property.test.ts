// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readScoreMarks } from "./musicxmlMarks";

// For any layout of parts, a mark written in one part never reaches another part's notes.
//
// Every part gets two crotchets on each of its staves, at pitches no other staff shares.
// Some of the parts carry every kind of mark: an arch, a tremolo, a glissando, a dynamic and
// the pedal. What is read back must name those parts' staves and pitches alone, each once,
// or nothing for a part the page does not draw.
//
// Which parts are the piano's, and where the page draws each staff, are written out below
// from the rule itself rather than asked of the code under test.

const STEPS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

const pitch = (midi: number) =>
    `<pitch><step>${STEPS[midi % 12]}</step><alter>${ALTERS[midi % 12]}</alter><octave>${
        Math.floor(midi / 12) - 1
    }</octave></pitch>`;

// The pitches written on the score-wide staff `global`, at onset 0 and at a crotchet.
const pitchesOn = (global: number): [number, number] => [40 + global * 3, 41 + global * 3];

const note = (midi: number, staff: number, notations: string) =>
    `<note>${pitch(midi)}<duration>4</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff>${
        notations ? `<notations>${notations}</notations>` : ""
    }</note>`;

// A score of `layout` staves per part, where `carries(part, staff)` says which staves are
// marked. A part with any marked staff also carries a dynamic and the pedal.
function build(layout: readonly number[], carries: (part: number, staff: number) => boolean) {
    let global = 0;
    const parts = layout.map((staves, index) => {
        const staffNotes: string[] = [];
        let marked = false;
        for (let staff = 1; staff <= staves; staff++) {
            const [first, second] = pitchesOn(global);
            global++;
            const on = carries(index, staff);
            marked ||= on;
            staffNotes.push(
                note(
                    first,
                    staff,
                    on
                        ? '<slur number="1" type="start"/><glissando type="start"/><ornaments><tremolo type="single">3</tremolo></ornaments>'
                        : "",
                ) +
                    note(
                        second,
                        staff,
                        on ? '<slur number="1" type="stop"/><glissando type="stop"/>' : "",
                    ),
            );
        }
        const directions = marked
            ? `<direction><direction-type><dynamics><ff/></dynamics></direction-type></direction><direction><direction-type><pedal type="start"/></direction-type></direction>`
            : "";
        return `<part id="P${index}"><measure number="1"><attributes><divisions>4</divisions><staves>${staves}</staves></attributes>${directions}${staffNotes.join(
            "<backup><duration>8</duration></backup>",
        )}</measure></part>`;
    });
    return new DOMParser().parseFromString(
        `<?xml version="1.0"?><score-partwise><part-list>${layout
            .map(
                (_, index) =>
                    `<score-part id="P${index}"><part-name>P${index}</part-name></score-part>`,
            )
            .join("")}</part-list>${parts.join("")}</score-partwise>`,
        "application/xml",
    );
}

// The piano's parts: both of exactly two single-staff parts, which is a piano written as
// two; otherwise the last part with two staves or more; otherwise the last part.
function pianoOf(layout: readonly number[]): Set<number> {
    if (layout.length === 2 && layout[0] === 1 && layout[1] === 1) {
        return new Set([0, 1]);
    }
    let chosen = layout.length - 1;
    for (const [index, staves] of layout.entries()) {
        if (staves >= 2) {
            chosen = index;
        }
    }
    return new Set([chosen]);
}

// Where the page draws each staff: every part's staves in order when the accompaniment is
// drawn, and the piano's alone otherwise. Keyed by the score-wide staff, holding the page's.
function pageStaves(layout: readonly number[], accompaniment: boolean): Map<number, number> {
    const piano = pianoOf(layout);
    const page = new Map<number, number>();
    let global = 0;
    for (const [index, staves] of layout.entries()) {
        for (let staff = 0; staff < staves; staff++, global++) {
            if (accompaniment || piano.has(index)) {
                page.set(global, page.size);
            }
        }
    }
    return page;
}

const firstStaff = (layout: readonly number[], part: number) =>
    layout.slice(0, part).reduce((sum, count) => sum + count, 0);

const scenario = fc
    .array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 4 })
    .chain((layout) =>
        fc.record({
            layout: fc.constant(layout),
            marked: fc
                .uniqueArray(fc.integer({ min: 0, max: layout.length - 1 }), {
                    minLength: 1,
                    maxLength: layout.length,
                })
                .map((parts) => [...parts].sort((a, b) => a - b)),
            accompaniment: fc.boolean(),
        }),
    );

describe("marks on a score of any part layout", () => {
    it("never lay a mark written in one part over another part's notes", () => {
        fc.assert(
            fc.property(scenario, ({ layout, marked, accompaniment }) => {
                const doc = build(layout, (part, staff) => marked.includes(part) && staff === 1);
                const marks = readScoreMarks(doc, { accompaniment });
                const page = pageStaves(layout, accompaniment);
                // Each marked part the page draws, as its first staff's page number and
                // pitches, in part order.
                const drawn = marked.flatMap((part) => {
                    const global = firstStaff(layout, part);
                    const staff = page.get(global);
                    return staff === undefined ? [] : [{ staff, pitches: pitchesOn(global) }];
                });

                expect([...marks.slurs].sort((a, b) => (a.staff ?? -1) - (b.staff ?? -1))).toEqual(
                    drawn.map(({ staff }) => ({ from: 0, to: 0.25, staff })),
                );
                expect(marks.tremolos.map((span) => span.pitches)).toEqual(
                    drawn.map(({ pitches }) => [pitches[0]]),
                );
                expect(marks.glissandos).toEqual(
                    drawn.map(({ pitches: [first, second] }) => ({
                        from: 0,
                        to: 0.5,
                        arrivesAt: second,
                        pitch: first,
                    })),
                );

                const piano = pianoOf(layout);
                const played = marked.some((part) => piano.has(part));
                expect(marks.dynamics.length > 0).toBe(played);
                expect(marks.pedals.length > 0).toBe(played);
            }),
        );
    });

    it("give every staff the page draws a number of its own, from 0 up", () => {
        fc.assert(
            fc.property(scenario, ({ layout, accompaniment }) => {
                const marks = readScoreMarks(
                    build(layout, () => true),
                    { accompaniment },
                );
                const page = pageStaves(layout, accompaniment);
                expect(marks.slurs.map((span) => span.staff ?? -1).sort((a, b) => a - b)).toEqual(
                    Array.from({ length: page.size }, (_, index) => index),
                );
                // One figure per drawn staff, each rocking that staff's own note — two
                // staves shaking at the same onset are two figures.
                expect(
                    marks.tremolos.map((span) => span.pitches[0] ?? -1).sort((a, b) => a - b),
                ).toEqual([...page.keys()].map((global) => pitchesOn(global)[0]));
                // With everything drawn, that is the whole score in part order.
                if (accompaniment) {
                    expect(page.size).toBe(layout.reduce((a, b) => a + b, 0));
                }
            }),
        );
    });
});
