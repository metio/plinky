// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pianoParts } from "./accompaniment";
import { markScope } from "./markScope";
import { readScoreMarks } from "./musicxmlMarks";

// For any layout of parts, a mark written in one part never reaches another part's notes.
//
// Every part gets two crotchets on each of its staves, at pitches no other staff shares.
// One part carries every kind of mark on its first staff: an arch, a tremolo, a glissando,
// a dynamic and the pedal. What is read back must name that part's staff and pitches alone,
// or nothing when the page does not draw it.

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

function build(layout: readonly number[], marked: number): Document {
    let global = 0;
    const parts = layout.map((staves, index) => {
        const staffNotes: string[] = [];
        for (let staff = 1; staff <= staves; staff++) {
            const [first, second] = pitchesOn(global);
            global++;
            const carries = index === marked && staff === 1;
            staffNotes.push(
                note(
                    first,
                    staff,
                    carries
                        ? '<slur number="1" type="start"/><glissando type="start"/><ornaments><tremolo type="single">3</tremolo></ornaments>'
                        : "",
                ) +
                    note(
                        second,
                        staff,
                        carries ? '<slur number="1" type="stop"/><glissando type="stop"/>' : "",
                    ),
            );
        }
        const directions =
            index === marked
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

const scenario = fc
    .array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 4 })
    .chain((layout) =>
        fc.record({
            layout: fc.constant(layout),
            marked: fc.integer({ min: 0, max: layout.length - 1 }),
            accompaniment: fc.boolean(),
        }),
    );

describe("marks on a score of any part layout", () => {
    it("never lay a mark written in one part over another part's notes", () => {
        fc.assert(
            fc.property(scenario, ({ layout, marked, accompaniment }) => {
                const doc = build(layout, marked);
                const marks = readScoreMarks(doc, { accompaniment });
                const scope = markScope(doc, accompaniment);
                const id = `P${marked}`;
                const global = layout.slice(0, marked).reduce((sum, count) => sum + count, 0);
                const [first, second] = pitchesOn(global);
                const staff = scope.engraved(id, 1);

                if (staff === null) {
                    expect(marks.slurs).toEqual([]);
                    expect(marks.tremolos).toEqual([]);
                    expect(marks.glissandos).toEqual([]);
                } else {
                    expect(marks.slurs).toEqual([{ from: 0, to: 0.25, staff }]);
                    expect(marks.tremolos.map((span) => span.pitches)).toEqual([[first]]);
                    expect(marks.glissandos).toEqual([
                        { from: 0, to: 0.5, arrivesAt: second, pitch: first },
                    ]);
                }

                const played = pianoParts(doc).some((part) => part.getAttribute("id") === id);
                expect(marks.dynamics.length > 0).toBe(played);
                expect(marks.pedals.length > 0).toBe(played);
            }),
        );
    });

    it("give every staff the page draws a number of its own, from 0 up", () => {
        fc.assert(
            fc.property(scenario, ({ layout, accompaniment }) => {
                const doc = build(layout, 0);
                const scope = markScope(doc, accompaniment);
                const numbers = layout.flatMap((staves, index) =>
                    Array.from({ length: staves }, (_, staff) =>
                        scope.engraved(`P${index}`, staff + 1),
                    ).filter((one): one is number => one !== null),
                );
                expect([...numbers].sort((a, b) => a - b)).toEqual(
                    Array.from({ length: numbers.length }, (_, index) => index),
                );
                // With everything drawn, that is the whole score in part order.
                if (accompaniment) {
                    expect(numbers).toEqual(
                        Array.from({ length: layout.reduce((a, b) => a + b, 0) }, (_, i) => i),
                    );
                }
            }),
        );
    });
});
