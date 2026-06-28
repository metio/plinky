// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type PerfNote, performanceNotes, plotPerformance } from "./performance";
import { LENIENT_TOLERANCE } from "./rhythm";
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

    it("bands timing from the deviation against the player's own pace", () => {
        // A steady run (200ms gaps), bumped once by +100ms and once by +300ms; the
        // overall pace is removed, so only the bumped gaps read as off-time.
        const notes = performanceNotes([
            clean({ targetMs: 0, playedMs: 0 }),
            clean({ targetMs: 200, playedMs: 200 }),
            clean({ targetMs: 400, playedMs: 500 }), // gap 300 vs 200 → +100, good
            clean({ targetMs: 600, playedMs: 700 }),
            clean({ targetMs: 800, playedMs: 1200 }), // gap 500 vs 200 → +300, off
            clean({ targetMs: 1000, playedMs: 1400 }),
            clean({ targetMs: 1200, playedMs: 1600 }),
        ]);
        expect(notes[2]).toMatchObject({ deltaMs: 100, rating: "good" });
        expect(notes[4]?.rating).toBe("off");
    });

    it("reads a steady run at half the notated tempo as on the beat", () => {
        // Self-paced practice: an even slow run is in time, not chronically late.
        const notes = performanceNotes(
            Array.from({ length: 6 }, (_, i) => clean({ targetMs: i * 100, playedMs: i * 200 })),
        );
        for (const note of notes) {
            expect(note.rating).toBe("perfect");
        }
    });

    it("widens the timing windows for imprecise input", () => {
        // One gap stretched 250ms past the player's pace: off on a MIDI run, but
        // within the widened window for an on-screen / computer-keyboard run.
        const run = [
            clean({ targetMs: 0, playedMs: 0 }),
            clean({ targetMs: 100, playedMs: 100 }),
            clean({ targetMs: 200, playedMs: 450 }), // gap 350 vs 100 → +250
            clean({ targetMs: 300, playedMs: 550 }),
            clean({ targetMs: 400, playedMs: 650 }),
        ];
        expect(performanceNotes(run)[2]?.rating).toBe("off");
        expect(performanceNotes(run, LENIENT_TOLERANCE)[2]?.rating).toBe("good");
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
        const note = (deltaMs: number): PerfNote => ({
            ordinal: 0,
            deltaMs,
            rating: "off",
            hit: true,
            fluent: true,
        });
        expect(plotPerformance([note(5000)], 100, 40)[0]?.y).toBe(40); // late: bottom edge
        expect(plotPerformance([note(-5000)], 100, 40)[0]?.y).toBe(0); // early: top edge
    });

    it("handles a single note without dividing by zero", () => {
        expect(plotPerformance(performanceNotes([clean()]), 100, 40)[0]?.x).toBe(0);
    });
});
