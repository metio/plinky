// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { ChordSpan } from "./harmony";
import { chordSetFor, summarizeChords } from "./pieceChords";

const span = (
    numeral: string,
    at: number,
    key = { tonic: 0, mode: "major" as const },
): ChordSpan => ({
    from: at,
    to: at + 1,
    root: 0,
    quality: "major",
    bass: 0,
    inversion: 0,
    numeral,
    key,
    confidence: 1,
});

const loop = (numerals: string[], times: number) =>
    Array.from({ length: times }, (_, round) =>
        numerals.map((numeral, at) => span(numeral, round * numerals.length + at)),
    ).flat();

describe("summarizeChords", () => {
    it("counts chord changes, commonest first, and finds the loop the piece returns to", () => {
        const summary = summarizeChords(loop(["I", "V", "vi", "IV"], 3));
        expect(summary?.vocabulary.map((one) => one.numeral)).toEqual(["I", "IV", "V", "vi"]);
        expect(summary?.vocabulary[0]?.count).toBe(3);
        expect(summary?.progression).toEqual(["I", "V", "vi", "IV"]);
    });

    it("counts a chord held over several beats once", () => {
        const summary = summarizeChords([span("I", 0), span("I", 1), span("V", 2), span("I", 3)]);
        expect(summary?.vocabulary).toEqual([
            { numeral: "I", count: 2 },
            { numeral: "V", count: 1 },
        ]);
        expect(summary?.progression).toBeNull();
    });

    it("points at the key's chord set and the ear level that covers the piece", () => {
        const summary = summarizeChords(loop(["I", "V7", "vi", "IV"], 2));
        expect(summary?.chordSet).toBe("chords-c-major");
        // V7 is V's chord: the pop four is level 1.
        expect(summary?.earLevel).toBe(1);
    });

    it("offers no ear drill for a minor piece, and its own minor chord set", () => {
        const minor = { tonic: 9, mode: "minor" as const };
        const summary = summarizeChords(
            loop(["i", "VI", "III", "VII"], 2).map((one) => ({ ...one, key: minor })),
        );
        expect(summary?.chordSet).toBe("chords-a-minor");
        expect(summary?.earLevel).toBeNull();
    });

    it("names the chord set for a flat key by its own spelling", () => {
        expect(chordSetFor({ tonic: 3, mode: "major" })).toBe("chords-eflat-major");
        expect(chordSetFor({ tonic: 6, mode: "major" })).toBe("chords-gflat-major");
    });

    it("has nothing to say about a piece with no chords read", () => {
        expect(summarizeChords([])).toBeNull();
    });
});
