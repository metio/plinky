// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { cleanBeatsPerBar, COMPOSE_METERS, MAX_BEATS_PER_BAR, meterChoices } from "./meter";

describe("meterChoices", () => {
    it("offers the usual meters alone when the take is in one of them", () => {
        for (const meter of COMPOSE_METERS) {
            expect(meterChoices(meter)).toEqual([2, 3, 4, 6]);
        }
    });

    it("lists a loaded meter among them, in order", () => {
        expect(meterChoices(5)).toEqual([2, 3, 4, 5, 6]);
        expect(meterChoices(12)).toEqual([2, 3, 4, 6, 12]);
        expect(meterChoices(1)).toEqual([1, 2, 3, 4, 6]);
    });

    it("keeps the meter a take was loaded in on offer after another is picked", () => {
        expect(meterChoices(2, 5)).toEqual([2, 3, 4, 5, 6]);
        expect(meterChoices(7, 5)).toEqual([2, 3, 4, 5, 6, 7]);
    });

    it("lists a loaded meter once, whether or not the take is still in it", () => {
        expect(meterChoices(5, 5)).toEqual([2, 3, 4, 5, 6]);
        expect(meterChoices(3, 4)).toEqual([2, 3, 4, 6]);
    });

    it("always holds the take's meter, its loaded one and every usual one, each once, ascending", () => {
        const meter = fc.integer({ min: 1, max: MAX_BEATS_PER_BAR });
        fc.assert(
            fc.property(meter, fc.option(meter, { nil: undefined }), (current, loaded) => {
                const choices = meterChoices(current, loaded);
                expect(choices).toContain(current);
                if (loaded !== undefined) {
                    expect(choices).toContain(loaded);
                }
                for (const usual of COMPOSE_METERS) {
                    expect(choices).toContain(usual);
                }
                expect(new Set(choices).size).toBe(choices.length);
                expect([...choices].sort((a, b) => a - b)).toEqual(choices);
            }),
        );
    });
});

describe("cleanBeatsPerBar", () => {
    it("keeps a meter the notation can spell", () => {
        expect(cleanBeatsPerBar(3)).toBe(3);
        expect(cleanBeatsPerBar(4)).toBe(4);
        expect(cleanBeatsPerBar(7)).toBe(7);
        expect(cleanBeatsPerBar(1)).toBe(1);
        expect(cleanBeatsPerBar(MAX_BEATS_PER_BAR)).toBe(MAX_BEATS_PER_BAR);
    });

    it.each([
        ["a fraction smaller than one beat", 0.05],
        ["zero", 0],
        ["a negative count", -3],
        ["NaN", Number.NaN],
        ["Infinity", Number.POSITIVE_INFINITY],
        ["more beats than a bar holds", MAX_BEATS_PER_BAR + 1],
        ["a numeric string", "3"],
        ["nothing at all", undefined],
    ])("falls back for %s", (_case, value) => {
        expect(cleanBeatsPerBar(value)).toBe(4);
    });

    it("takes the caller's own fallback", () => {
        expect(cleanBeatsPerBar(0.05, 3)).toBe(3);
    });

    it("rounds a near-whole meter rather than refusing it", () => {
        expect(cleanBeatsPerBar(3.999999)).toBe(4);
    });
});
