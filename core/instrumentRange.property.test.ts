// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fitToInstrument, type InstrumentRange } from "./instrumentRange";

// The fit decides what a player hears, so its two claims have to hold for every piece
// against every instrument: a shift it reports really does land the piece inside the
// keys, and a shift it declines really was impossible. The second is the one worth
// proving — a false "beyond" quietly refuses to help someone whose piece would have
// fitted, and no example test would notice.

const note = fc.integer({ min: 12, max: 120 });

// An ordered pair, so every generated range is a range.
const range = fc
    .tuple(note, note)
    .map(([a, b]): InstrumentRange => ({ from: Math.min(a, b), to: Math.max(a, b) }));

const OCTAVES = Array.from({ length: 21 }, (_, index) => (index - 10) * 12);

function contains(instrument: InstrumentRange, piece: InstrumentRange, shift: number): boolean {
    return piece.from + shift >= instrument.from && piece.to + shift <= instrument.to;
}

describe("fitToInstrument", () => {
    it("only ever reports a shift that actually fits, in whole octaves", () => {
        fc.assert(
            fc.property(range, range, (piece, instrument) => {
                const fit = fitToInstrument(piece, instrument);
                if (fit.kind === "beyond") {
                    return;
                }
                // Not toBe(0): a negative multiple leaves -0, which Object.is separates
                // from 0 while arithmetic does not.
                expect(fit.shift % 12 === 0).toBe(true);
                expect(contains(instrument, piece, fit.shift)).toBe(true);
            }),
        );
    });

    it("reports the smallest move that works, so a piece stays near its own register", () => {
        fc.assert(
            fc.property(range, range, (piece, instrument) => {
                const fit = fitToInstrument(piece, instrument);
                if (fit.kind === "beyond") {
                    return;
                }
                const nearer = OCTAVES.filter(
                    (shift) =>
                        Math.abs(shift) < Math.abs(fit.shift) && contains(instrument, piece, shift),
                );
                expect(nearer).toEqual([]);
            }),
        );
    });

    it("declines only when no whole octave would have fitted", () => {
        fc.assert(
            fc.property(range, range, (piece, instrument) => {
                if (fitToInstrument(piece, instrument).kind !== "beyond") {
                    return;
                }
                expect(OCTAVES.filter((shift) => contains(instrument, piece, shift))).toEqual([]);
            }),
        );
    });

    it("leaves a piece where it is whenever it already fits", () => {
        fc.assert(
            fc.property(range, range, (piece, instrument) => {
                fc.pre(contains(instrument, piece, 0));
                expect(fitToInstrument(piece, instrument)).toEqual({ kind: "fits", shift: 0 });
            }),
        );
    });
});
