// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fingerPositions, positionsCost } from "./fingering";

// MusicXML lets a chord's notes arrive in any order, so the order a chord was written in
// is no fact about how to play it. These pin that the fingering model reads a chord as
// the set of pitches it is.

const arbChord = fc.uniqueArray(fc.integer({ min: 36, max: 96 }), { minLength: 1, maxLength: 5 });

// A sequence of chords, each with a random reordering of its notes: the written order.
const arbPiece = fc
    .array(
        arbChord.chain((chord) =>
            fc
                .array(fc.double({ noNaN: true }), {
                    minLength: chord.length,
                    maxLength: chord.length,
                })
                .map((keys) => ({
                    ascending: [...chord].sort((a, b) => a - b),
                    written: chord
                        .map((pitch, at) => ({ pitch, key: keys[at]! }))
                        .sort((a, b) => a.key - b.key)
                        .map(({ pitch }) => pitch),
                })),
        ),
        { minLength: 1, maxLength: 8 },
    )
    .map((chords) => ({
        ascending: chords.map((chord) => chord.ascending),
        written: chords.map((chord) => chord.written),
    }));

const arbHand = fc.constantFrom("left" as const, "right" as const);
const arbSpan = fc.option(fc.integer({ min: 5, max: 24 }), { nil: undefined });

// Which finger each pitch took, so two orderings of one chord compare as the same shape.
const byPitch = (positions: number[][], fingers: number[][]) =>
    positions.map((pitches, at) =>
        Object.fromEntries(pitches.map((pitch, n) => [pitch, fingers[at]?.[n]])),
    );

describe("fingering a chord in any written order", () => {
    it("gives every pitch the same finger", () => {
        fc.assert(
            fc.property(arbPiece, arbHand, arbSpan, (piece, hand, span) => {
                const written = fingerPositions(piece.written, hand, span);
                const ascending = fingerPositions(piece.ascending, hand, span);
                expect(byPitch(piece.written, written)).toEqual(
                    byPitch(piece.ascending, ascending),
                );
            }),
        );
    });

    it("costs the same", () => {
        fc.assert(
            fc.property(arbPiece, arbHand, arbSpan, (piece, hand, span) => {
                const written = positionsCost(
                    piece.written,
                    fingerPositions(piece.written, hand, span),
                    hand,
                    span,
                );
                const ascending = positionsCost(
                    piece.ascending,
                    fingerPositions(piece.ascending, hand, span),
                    hand,
                    span,
                );
                expect(written).toBeCloseTo(ascending, 9);
            }),
        );
    });

    it("never crosses fingers within a chord", () => {
        fc.assert(
            fc.property(arbPiece, arbHand, (piece, hand) => {
                const fingers = fingerPositions(piece.written, hand);
                for (const [at, pitches] of piece.written.entries()) {
                    if (pitches.length > 5) {
                        continue;
                    }
                    const ordered = pitches
                        .map((pitch, n) => ({ pitch, finger: fingers[at]![n]! }))
                        .sort((a, b) => a.pitch - b.pitch)
                        .map(({ finger }) => finger);
                    const rising = ordered.every(
                        (finger, n) =>
                            n === 0 ||
                            (hand === "right"
                                ? finger > ordered[n - 1]!
                                : finger < ordered[n - 1]!),
                    );
                    expect(rising).toBe(true);
                }
            }),
        );
    });
});
