// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    deriveRunOutcome,
    expressionNotes,
    type OutcomeNote,
    type RunInput,
    tempoScale,
} from "./runOutcome";

// Everything a finished run shows and records, derived from the notes that were played.
// It is the one reading a player is given of their own playing, so the laws are the ones
// that keep it honest rather than flattering: a careful crawl must not read as an
// at-tempo performance, a skipped position must not be counted twice, and the same run
// must grade the same however it is replayed.

const arbNote = (at: number): fc.Arbitrary<OutcomeNote> =>
    fc
        .record({
            drift: fc.integer({ min: -400, max: 400 }),
            velocity: fc.integer({ min: 1, max: 127 }),
            skipped: fc.boolean(),
            wrongBefore: fc.integer({ min: 0, max: 2 }),
            staff: fc.constantFrom(1, 2),
        })
        .map(({ drift, velocity, skipped, wrongBefore, staff }) => {
            const targetMs = at * 500;
            const note: OutcomeNote = {
                targetMs,
                playedMs: targetMs + drift,
                wrongBefore,
                velocity,
                pitches: [60 + (at % 12)],
                staves: [staff],
                ...(skipped ? { skipped: true } : {}),
            } as OutcomeNote;
            return note;
        });

const arbNotes = fc
    .integer({ min: 0, max: 14 })
    .chain((count) => fc.tuple(...Array.from({ length: count }, (_, at) => arbNote(at))))
    .map((notes) => notes as OutcomeNote[]);

const arbInput: fc.Arbitrary<RunInput> = fc
    .record({
        notes: arbNotes,
        wrong: fc.integer({ min: 0, max: 6 }),
        imprecise: fc.boolean(),
        intendedTempo: fc.constantFrom(0, 60, 90, 120),
        runTempo: fc.integer({ min: 30, max: 200 }),
    })
    .map((input) => ({
        ...input,
        correct: input.notes.filter((note) => !note.skipped).length,
    }));

describe("how a run's pace is referenced to the piece's", () => {
    it("reads one at the intended tempo, and below it when slower", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 20, max: 240 }),
                fc.integer({ min: 20, max: 240 }),
                (runTempo, intendedTempo) => {
                    const scale = tempoScale(runTempo, intendedTempo);

                    expect(scale).toBeGreaterThan(0);
                    expect(scale < 1).toBe(runTempo < intendedTempo);
                    // Speed is scored against this, so a careful crawl cannot read as an
                    // at-tempo performance.
                    expect(scale).toBeCloseTo(runTempo / intendedTempo, 9);
                },
            ),
        );
    });

    it("falls back to one for a piece with no tempo of its own", () => {
        fc.assert(
            fc.property(fc.integer({ min: 20, max: 240 }), (runTempo) => {
                // Three readers have to agree on this figure; the fallback is the one
                // case where they could quietly disagree.
                expect(tempoScale(runTempo, 0)).toBe(1);
                expect(tempoScale(runTempo, -1)).toBe(1);
            }),
        );
    });
});

describe("the reading a player is given of their own run", () => {
    it("derives the same outcome from the same run", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                // Pure, so a result re-opened later is the result that was earned.
                expect(deriveRunOutcome(input)).toEqual(deriveRunOutcome(input));
            }),
        );
    });

    it("grades inside the scale it claims to use", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const { grade, tolerance, grid } = deriveRunOutcome(input);

                expect(grade.score).toBeGreaterThanOrEqual(0);
                expect(grade.score).toBeLessThanOrEqual(100);
                expect(typeof grade.letter).toBe("string");
                expect(grade.letter).not.toBe("");
                // The strip, the grade and the share grid must read one set of windows.
                expect(tolerance).toBeGreaterThan(0);
                for (const row of grid) {
                    for (const band of row) {
                        expect(["best", "good", "ok", "weak", "none"]).toContain(band);
                    }
                }
            }),
        );
    });

    it("widens the windows for input that cannot tap a rhythm", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const precise = deriveRunOutcome({ ...input, imprecise: false });
                const lenient = deriveRunOutcome({ ...input, imprecise: true });

                // A touch player is the primary input and must not be floored at zero
                // for an instrument that cannot tap.
                expect(lenient.tolerance).toBeGreaterThan(precise.tolerance);
            }),
        );
    });

    it("plots a curve only where there is a pace to plot", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const { tempoCurve } = deriveRunOutcome(input);
                if (tempoCurve === null) {
                    return;
                }

                expect(tempoCurve.points.length).toBeGreaterThan(0);
                expect(tempoCurve.median).toBeGreaterThan(0);
                for (const point of tempoCurve.points) {
                    expect(point.bpm).toBeGreaterThan(0);
                    expect(Number.isFinite(point.bpm)).toBe(true);
                    // A point is the note a gap leads INTO, so the first note has none.
                    expect(point.index).toBeGreaterThanOrEqual(1);
                }
                for (const hotspot of tempoCurve.hotspots) {
                    // A hotspot names a passage, so it has to span one.
                    expect(hotspot.endIndex).toBeGreaterThanOrEqual(hotspot.startIndex);
                }
            }),
        );
    });

    it("takes no timing from a position that was never struck", () => {
        // Uneven on purpose. Timing is scored on the GAP leading into each note, against
        // the run's own pace — so a run played uniformly late is perfectly steady, every
        // sample reads perfect, and a wrongly-counted skip would have nothing to change.
        // These gaps (500, 700, 100, 900, 100) are ragged enough that an extra sample
        // scored as on time lifts the figure, which is what makes the law bite.
        const PLAYED = [0, 500, 1200, 1300, 2200, 2300];
        const note = (at: number, skipped = false) =>
            ({
                targetMs: at * 500,
                playedMs: PLAYED[at] ?? 0,
                wrongBefore: 0,
                velocity: 80,
                pitches: [60],
                staves: [1],
                ...(skipped ? { skipped: true } : {}),
            }) as OutcomeNote;
        const timingOf = (notes: OutcomeNote[], correct: number) =>
            deriveRunOutcome({
                notes,
                correct,
                wrong: 0,
                imprecise: false,
                intendedTempo: 120,
                runTempo: 120,
            }).grade.timing;

        const withSkip = [note(0), note(1), note(2), note(3, true), note(4), note(5)];
        const withoutIt = [note(0), note(1), note(2), note(4), note(5)];
        const allStruck = [0, 1, 2, 3, 4, 5].map((at) => note(at));

        // A skipped position is no timing sample: the reading is the same as if the
        // position were not in the run at all. Counted as on time it would flatter the
        // very run it was skipped in, having already been counted as a miss.
        expect(timingOf(withSkip, 5)).toBe(timingOf(withoutIt, 5));
        // And it is not punished twice either: the sample it would have been is simply
        // absent, so a run with a skip reads better here than one that struck it badly.
        expect(timingOf(withSkip, 5)).toBeGreaterThan(timingOf(allStruck, 6));
    });
});

describe("the expressive reading, key by key", () => {
    it("reports one entry per key struck, or one for the position", () => {
        fc.assert(
            fc.property(arbNotes, (notes) => {
                const entries = expressionNotes(notes);

                // A chord is several instructions played at once; a position with no
                // per-pitch record contributes once, which is what there is to say.
                expect(entries.length).toBeGreaterThanOrEqual(0);
                for (const entry of entries) {
                    expect(entry.velocity).toBeGreaterThanOrEqual(0);
                }
                expect(expressionNotes([])).toEqual([]);
            }),
        );
    });
});
