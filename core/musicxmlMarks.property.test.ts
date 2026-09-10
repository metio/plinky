// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { GlissandoSpan } from "./glissando";
import { NO_SCORE_MARKS, type ScoreMarks, transposeScoreMarks } from "./musicxmlMarks";
import type { TremoloSpan } from "./tremolo";

const pitch = fc.integer({ min: 21, max: 108 });
const chord = fc.array(pitch, { minLength: 1, maxLength: 4 });
const at = fc.double({ min: 0, max: 64, noNaN: true });

const tremolo: fc.Arbitrary<TremoloSpan> = fc.record({
    from: at,
    to: at,
    beams: fc.integer({ min: 1, max: 4 }),
    pitches: chord,
    pair: fc.option(
        fc.tuple(chord, chord).map(([first, second]) => [
            { at: 0, pitches: first },
            { at: 1, pitches: second },
        ]),
        { nil: null },
    ),
});

const glissando: fc.Arbitrary<GlissandoSpan> = fc.record(
    { from: at, to: at, arrivesAt: pitch, pitch },
    { requiredKeys: ["from", "to", "arrivesAt"] },
);

const fifths = fc.integer({ min: -7, max: 7 });

const marks: fc.Arbitrary<ScoreMarks> = fc
    .record({
        tremolos: fc.array(tremolo, { maxLength: 4 }),
        glissandos: fc.array(glissando, { maxLength: 4 }),
        fifths,
        keys: fc.array(fc.record({ whole: at, fifths }), { maxLength: 3 }),
    })
    .map((some) => ({ ...NO_SCORE_MARKS, ...some }));

const shift = fc.integer({ min: -24, max: 24 });

// Every MIDI number a set of marks carries, in a fixed order.
function pitchesOf(read: ScoreMarks): number[] {
    return [
        ...read.tremolos.flatMap((span) => [
            ...span.pitches,
            ...(span.pair ?? []).flatMap((one) => one.pitches),
        ]),
        ...read.glissandos.flatMap((span) => [
            span.arrivesAt,
            ...(span.pitch === undefined ? [] : [span.pitch]),
        ]),
    ];
}

// The tonic a signature names, as a pitch class: six sharps and six flats are one key.
const tonicOf = (value: number) => (((value * 7) % 12) + 12) % 12;

describe("transposeScoreMarks", () => {
    it("moves every pitch a mark carries by exactly the transposition", () => {
        fc.assert(
            fc.property(marks, shift, (read, semitones) => {
                const moved = pitchesOf(transposeScoreMarks(read, semitones));
                expect(moved).toEqual(pitchesOf(read).map((one) => one + semitones));
            }),
        );
    });

    it("comes back to the file's own pitches and keys when transposed there and back", () => {
        fc.assert(
            fc.property(marks, shift, (read, semitones) => {
                const back = transposeScoreMarks(transposeScoreMarks(read, semitones), -semitones);
                expect(back.tremolos).toEqual(read.tremolos);
                expect(back.glissandos).toEqual(read.glissandos);
                expect(tonicOf(back.fifths)).toBe(tonicOf(read.fifths));
                expect(back.keys.map((point) => tonicOf(point.fifths))).toEqual(
                    read.keys.map((point) => tonicOf(point.fifths)),
                );
            }),
        );
    });

    it("moves each key's tonic by the transposition and never leaves a signature past seven", () => {
        fc.assert(
            fc.property(marks, shift, (read, semitones) => {
                const moved = transposeScoreMarks(read, semitones);
                const expected = (((tonicOf(read.fifths) + semitones) % 12) + 12) % 12;
                expect(tonicOf(moved.fifths)).toBe(expected);
                expect(Math.abs(moved.fifths)).toBeLessThanOrEqual(7);
            }),
        );
    });
});
