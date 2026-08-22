// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { contourWeights, voicingWeight } from "./contour";

describe("voicingWeight", () => {
    it("plays the top of the texture as written and the rest under it", () => {
        // The top is the tune. Played at one level a four-part texture is a block, and the
        // melody a listener is following is buried in the middle of it.
        const chord = [48, 60, 64, 72];
        expect(voicingWeight(chord, 72)).toBe(1);
        expect(voicingWeight(chord, 64)).toBeLessThan(1);
        expect(voicingWeight(chord, 60)).toBeLessThan(1);
    });

    it("keeps the bass under the melody but above the inner voices", () => {
        // The bass is the harmonic floor: a texture with no bottom sounds thin, where an
        // inner voice pushing through sounds muddled.
        const chord = [48, 60, 64, 72];
        expect(voicingWeight(chord, 48)).toBeGreaterThan(voicingWeight(chord, 60));
        expect(voicingWeight(chord, 48)).toBeLessThan(1);
    });

    it("leaves a single note alone", () => {
        // Nothing to be voiced against.
        expect(voicingWeight([60], 60)).toBe(1);
        expect(voicingWeight([], 60)).toBe(1);
    });

    it("never plays a note louder than the page asked for", () => {
        // The shaping reduces and never lifts, so it can never contradict a written
        // dynamic — the same rule the bar and phrase weighting keeps.
        for (const pitch of [48, 60, 64, 72]) {
            expect(voicingWeight([48, 60, 64, 72], pitch)).toBeLessThanOrEqual(1);
        }
    });

    it("voices a two-note texture as melody and bass", () => {
        expect(voicingWeight([48, 72], 72)).toBe(1);
        expect(voicingWeight([48, 72], 48)).toBeLessThan(1);
    });
});

describe("contourWeights", () => {
    it("leans into the top of a rising line", () => {
        // A line that rises is going somewhere. Played flat, an arch of quavers is a list
        // of pitches rather than a phrase with a destination.
        const line = [60, 62, 64, 65, 67, 69, 71, 72];
        const weights = contourWeights(line);
        expect(weights.at(-1)).toBeGreaterThan(weights[0] as number);
    });

    it("comes back down as the line does", () => {
        const line = [60, 64, 67, 72, 67, 64, 60];
        const weights = contourWeights(line);
        const peak = weights[3] as number;
        expect(peak).toBeGreaterThan(weights[0] as number);
        expect(peak).toBeGreaterThan(weights.at(-1) as number);
    });

    it("shapes by where a note sits AROUND it, not across the whole piece", () => {
        // Otherwise a piece with one high note late in it plays everything before that note
        // at the bottom of its range — one slope, not a series of phrases.
        const line = [...Array.from({ length: 40 }, () => 60), 96];
        const weights = contourWeights(line);
        expect(weights[0]).toBeCloseTo(weights[20] as number);
    });

    it("does not shape a line that goes nowhere", () => {
        // A repeated note or a pedal point has no shape, and inventing a swell over one
        // would be shaping the absence of a line.
        expect(contourWeights([60, 60, 60, 60]).every((weight) => weight === 1)).toBe(true);
    });

    it("treats a rest as a hole in the line, not a note at the bottom of it", () => {
        // At pitch zero every note after a rest would be a peak.
        const weights = contourWeights([60, null, 62, 64]);
        expect(weights[1]).toBe(1);
        expect(weights[2]).toBeLessThanOrEqual(1);
        expect(weights[3]).toBeGreaterThan(weights[0] as number);
    });

    it("never plays a note louder than the page asked for", () => {
        const weights = contourWeights([60, 64, 67, 72, 67, 64, 60]);
        expect(Math.max(...weights)).toBeLessThanOrEqual(1);
    });

    it("stays a suggestion rather than an announcement", () => {
        const weights = contourWeights([60, 64, 67, 72, 76, 79]);
        const swing = Math.max(...weights) - Math.min(...weights);
        expect(swing).toBeGreaterThan(0.02);
        expect(swing).toBeLessThan(0.15);
    });

    it("has an answer for an empty line", () => {
        expect(contourWeights([])).toEqual([]);
        expect(contourWeights([null, null])).toEqual([1, 1]);
    });
});
