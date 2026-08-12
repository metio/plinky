// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LENIENT_TOLERANCE, PRECISE_TOLERANCE } from "./rhythm";
import { parseGrade } from "./grade";
import { captureCleared, captureRelease, startCapture } from "./runCapture";
import { type OutcomeNote, deriveRunOutcome, tempoScale } from "./runOutcome";

// A run note played exactly on its notated onset (perfect timing), on the treble staff,
// with a mid-range velocity — the building block a test tweaks one field of.
const onNote = (ms: number, velocity = 80): OutcomeNote => ({
    targetMs: ms,
    playedMs: ms,
    wrongBefore: 0,
    staves: [0],
    velocity,
});

describe("deriveRunOutcome", () => {
    it("grades a clean, perfectly-timed run as flawless", () => {
        const notes = [onNote(0), onNote(500), onNote(1000)];
        const outcome = deriveRunOutcome({
            notes,
            correct: 3,
            wrong: 0,
            imprecise: false,
            intendedTempo: 120,
            runTempo: 120,
        });
        expect(outcome.grade.accuracy).toBe(100);
        expect(outcome.grade.timing).toBe(100);
        expect(outcome.grid).not.toBeNull();
    });

    it("widens the timing tolerance for imprecise input", () => {
        const notes = [onNote(0), onNote(500)];
        const precise = deriveRunOutcome({
            notes,
            correct: 2,
            wrong: 0,
            imprecise: false,
            intendedTempo: 100,
            runTempo: 100,
        });
        const lenient = deriveRunOutcome({
            notes,
            correct: 2,
            wrong: 0,
            imprecise: true,
            intendedTempo: 100,
            runTempo: 100,
        });
        expect(precise.tolerance).toBe(PRECISE_TOLERANCE);
        expect(lenient.tolerance).toBe(LENIENT_TOLERANCE);
    });

    it("grades without dynamics when every note shares one velocity", () => {
        const flat = deriveRunOutcome({
            notes: [onNote(0, 64), onNote(400, 64)],
            correct: 2,
            wrong: 0,
            imprecise: false,
            intendedTempo: 100,
            runTempo: 100,
        });
        const varied = deriveRunOutcome({
            notes: [onNote(0, 40), onNote(400, 100)],
            correct: 2,
            wrong: 0,
            imprecise: false,
            intendedTempo: 100,
            runTempo: 100,
        });
        expect(flat.grade.dynamics).toBeNull();
        expect(varied.grade.dynamics).not.toBeNull();
    });

    it("plots no tempo curve for a single note", () => {
        const outcome = deriveRunOutcome({
            notes: [onNote(0)],
            correct: 1,
            wrong: 0,
            imprecise: false,
            intendedTempo: 100,
            runTempo: 100,
        });
        expect(outcome.tempoCurve).toBeNull();
    });

    it("plots a tempo curve once there are gaps to read a pace from", () => {
        const outcome = deriveRunOutcome({
            notes: [onNote(0), onNote(500), onNote(1000)],
            correct: 3,
            wrong: 0,
            imprecise: false,
            intendedTempo: 120,
            runTempo: 120,
        });
        expect(outcome.tempoCurve?.points.length).toBeGreaterThan(0);
    });
});

// A run note as a running sum of non-negative gaps, so onsets ascend the way a real run's
// do, with an independent played onset and velocity per note.
const runArb = fc
    .array(
        fc.record({
            gap: fc.nat({ max: 1000 }),
            drift: fc.integer({ min: -200, max: 200 }),
            velocity: fc.integer({ min: 1, max: 127 }),
        }),
        { maxLength: 60 },
    )
    .map((steps) => {
        let target = 0;
        return steps.map(({ gap, drift, velocity }) => {
            target += gap;
            return { targetMs: target, playedMs: Math.max(0, target + drift), velocity } as OutcomeNote;
        });
    });

