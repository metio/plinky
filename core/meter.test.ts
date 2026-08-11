// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { cleanBeatsPerBar, MAX_BEATS_PER_BAR } from "./meter";

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
