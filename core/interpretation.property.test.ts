// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    assumedPhraseWeight,
    interpretedWeight,
    metricalWeight,
    phraseWeight,
    placeInBar,
    type XmlBar,
} from "./interpretation";
import type { SlurSpan } from "./slur";

// What stops Listen sounding like a machine: how much of its written loudness a note
// keeps for where it falls in the bar and in its phrase. Played flat, four-four and
// three-four sound the same — the metre stops existing — so the ordering of the weights
// IS the bar. Nothing here is visible on the page, and a wrong weight is heard as a piece
// that limps rather than as a fault, which is why the laws are about the ordering and the
// bounds rather than about any one number.

const METRES: Array<[number, number]> = [
    [4, 4],
    [3, 4],
    [2, 4],
    [6, 8],
    [5, 4],
    [12, 8],
    [2, 2],
];

const arbBars: fc.Arbitrary<XmlBar[]> = fc
    .array(fc.constantFrom(...METRES), { minLength: 1, maxLength: 4 })
    .map((metres) => {
        const bars: XmlBar[] = [];
        let from = 0;
        for (const [beats, beatType] of metres) {
            bars.push({ from, beats, beatType });
            from += beats / beatType;
        }
        return bars;
    });

const arbWhole = fc.double({ min: 0, max: 8, noNaN: true });

const arbSlurs: fc.Arbitrary<SlurSpan[]> = fc
    .array(
        fc
            .tuple(
                fc.double({ min: 0, max: 6, noNaN: true }),
                fc.double({ min: 0.25, max: 2, noNaN: true }),
            )
            .map(([from, length]) => ({ from, to: from + length })),
        { maxLength: 3 },
    )
    .map((spans) => spans as SlurSpan[]);

describe("where a moment falls in its bar", () => {
    it("places it inside the bar it names, or nowhere at all", () => {
        fc.assert(
            fc.property(arbBars, arbWhole, (bars, whole) => {
                const place = placeInBar(bars, whole);
                if (place === null) {
                    return;
                }

                expect(place.index).toBeGreaterThanOrEqual(0);
                expect(place.beats).toBeGreaterThan(0);
                expect(place.beat).toBeGreaterThanOrEqual(0);
                // A position is somewhere in its bar, never past the barline: the count
                // carries on into a later bar of the same metre rather than sticking.
                expect(place.beat).toBeLessThan(place.beats + 1e-9);
            }),
        );
    });

    it("counts on past the last metre the file declares", () => {
        fc.assert(
            fc.property(arbBars, fc.integer({ min: 1, max: 6 }), (bars, barsOn) => {
                const last = bars[bars.length - 1] as XmlBar;
                const barWholes = last.beats / last.beatType;

                const here = placeInBar(bars, last.from);
                const later = placeInBar(bars, last.from + barsOn * barWholes);

                // Every bar after the last time signature sitting at the same place in
                // its phrase is exactly what this prevents.
                expect(later?.index).toBe((here?.index ?? 0) + barsOn);
                expect(later?.beat).toBeCloseTo(here?.beat ?? 0, 6);
            }),
        );
    });

    it("says nothing about a score that states no metre", () => {
        expect(placeInBar([], 0)).toBeNull();
        expect(placeInBar([{ from: 4, beats: 4, beatType: 4 }], 0)).toBeNull();
        fc.assert(
            fc.property(arbWhole, (whole) => {
                // No downbeat to be on, so nothing is stressed — and the weight is a
                // full one rather than a guess.
                expect(metricalWeight([], whole)).toBe(1);
            }),
        );
    });
});

describe("how much loudness a note keeps", () => {
    it("stresses the downbeat most and the off-beat least", () => {
        fc.assert(
            fc.property(fc.constantFrom(...METRES), ([beats, beatType]) => {
                const bars: XmlBar[] = [{ from: 0, beats, beatType }];
                const at = (beat: number) => metricalWeight(bars, (beat / beatType) * 1);

                const downbeat = at(0);
                const offBeat = at(0.5);
                const onBeat = at(1);

                // That ordering is what a bar IS: flatten it and the metre stops
                // existing, whatever the time signature says.
                expect(downbeat).toBeGreaterThan(onBeat);
                expect(onBeat).toBeGreaterThan(offBeat);
                expect(downbeat).toBe(1);
            }),
        );
    });

    it("keeps every weight inside the page's ceiling and above a floor", () => {
        fc.assert(
            fc.property(arbBars, arbSlurs, arbWhole, (bars, slurs, whole) => {
                const weight = interpretedWeight(bars, slurs, whole);

                // The page sets the ceiling, and nothing may fall so far that a note
                // disappears under the one before it.
                expect(weight).toBeLessThanOrEqual(1);
                expect(weight).toBeGreaterThanOrEqual(0.7);
                expect(Number.isFinite(weight)).toBe(true);
                for (const part of [
                    metricalWeight(bars, whole),
                    phraseWeight(slurs, whole),
                    assumedPhraseWeight(bars, whole),
                ]) {
                    expect(part).toBeGreaterThan(0);
                    expect(part).toBeLessThanOrEqual(1);
                }
            }),
        );
    });

    it("lets a written arch taper, and invents none where the score drew none", () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 4, noNaN: true }),
                fc.double({ min: 0.5, max: 2, noNaN: true }),
                (from, length) => {
                    const span: SlurSpan = { from, to: from + length } as SlurSpan;

                    const arrives = phraseWeight([span], from);
                    const settles = phraseWeight([span], from + length);

                    // It arrives and it settles: ending a phrase where it began is the
                    // single most mechanical thing an unshaped playback does.
                    expect(arrives).toBeGreaterThan(settles);
                    expect(arrives).toBeCloseTo(1, 9);
                    // Outside every arch the score drew, nothing is shaped.
                    expect(phraseWeight([span], from + length + 1)).toBe(1);
                    expect(phraseWeight([], from)).toBe(1);
                },
            ),
        );
    });

    it("reads the same moment the same way twice", () => {
        fc.assert(
            fc.property(arbBars, arbSlurs, arbWhole, (bars, slurs, whole) => {
                expect(interpretedWeight(bars, slurs, whole)).toBe(
                    interpretedWeight(bars, slurs, whole),
                );
            }),
        );
    });
});
