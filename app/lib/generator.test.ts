// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { generatePhrase } from "./generator";

// rng always 0 picks the first scale degree, so the phrase is deterministic.
const zero = () => 0;

describe("generatePhrase", () => {
    it("generates a single treble line with bar lines", () => {
        const abc = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, zero);
        expect(abc).toContain("M:4/4");
        expect(abc).toContain("c c c c | c c c c |");
        expect(abc).not.toContain("V:2");
    });

    it("uses the requested key's signature and scale", () => {
        const abc = generatePhrase({ bars: 1, beatsPerBar: 2, twoHands: false, key: "G" }, zero);
        expect(abc).toContain("K:G");
        // G major's five-finger position starts on G.
        expect(abc).toContain("G G |");
    });

    it("generates two voices for two-hand play", () => {
        const abc = generatePhrase({ bars: 1, beatsPerBar: 3, twoHands: true }, zero);
        expect(abc).toContain("V:1 clef=treble");
        expect(abc).toContain("V:2 clef=bass");
        expect(abc).toContain("c c c |"); // treble
        expect(abc).toContain("C C C |"); // bass
    });

    it("stays within the C–G five-finger range", () => {
        // rng 0.99 selects the last degree of the five-finger position (G / g).
        const abc = generatePhrase({ bars: 1, beatsPerBar: 2, twoHands: false }, () => 0.99);
        expect(abc).toContain("g g |");
    });

    it("falls back to C major for an unknown key", () => {
        const abc = generatePhrase(
            { bars: 1, beatsPerBar: 2, twoHands: false, key: "Z" as never },
            () => 0,
        );
        expect(abc).toContain("K:C");
    });
});
