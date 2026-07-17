// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type IntervalDirection,
    generateInterval,
    generatePerfectPitch,
    INTERVAL_LEVELS,
    isCorrect,
    scoreRounds,
} from "./earExercise";
import {
    INTERVAL_IDS,
    NATURAL_PITCH_CLASSES,
    noteNameOf,
    pitchClassOf,
    semitonesOf,
} from "./theory";

// The generators take an rng, so a fast-check float stream drives them exactly as
// Math.random would — every question in these properties is one a player could be asked.
const rngOf = (values: number[]): (() => number) => {
    let index = 0;
    return () => values[index++ % values.length] ?? 0;
};

const rolls = fc.array(fc.double({ min: 0, max: 0.999, noNaN: true }), {
    minLength: 1,
    maxLength: 12,
});

const levels = fc.integer({ min: 0, max: INTERVAL_LEVELS.length - 1 });
const directions = fc.constantFrom<IntervalDirection>("ascending", "descending", "harmonic");

describe("interval question properties", () => {
    it("sounds two notes exactly the answer's distance apart", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    {
                        intervals: INTERVAL_LEVELS[level]!,
                        direction,
                        lowest: 55,
                        highest: 79,
                    },
                    rngOf(values),
                );
                const [first, second] = question.notes;
                expect(Math.abs(second!.note - first!.note)).toBe(semitonesOf(question.answer));
            }),
        );
    });

    it("keeps both notes inside the configured range", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    { intervals: INTERVAL_LEVELS[level]!, direction, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                for (const note of question.notes) {
                    expect(note.note).toBeGreaterThanOrEqual(55);
                    expect(note.note).toBeLessThanOrEqual(79);
                }
            }),
        );
    });

    it("always offers the answer among the choices", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    { intervals: INTERVAL_LEVELS[level]!, direction, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                expect(question.choices).toContain(question.answer);
                expect(isCorrect(question, question.answer)).toBe(true);
            }),
        );
    });

    it("sounds the notes together only when they are heard as a chord", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    { intervals: INTERVAL_LEVELS[level]!, direction, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                const [first, second] = question.notes;
                const together = first!.at === second!.at;
                expect(together).toBe(direction === "harmonic");
            }),
        );
    });

    it("descends only when asked to", () => {
        fc.assert(
            fc.property(rolls, levels, (values, level) => {
                const question = generateInterval(
                    {
                        intervals: INTERVAL_LEVELS[level]!,
                        direction: "descending",
                        lowest: 55,
                        highest: 79,
                    },
                    rngOf(values),
                );
                const [first, second] = question.notes;
                expect(second!.note).toBeLessThanOrEqual(first!.note);
            }),
        );
    });
});

describe("perfect-pitch question properties", () => {
    it("names the note it sounds", () => {
        fc.assert(
            fc.property(rolls, fc.boolean(), (values, naturalsOnly) => {
                const question = generatePerfectPitch(
                    { naturalsOnly, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                const [note] = question.notes;
                expect(question.choices).toContain(question.answer);
                // The answer names the pitch class that actually sounded, whatever
                // octave it landed in — the exercise asks for the note, not the register.
                expect(question.answer).toBe(noteNameOf(pitchClassOf(note!.note)));
                expect(question.notes).toHaveLength(1);
            }),
        );
    });

    it("stays on the white keys when asked to", () => {
        fc.assert(
            fc.property(rolls, (values) => {
                const question = generatePerfectPitch(
                    { naturalsOnly: true, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                const [note] = question.notes;
                expect(NATURAL_PITCH_CLASSES).toContain(pitchClassOf(note!.note));
                expect(question.choices).toHaveLength(NATURAL_PITCH_CLASSES.length);
            }),
        );
    });

    it("offers all twelve notes once the black keys are in", () => {
        fc.assert(
            fc.property(rolls, (values) => {
                const question = generatePerfectPitch(
                    { naturalsOnly: false, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                expect(question.choices).toHaveLength(12);
            }),
        );
    });
});

describe("difficulty ladder properties", () => {
    it("never takes an interval away as the levels climb", () => {
        for (let level = 1; level < INTERVAL_LEVELS.length; level++) {
            for (const interval of INTERVAL_LEVELS[level - 1]!) {
                expect(INTERVAL_LEVELS[level]).toContain(interval);
            }
        }
    });

    it("offers only real intervals at every level", () => {
        for (const level of INTERVAL_LEVELS) {
            for (const interval of level) {
                expect(INTERVAL_IDS).toContain(interval);
            }
        }
    });
});

describe("scoreRounds properties", () => {
    it("keeps accuracy between none and all of them", () => {
        fc.assert(
            fc.property(fc.array(fc.boolean(), { maxLength: 50 }), (results) => {
                const score = scoreRounds(
                    results.map((correct) => ({ answer: "a", given: correct ? "a" : "b", correct })),
                );
                expect(score.accuracy).toBeGreaterThanOrEqual(0);
                expect(score.accuracy).toBeLessThanOrEqual(1);
                expect(score.asked).toBe(results.length);
                expect(score.correct).toBe(results.filter(Boolean).length);
            }),
        );
    });

    it("reads an empty session as nothing asked rather than a divide by zero", () => {
        expect(scoreRounds([])).toEqual({ asked: 0, correct: 0, accuracy: 0 });
    });
});
