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
                        marks: { glissandos: [{ type: mark.type, number: String(mark.number) }] },
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

// Chained sweeps: a line of notes, each gliding on to the next, so every note inside the
// chain ends one sweep and starts another. Each chain owns two numbers and each link takes
// either, so a chained note's stop and start share a number or differ. Note `link` of chain
// `index` is pitch 20 + 10 * index + link, which names the chain and the link a span came
// from.
const chains = fc.array(
    fc
        .uniqueArray(fc.integer({ min: 0, max: 31 }), { minLength: 2, maxLength: 6 })
        .chain((positions) =>
            fc.record({
                positions: fc.constant([...positions].sort((one, other) => one - other)),
                numbers: fc.array(fc.boolean(), {
                    minLength: positions.length - 1,
                    maxLength: positions.length - 1,
                }),
                stopFirst: fc.array(fc.boolean(), {
                    minLength: positions.length,
                    maxLength: positions.length,
                }),
                tie: fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
                    minLength: positions.length,
                    maxLength: positions.length,
                }),
            }),
        ),
    { minLength: 1, maxLength: 4 },
);

describe("readGlissandos over chained sweeps", () => {
    it("pairs every link of every chain, whatever order a note's marks are in", () => {
        fc.assert(
            fc.property(chains, (drawn) => {
                const numberOf = (index: number, link: number) =>
                    String(2 * index + ((drawn[index]?.numbers[link] ?? false) ? 2 : 1));
                const notes = drawn
                    .flatMap(({ positions, stopFirst, tie }, index) =>
                        positions.map((position, link) => {
                            const stop =
                                link > 0
                                    ? [{ type: "stop" as const, number: numberOf(index, link - 1) }]
                                    : [];
                            const start =
                                link < positions.length - 1
                                    ? [{ type: "start" as const, number: numberOf(index, link) }]
                                    : [];
                            return {
                                whole: position / 16,
                                wholes: 1 / 16,
                                midi: 20 + 10 * index + link,
                                part: "P1",
                                marks: {
                                    glissandos: stopFirst[link]
                                        ? [...stop, ...start]
                                        : [...start, ...stop],
                                },
                                tie: tie[link] as number,
                            };
                        }),
                    )
                    .sort((one, other) => one.whole - other.whole || one.tie - other.tie);
                const expected = drawn.flatMap(({ positions }, index) =>
                    positions.slice(1).map((position, link) => ({
                        from: (positions[link] as number) / 16,
                        to: position / 16 + 1 / 16,
                        arrivesAt: 20 + 10 * index + link + 1,
                        pitch: 20 + 10 * index + link,
                    })),
                );
                const byPitch = (one: { pitch?: number }, other: { pitch?: number }) =>
                    (one.pitch ?? 0) - (other.pitch ?? 0);
                expect(readGlissandos(notes).sort(byPitch)).toEqual(expected.sort(byPitch));
            }),
        );
    });
});
