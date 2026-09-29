// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    computeGrade,
    type GradeInput,
    type Letter,
    letterFor,
    parseGrade,
    scoreKeepUp,
    scoreReadings,
} from "./grade";

// What a run earns. The letter is on the share card and in the milestones, so the laws
// worth pinning are the ones a player would argue with: playing better never earns a
// worse letter, a shown hundred means a hundred, and a stored grade that is nonsense
// reads as no grade rather than as a good one.

const LETTERS: Letter[] = ["F", "E", "D", "C", "B", "A", "S"];
const rank = (letter: Letter) => LETTERS.indexOf(letter);

const arbRhythm = fc
    .tuple(fc.nat({ max: 50 }), fc.nat({ max: 50 }), fc.nat({ max: 50 }), fc.nat({ max: 200 }))
    .map(([perfect, good, off, averageAbsMs]) => ({
        perfect,
        good,
        off,
        total: perfect + good + off,
        averageAbsMs,
    }));

const arbInput: fc.Arbitrary<GradeInput> = fc
    .tuple(fc.nat({ max: 200 }), fc.nat({ max: 50 }), arbRhythm, fc.integer({ min: 0, max: 100 }))
    .map(([correct, wrong, rhythm, flow]) => ({
        correct,
        wrong,
        rhythm,
        flow,
        dynamics: null,
        expression: null,
    }));

describe("grade, over runs a player might have played", () => {
    it("never gives a worse letter for a better score", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -50, max: 150 }),
                fc.integer({ min: -50, max: 150 }),
                (first, second) => {
                    const [low, high] = first <= second ? [first, second] : [second, first];

                    expect(rank(letterFor(high))).toBeGreaterThanOrEqual(rank(letterFor(low)));
                },
            ),
        );
    });

    it("reads every dimension as a percentage, and the letter from the score", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const grade = computeGrade(input);

                for (const value of [grade.accuracy, grade.timing, grade.flow, grade.score]) {
                    expect(value).toBeGreaterThanOrEqual(0);
                    expect(value).toBeLessThanOrEqual(100);
                    expect(Number.isInteger(value)).toBe(true);
                }
                expect(grade.letter).toBe(letterFor(grade.score));
            }),
        );
    });

    it("shows a hundred only for a run with nothing wrong in it", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const grade = computeGrade(input);

                if (grade.accuracy === 100) {
                    expect(input.wrong).toBe(0);
                }
                if (input.wrong > 0 && input.correct > 0) {
                    // Short of perfect stops at ninety-nine, so the flawless milestone
                    // cannot read a rounded hundred as a clean run.
                    expect(grade.accuracy).toBeLessThanOrEqual(99);
                }
            }),
        );
    });

    it("does not round a single wrong key away", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 199, max: 600 }),
                arbRhythm,
                fc.integer({ min: 0, max: 100 }),
                (correct, rhythm, flow) => {
                    // Two hundred right and one wrong is 99.5%, which plain rounding shows
                    // as a hundred — and the flawless milestone reads the shown figure.
                    const grade = computeGrade({
                        correct,
                        wrong: 1,
                        rhythm,
                        flow,
                        dynamics: null,
                        expression: null,
                    });

                    expect(grade.accuracy).toBeLessThanOrEqual(99);
                },
            ),
        );
    });

    it("earns more for playing more of the notes right", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                fc.nat({ max: 40 }),
                fc.nat({ max: 40 }),
                arbRhythm,
                fc.integer({ min: 0, max: 100 }),
                (correct, fewer, more, rhythm, flow) => {
                    const of = (wrong: number) =>
                        computeGrade({
                            correct,
                            wrong,
                            rhythm,
                            flow,
                            dynamics: null,
                            expression: null,
                        });
                    const [lowWrong, highWrong] = fewer <= more ? [fewer, more] : [more, fewer];

                    // The same playing with fewer wrong keys cannot score less.
                    expect(of(lowWrong).score).toBeGreaterThanOrEqual(of(highWrong).score);
                    expect(rank(of(lowWrong).letter)).toBeGreaterThanOrEqual(
                        rank(of(highWrong).letter),
                    );
                },
            ),
        );
    });

    it("gives a run with nothing played an F and no false credit", () => {
        fc.assert(
            fc.property(arbRhythm, fc.integer({ min: 0, max: 100 }), (rhythm, flow) => {
                const grade = computeGrade({
                    correct: 0,
                    wrong: 0,
                    rhythm,
                    flow,
                    dynamics: null,
                    expression: null,
                });

                expect(grade).toMatchObject({
                    accuracy: 0,
                    timing: 0,
                    flow: 0,
                    score: 0,
                    letter: "F",
                });
            }),
        );
    });

    it("counts keeping up as the share of beats caught", () => {
        fc.assert(
            fc.property(fc.array(fc.boolean(), { maxLength: 40 }), (hits) => {
                const result = scoreKeepUp(hits);

                expect(result.total).toBe(hits.length);
                expect(result.inTime).toBe(hits.filter(Boolean).length);
                expect(result.inTime).toBeLessThanOrEqual(result.total);
                if (hits.length > 0 && hits.every(Boolean)) {
                    expect(result.letter).toBe("S");
                }
                if (hits.length > 0 && !hits.some(Boolean)) {
                    expect(result.letter).toBe("F");
                }
            }),
        );
    });

    it("reads a stored grade back, and anything else as none", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const grade = computeGrade(input);

                expect(parseGrade(grade)).toEqual(grade);
                expect(parseGrade(JSON.parse(JSON.stringify(grade)))).toEqual(grade);
            }),
        );
        fc.assert(
            fc.property(fc.anything(), (value) => {
                expect(() => parseGrade(value)).not.toThrow();
            }),
        );
    });

    it("shows every reading it holds, each within its range", () => {
        fc.assert(
            fc.property(arbInput, (input) => {
                const grade = computeGrade(input);

                for (const reading of scoreReadings(grade)) {
                    expect(reading.value).toBeGreaterThanOrEqual(0);
                    expect(reading.value).toBeLessThanOrEqual(100);
                }
            }),
        );
    });
});
