// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { computeFlow, type FlowNote } from "./flow";

// A run of n evenly-spaced notes played dead in time with no wrong notes.
function steady(n: number): FlowNote[] {
    return Array.from({ length: n }, (_, i) => ({
        targetMs: i * 500,
        playedMs: i * 500,
        wrongBefore: 0,
    }));
}

describe("computeFlow", () => {
    it("is 100 for an empty run", () => {
        expect(computeFlow([])).toBe(100);
    });

    it("is 100 for a clean, steady run", () => {
        expect(computeFlow(steady(8))).toBe(100);
    });

    it("docks one note per stumble rather than collapsing", () => {
        // One fumble in ten notes is still a smooth performance.
        const notes = steady(10);
        notes[5] = { ...notes[5], targetMs: 2500, playedMs: 2500, wrongBefore: 1 };
        expect(computeFlow(notes)).toBe(90);
    });

    it("is 0 when every note was a struggle", () => {
        const notes = steady(4).map((note) => ({ ...note, wrongBefore: 1 }));
        expect(computeFlow(notes)).toBe(0);
    });

    it("flags a note reached after a disproportionate pause", () => {
        // Five notes in time, but the fourth arrives 3000ms after the third when
        // the rhythm called for 500ms — a stop to hunt for the key.
        const notes: FlowNote[] = [
            { targetMs: 0, playedMs: 0, wrongBefore: 0 },
            { targetMs: 500, playedMs: 500, wrongBefore: 0 },
            { targetMs: 1000, playedMs: 1000, wrongBefore: 0 },
            { targetMs: 1500, playedMs: 4000, wrongBefore: 0 },
            { targetMs: 2000, playedMs: 4500, wrongBefore: 0 },
            { targetMs: 2500, playedMs: 5000, wrongBefore: 0 },
        ];
        expect(computeFlow(notes)).toBeCloseTo((5 / 6) * 100);
    });

    it("does not punish a uniformly slower tempo", () => {
        // Every gap is twice the notated one, but evenly — steady, not stalling.
        const notes = steady(6).map((note, i) => ({ ...note, playedMs: i * 1000 }));
        expect(computeFlow(notes)).toBe(100);
    });

    it("falls back to first-try cleanliness when there is no rhythm to compare", () => {
        // Every note shares an onset (no usable gaps), so only wrong notes break flow.
        const notes: FlowNote[] = [
            { targetMs: 0, playedMs: 0, wrongBefore: 0 },
            { targetMs: 0, playedMs: 0, wrongBefore: 1 },
        ];
        expect(computeFlow(notes)).toBe(50);
    });

    it("does not mistake an intentionally long note for a stall", () => {
        // The third note is a long note (a 2000ms notated gap), played in time.
        const notes: FlowNote[] = [
            { targetMs: 0, playedMs: 0, wrongBefore: 0 },
            { targetMs: 500, playedMs: 500, wrongBefore: 0 },
            { targetMs: 2500, playedMs: 2500, wrongBefore: 0 },
        ];
        expect(computeFlow(notes)).toBe(100);
    });
});
