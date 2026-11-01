// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ChordSpan, Mode } from "./harmony";
import { chordSetFor, summarizeChords } from "./pieceChords";
import type { PitchClass } from "./theory";

// What a piece page says about its harmony: the chords it uses, the loop it returns to,
// and the drills that practise them. Read off the chord analysis, so it inherits whatever
// that got wrong — which means the laws worth stating are the ones about counting and
// about what a loop IS: a progression that appears once is a passage, and I V vi IV is
// the same loop as V vi IV I whichever rotation the piece happened to start on.

const NUMERALS = ["I", "ii", "iii", "IV", "V", "vi", "vii°", "V7", "ii7", "IVΔ7"];

const span = (
    numeral: string,
    at: number,
    key: { tonic: PitchClass; mode: Mode } = { tonic: 0, mode: "major" },
): ChordSpan =>
    ({
        from: at,
        to: at + 1,
        root: 0,
        quality: "major",
        bass: 0,
        inversion: 0,
        numeral,
        key: { ...key, fifths: 0 },
        confidence: 1,
    }) as ChordSpan;

const arbSpans = fc
    .array(fc.constantFrom(...NUMERALS), { minLength: 1, maxLength: 24 })
    .map((numerals) => numerals.map((numeral, at) => span(numeral, at)));

// A piece that plays one loop over and over, which is what most teaching pieces do.
const arbLooping = fc
    .tuple(
        fc.uniqueArray(fc.constantFrom("I", "ii", "IV", "V", "vi"), { minLength: 4, maxLength: 4 }),
        fc.integer({ min: 2, max: 5 }),
    )
    .map(([loop, times]) => {
        const played = Array.from({ length: times }, () => loop).flat();
        return { loop, spans: played.map((numeral, at) => span(numeral, at)) };
    });

describe("what a piece page says about its harmony", () => {
    it("says nothing about a piece with no harmony read off it", () => {
        expect(summarizeChords([])).toBeNull();
    });

    it("counts changes rather than time", () => {
        fc.assert(
            fc.property(arbSpans, (spans) => {
                const chords = summarizeChords(spans);
                if (chords === null) {
                    return;
                }

                // A chord held for four bars is one chord: a piece sitting on I for half
                // its length is not "mostly I" in any sense a player needs.
                const held = spans.map((one) => one.numeral);
                const changes = held.filter((numeral, at) => numeral !== held[at - 1]);
                const total = chords.vocabulary.reduce((sum, one) => sum + one.count, 0);
                expect(total).toBe(changes.length);
            }),
        );
    });

    it("lists the commonest chord first, and each chord once", () => {
        fc.assert(
            fc.property(arbSpans, (spans) => {
                const chords = summarizeChords(spans);
                if (chords === null) {
                    return;
                }

                const numerals = chords.vocabulary.map((one) => one.numeral);
                expect(new Set(numerals).size).toBe(numerals.length);
                chords.vocabulary.forEach((one, at) => {
                    const before = chords.vocabulary[at - 1];
                    expect(one.count).toBeGreaterThan(0);
                    if (before) {
                        // Commonest first, ties by numeral so the order is not the
                        // analysis's own.
                        expect(before.count).toBeGreaterThanOrEqual(one.count);
                    }
                });
            }),
        );
    });

    it("reads a loop only where one recurs", () => {
        fc.assert(
            fc.property(arbLooping, ({ loop, spans }) => {
                const chords = summarizeChords(spans);

                expect(chords?.progression).not.toBeNull();
                expect(chords?.progression?.length).toBe(4);
                // The same four chords, in the same cycle — whichever rotation the piece
                // started on, since a loop has no first chord.
                expect(new Set(chords?.progression)).toEqual(new Set(loop));
            }),
        );
    });

    it("calls a passage played once a passage, not a progression", () => {
        const once = ["I", "V", "vi", "IV"].map((numeral, at) => span(numeral, at));

        // A progression is a loop by definition.
        expect(summarizeChords(once)?.progression).toBeNull();
    });

    it("names the same loop whatever rotation the piece begins on", () => {
        const loop = ["I", "V", "vi", "IV"];
        const read = (start: number) => {
            const rotated = [...loop.slice(start), ...loop.slice(0, start)];
            const played = [...rotated, ...rotated, ...rotated];
            return summarizeChords(played.map((numeral, at) => span(numeral, at)))?.progression;
        };

        // I V vi IV and V vi IV I are the same progression on the shelf.
        expect(read(1)).toEqual(read(0));
        expect(read(2)).toEqual(read(0));
        expect(read(3)).toEqual(read(0));
        expect(read(0)?.[0]).toBe("I");
    });

    it("reads a loop over triads, so a seventh does not make a different one", () => {
        const plain = ["I", "V", "vi", "IV"];
        const sevenths = ["I", "V7", "vi", "IVΔ7"];
        const play = (chords: string[]) =>
            summarizeChords(
                [...chords, ...chords, ...chords].map((numeral, at) => span(numeral, at)),
            )?.progression;

        // A loop is the same loop whether its V carries a seventh this time round.
        expect(play(sevenths)).toEqual(play(plain));
    });

    it("ignores a passage that has changed key", () => {
        const home = ["I", "V", "vi", "IV"].map((numeral, at) => span(numeral, at));
        const away = ["I", "V"].map((numeral, at) =>
            span(numeral, at + 10, { tonic: 7, mode: "major" }),
        );

        const chords = summarizeChords([...home, ...away, ...home]);

        // The page is about one key — the one the piece opens in — and counting a
        // modulation's chords under it would describe a piece nobody played.
        expect(chords?.key.tonic).toBe(0);
        const total = chords?.vocabulary.reduce((sum, one) => sum + one.count, 0) ?? 0;
        expect(total).toBe(8);
    });
});

describe("the drills a piece's key points at", () => {
    it("names a chord set for every key the shelf ships, and nothing outside them", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 11 }),
                fc.constantFrom<Mode>("major", "minor"),
                (tonic, mode) => {
                    const set = chordSetFor({ tonic, mode });

                    if (set !== null) {
                        expect(set).toMatch(/^chords-[a-z-]+-(major|minor)$/);
                        expect(set.endsWith(mode)).toBe(true);
                    }
                    expect(chordSetFor({ tonic, mode })).toBe(set);
                },
            ),
        );
    });

    it("offers an ear level only where the drill plays that key's chords", () => {
        fc.assert(
            fc.property(arbSpans, (spans) => {
                const chords = summarizeChords(spans);
                if (chords === null) {
                    return;
                }

                if (chords.key.mode === "minor") {
                    // The drill plays major progressions, so a minor piece points at none.
                    expect(chords.earLevel).toBeNull();
                }
                if (chords.earLevel !== null) {
                    expect(Number.isInteger(chords.earLevel)).toBe(true);
                    expect(chords.earLevel).toBeGreaterThanOrEqual(0);
                }
            }),
        );
    });
});
