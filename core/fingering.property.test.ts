// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fingerPositions, HAND_REACH, positionsCost, reachingCost } from "./fingering";

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

// A position one hand cannot span is priced as held in part, the rest given away. These
// pin what that pricing may and may not do to a sequence.
describe("pricing a position wider than one hand", () => {
    const arbGaps = (length: number) =>
        fc.array(fc.double({ min: 0, max: 4, noNaN: true }), {
            minLength: length,
            maxLength: length,
        });
    // What the other hand strikes at each position: nothing, some notes, or not known.
    const arbOthers = (length: number) =>
        fc.array(
            fc.option(fc.uniqueArray(fc.integer({ min: 24, max: 108 }), { maxLength: 4 }), {
                nil: undefined,
            }),
            {
                minLength: length,
                maxLength: length,
            },
        );
    // Chords from anywhere on the keyboard, so plenty of them are wider than an octave.
    const arbWideChord = fc.uniqueArray(fc.integer({ min: 24, max: 108 }), {
        minLength: 1,
        maxLength: 5,
    });
    const arbWidePiece = fc.array(arbWideChord, { minLength: 1, maxLength: 6 });
    const isWide = (pitches: number[]) =>
        pitches.length > 1 && Math.max(...pitches) - Math.min(...pitches) > HAND_REACH;

    it("prices exactly as the one-hand search does while the other hand is unknown", () => {
        fc.assert(
            fc.property(
                arbWidePiece.chain((positions) =>
                    fc.tuple(fc.constant(positions), arbGaps(positions.length)),
                ),
                arbHand,
                ([positions, gaps], hand) => {
                    expect(reachingCost(positions, hand, gaps)).toBe(
                        positionsCost(
                            positions,
                            fingerPositions(positions, hand, undefined, gaps),
                            hand,
                            undefined,
                            gaps,
                        ),
                    );
                },
            ),
        );
    });

    it("prices a sequence within reach exactly as the one-hand search does", () => {
        // Every chord fits in an octave above its lowest note.
        const arbNarrow = fc
            .tuple(
                fc.integer({ min: 36, max: 84 }),
                fc.uniqueArray(fc.integer({ min: 0, max: HAND_REACH }), {
                    minLength: 1,
                    maxLength: 5,
                }),
            )
            .map(([base, offsets]) => offsets.map((offset) => base + offset));
        fc.assert(
            fc.property(
                fc
                    .array(arbNarrow, { minLength: 1, maxLength: 8 })
                    .chain((positions) =>
                        fc.tuple(fc.constant(positions), arbGaps(positions.length)),
                    ),
                arbHand,
                ([positions, gaps], hand) => {
                    expect(reachingCost(positions, hand, gaps)).toBe(
                        positionsCost(
                            positions,
                            fingerPositions(positions, hand, undefined, gaps),
                            hand,
                            undefined,
                            gaps,
                        ),
                    );
                },
            ),
        );
    });

    it("does not depend on the order a chord was written in", () => {
        fc.assert(
            fc.property(
                arbPiece.chain((piece) =>
                    fc.tuple(
                        fc.constant(piece),
                        arbGaps(piece.written.length),
                        arbOthers(piece.written.length),
                    ),
                ),
                arbHand,
                ([piece, gaps, others], hand) => {
                    expect(reachingCost(piece.written, hand, gaps, others)).toBe(
                        reachingCost(piece.ascending, hand, gaps, others),
                    );
                },
            ),
        );
    });

    it("never costs less than keeping the position whole or holding the easier part alone", () => {
        fc.assert(
            fc.property(
                arbWidePiece.chain((positions) =>
                    fc.tuple(
                        fc.constant(positions),
                        arbGaps(positions.length),
                        arbOthers(positions.length),
                    ),
                ),
                arbHand,
                ([positions, gaps, others], hand) => {
                    const at = positions.findIndex(isWide);
                    if (at < 0) {
                        return;
                    }
                    const ascending = [...positions[at]!].sort((a, b) => a - b);
                    // Every run of the position one hand spans, standing in for all of it.
                    const parts: number[][] = [];
                    for (let lo = 0; lo < ascending.length; lo++) {
                        for (let hi = lo; hi < ascending.length; hi++) {
                            if (ascending[hi]! - ascending[lo]! <= HAND_REACH) {
                                parts.push(ascending.slice(lo, hi + 1));
                            }
                        }
                    }
                    // Kept whole: with nobody known to share it, only the whole chord is left.
                    const whole = reachingCost(
                        positions,
                        hand,
                        gaps,
                        others.map((struck, k) => (k === at ? undefined : struck)),
                    );
                    const easiest = Math.min(
                        whole,
                        ...parts.map((part) =>
                            reachingCost(
                                positions.map((pitches, k) => (k === at ? part : pitches)),
                                hand,
                                gaps,
                                others,
                            ),
                        ),
                    );
                    expect(reachingCost(positions, hand, gaps, others)).toBeGreaterThanOrEqual(
                        easiest - 1e-9,
                    );
                },
            ),
        );
    });

    it("never costs more when the other hand is free than when it is busy", () => {
        fc.assert(
            fc.property(
                arbWidePiece.chain((positions) =>
                    fc.tuple(fc.constant(positions), arbGaps(positions.length)),
                ),
                arbHand,
                ([positions, gaps], hand) => {
                    const free = reachingCost(
                        positions,
                        hand,
                        gaps,
                        positions.map(() => []),
                    );
                    expect(free).toBeLessThanOrEqual(reachingCost(positions, hand, gaps));
                },
            ),
        );
    });
});