describe("deriveRunOutcome properties", () => {
    it("always returns a valid grade and a tolerance of one of the two windows", () => {
        fc.assert(
            fc.property(runArb, fc.boolean(), (notes, imprecise) => {
                const outcome = deriveRunOutcome({
                    notes,
                    correct: notes.length,
                    wrong: 0,
                    imprecise,
                    intendedTempo: 100,
                    runTempo: 100,
                });
                return (
                    parseGrade(outcome.grade) !== null &&
                    (outcome.tolerance === PRECISE_TOLERANCE ||
                        outcome.tolerance === LENIENT_TOLERANCE)
                );
            }),
        );
    });

    it("is pure — the same run derives the same outcome", () => {
        fc.assert(
            fc.property(runArb, (notes) => {
                const input = {
                    notes,
                    correct: notes.length,
                    wrong: 0,
                    imprecise: false,
                    intendedTempo: 90,
                    runTempo: 110,
                };
                expect(deriveRunOutcome(input)).toEqual(deriveRunOutcome(input));
            }),
        );
    });
});

describe("tempoScale", () => {
    it("reads 1 at the piece's own tempo", () => {
        expect(tempoScale(100, 100)).toBe(1);
    });

    it("reads below 1 for a run played slower than the piece", () => {
        // Speed is scored against this, so a careful crawl cannot pass as at-tempo.
        expect(tempoScale(50, 100)).toBe(0.5);
    });

    it("reads above 1 for a run played faster", () => {
        expect(tempoScale(120, 100)).toBe(1.2);
    });

    it("falls back to 1 when the piece names no tempo of its own", () => {
        // Nothing to be measured against, so the run is taken at face value rather
        // than divided by zero.
        expect(tempoScale(100, 0)).toBe(1);
        expect(tempoScale(100, -20)).toBe(1);
    });

    it("is the same number the grade's own grid is built with", () => {
        // Three readers derive this — the share grid inside deriveRunOutcome, the
        // results panel, and the sections a run is scored into — and they have to
        // agree, so they share one definition rather than three copies of a ternary.
        const outcome = deriveRunOutcome({
            notes: [
                { targetMs: 0, playedMs: 0, wrongBefore: 0, velocity: 80 },
                { targetMs: 500, playedMs: 500, wrongBefore: 0, velocity: 80 },
            ],
            correct: 2,
            wrong: 0,
            imprecise: false,
            intendedTempo: 100,
            runTempo: 50,
        });
        const halfSpeed = deriveRunOutcome({
            notes: [
                { targetMs: 0, playedMs: 0, wrongBefore: 0, velocity: 80 },
                { targetMs: 500, playedMs: 500, wrongBefore: 0, velocity: 80 },
            ],
            correct: 2,
            wrong: 0,
            imprecise: false,
            intendedTempo: 100,
            runTempo: 100,
        });
        expect(tempoScale(50, 100)).toBe(0.5);
        // The slower run's grid is scored on the lower scale, so it cannot match.
        expect(JSON.stringify(outcome.grid)).not.toBe(JSON.stringify(halfSpeed.grid));
    });
});

describe("expression across a chord", () => {
    it("judges every key of a position, not just one of them", () => {
        // Two keys struck together, one asked for twice the loudness and a quarter of the
        // hold of the other. Reading the position as a single note would score one of
        // them and silently drop the other.
        const capture = startCapture();
        captureCleared(capture, {
            pitches: [60, 64],
            ordinal: 0,
            timestamp: 0,
            timeMs: 0,
            velocity: 60,
            velocities: [40, 90],
            wrongBefore: 0,
            staves: [0],
            expectedVelocities: [40, 90],
            expectedHoldsMs: [1000, 250],
        });
        const note = capture.notes[0];
        expect(note?.expectedVelocities).toEqual([40, 90]);
        expect(note?.velocities).toEqual([40, 90]);
        // A key released on its own records against that key, not against the chord.
        captureRelease(capture, 64, 250);
        captureRelease(capture, 60, 1000);
        expect(note?.keyHoldsMs).toEqual([1000, 250]);
        // …while the position-level figure stays the longest, which is what a replay needs.
        expect(note?.keyHeldMs).toBe(1000);
    });
});
