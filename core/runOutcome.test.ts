// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LENIENT_TOLERANCE, PRECISE_TOLERANCE } from "./rhythm";
import { parseGrade } from "./grade";
import { type OutcomeNote, deriveRunOutcome } from "./runOutcome";

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
