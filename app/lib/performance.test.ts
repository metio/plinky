// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { performanceNotes, plotPerformance } from "./performance";
import type { RunNote } from "./shareCard";

// A note dead-on its target with no preceding mistakes.
function clean(over: Partial<RunNote> = {}): RunNote {
    return { targetMs: 0, playedMs: 0, wrongBefore: 0, ...over };
}

describe("performanceNotes", () => {
    it("marks a clean, on-time note as a fluent hit on the beat", () => {
        const [note] = performanceNotes([clean(), clean({ targetMs: 500, playedMs: 500 })]);
        expect(note).toMatchObject({ ordinal: 0, hit: true, fluent: true, rating: "perfect" });
    });

    it("flags a note with a wrong key before it as a miss", () => {
        const [note] = performanceNotes([clean({ wrongBefore: 2 }), clean({ targetMs: 500 })]);
        expect(note?.hit).toBe(false);
    });

    it("bands timing from the signed offset", () => {
        const notes = performanceNotes([
            clean(),
            clean({ targetMs: 500, playedMs: 600 }), // 100ms late → good
            clean({ targetMs: 1000, playedMs: 1300 }), // 300ms off
        ]);
        expect(notes[1]).toMatchObject({ deltaMs: 100, rating: "good" });
        expect(notes[2]?.rating).toBe("off");
    });

    it("flags a stall as not fluent", () => {
        // Steady 200ms gaps, then one note arrives a full second late: a hesitation.
        const notes = performanceNotes([
            clean({ targetMs: 0, playedMs: 0 }),
            clean({ targetMs: 200, playedMs: 200 }),
            clean({ targetMs: 400, playedMs: 400 }),
            clean({ targetMs: 600, playedMs: 1600 }),
        ]);
        expect(notes.at(-1)?.fluent).toBe(false);
    });
});

describe("plotPerformance", () => {
    const notes = performanceNotes([
        clean(),
        clean({ targetMs: 500, playedMs: 500 }),
        clean({ targetMs: 1000, playedMs: 1000 }),
    ]);

    it("spreads notes evenly across the width in play order", () => {
        const plotted = plotPerformance(notes, 100, 40);
        expect(plotted.map((note) => note.x)).toEqual([0, 50, 100]);
    });

    it("places an on-time note on the centre line", () => {
        expect(plotPerformance(notes, 100, 40)[0]?.y).toBe(20);
    });

    it("pushes late below and early above, clamped to the strip", () => {
        const late = plotPerformance(performanceNotes([clean({ playedMs: 5000 })]), 100, 40);
        const early = plotPerformance(
            performanceNotes([clean({ targetMs: 5000, playedMs: 0 })]),
            100,
            40,
        );
        expect(late[0]?.y).toBe(40); // late: bottom edge
        expect(early[0]?.y).toBe(0); // early: top edge
    });

    it("handles a single note without dividing by zero", () => {
        expect(plotPerformance(performanceNotes([clean()]), 100, 40)[0]?.x).toBe(0);
    });
});
