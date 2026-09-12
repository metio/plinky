// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readGlissandos } from "./glissando";

// Several sweeps open at once in one part, each under its own number, starting and landing
// in any order. Sweep `index` starts on pitch 40 + index and lands on 80 + index, so a span
// that paired the wrong start and stop names two pitches from different sweeps.
const sweeps = fc
    .uniqueArray(fc.integer({ min: 1, max: 16 }), { minLength: 1, maxLength: 6 })
    .chain((numbers) =>
        fc.tuple(
            fc.constant(numbers),
            fc.array(
                fc
                    .tuple(fc.integer({ min: 0, max: 15 }), fc.integer({ min: 1, max: 16 }))
                    .map(([start, length]) => ({ start: start / 16, stop: (start + length) / 16 })),
                { minLength: numbers.length, maxLength: numbers.length },
            ),
            // Tie-break for marks at one onset: the timeline orders them by staff, which
            // says nothing about which sweep is which.
            fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
                minLength: 2 * numbers.length,
                maxLength: 2 * numbers.length,
            }),
        ),
    );

describe("readGlissandos over numbered sweeps", () => {
    it("pairs every start with the stop of its own number", () => {
        fc.assert(
            fc.property(sweeps, ([numbers, times, order]) => {
                const marks = numbers.flatMap((number, index) => {
                    const { start, stop } = times[index] as { start: number; stop: number };
                    return [
                        { whole: start, midi: 40 + index, type: "start" as const, number },
                        { whole: stop, midi: 80 + index, type: "stop" as const, number },
                    ];
                });
                const notes = marks
                    .map((mark, index) => ({ mark, tie: order[index] as number }))
                    .sort((one, other) => one.mark.whole - other.mark.whole || one.tie - other.tie)
                    .map(({ mark }) => ({
                        whole: mark.whole,
                        wholes: 1 / 16,
                        midi: mark.midi,
                        part: "P1",
                        marks: { glissando: mark.type, glissandoNumber: String(mark.number) },
                    }));
                const spans = readGlissandos(notes);
                expect(spans).toHaveLength(numbers.length);
                for (const span of spans) {
                    const index = (span.pitch as number) - 40;
                    const { start, stop } = times[index] as { start: number; stop: number };
                    expect(span).toEqual({
                        from: start,
                        to: stop + 1 / 16,
                        arrivesAt: 80 + index,
                        pitch: 40 + index,
                    });
                }
            }),
        );
    });
});
